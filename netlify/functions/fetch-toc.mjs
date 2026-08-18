// 정수장 원수의 TOC(총유기탄소) 데이터를 주 단위로 자동으로 가져와 Supabase에 저장하는 함수.
// 환경부 국립환경과학원_물환경 수질측정망 운영결과 조회서비스(getWaterMeasuringList) API로 실제 연동되어 있습니다.
// 조류경보제 API와 같은 서비스(1480523)의 같은 키를 쓰므로 별도 키 없이 ALGAE_API_KEY를 그대로 사용합니다.

const SUPABASE_URL = 'https://ndcdxqqljnbwnwgqszwi.supabase.co';
const SUPABASE_KEY = 'sb_publishable__FQ1RVW68XSRozWOQez8Bg_Zf44FbNd';

// 정수장 id, 이름, 물환경 수질측정망 지점코드(ptNo)
const PLANTS = [
  { id: 'gumi', name: '구미정수장', ptNo: '2011A20' }, // 낙동강교(구미시 오태동)
  { id: 'goryeong', name: '고령정수장', ptNo: '2014A20' }, // 고령교(고령군 성산면)
  { id: 'bansong', name: '반송정수장', ptNo: '2504A20' }, // 내동천(창원시 의창구)
  { id: 'yeoncho', name: '연초정수장', ptNo: '2503B20' }, // 연초댐1(거제시 연초면)
];

function randomBetween(min, max, decimals = 1) {
  return +(min + Math.random() * (max - min)).toFixed(decimals);
}

// TOC 가상 데이터 (API 키가 없거나 호출 실패 시 사용, 단위 mg/L)
function generateMockToc() {
  return { toc_mg_l: randomBetween(1, 10, 1) };
}

// "정량한계미만"은 0으로, "분석중" 등 그 외 비숫자 값/빈 값은 null(미확정)로 처리합니다.
function parseNumeric(v) {
  if (v == null || v === '') return null;
  if (v === '정량한계미만') return 0;
  const n = parseFloat(v);
  return Number.isNaN(n) ? null : n;
}

function extractTag(block, tag) {
  const m = block.match(new RegExp(`<${tag}>([^<]*)</${tag}>|<${tag}/>`));
  if (!m) return null;
  return m[1] !== undefined ? m[1].trim() : null;
}

async function fetchTocMonth(plant, yyyy, mm) {
  // data.go.kr 서비스키는 이미 퍼센트 인코딩된 상태로 제공되는 경우가 많아, 그대로 쓰면 이중 인코딩됩니다.
  let serviceKey = process.env.ALGAE_API_KEY;
  try { serviceKey = decodeURIComponent(serviceKey); } catch (e) { /* 이미 원문이면 그대로 사용 */ }

  const params = new URLSearchParams({
    serviceKey,
    pageNo: '1',
    numOfRows: '20',
    resultType: 'XML',
    ptNoList: plant.ptNo,
    wmyrList: yyyy,
    wmodList: mm,
  });

  const url = `https://apis.data.go.kr/1480523/WaterQualityService/getWaterMeasuringList?${params.toString()}`;
  const res = await fetch(url);
  const text = await res.text();

  const resultCode = text.match(/<resultCode>(.*?)<\/resultCode>/)?.[1];
  const resultMsg = text.match(/<resultMsg>(.*?)<\/resultMsg>/)?.[1];
  if (resultCode !== '00') {
    throw new Error(`물환경 수질측정망 API 오류(${plant.ptNo}): [${resultCode}] ${resultMsg || text.slice(0, 200)}`);
  }

  return [...text.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(m => m[1]);
}

// 실험실 분석 지연 등으로 이번 달 자료가 아직 없을 수 있어, 최근 3개월을 거슬러 올라가며 조회하고
// 그중 측정일자(wmcymd)가 가장 최근인 항목을 사용합니다.
async function fetchRealToc(plant) {
  const now = new Date();
  let itemBlocks = [];
  let triedMonths = [];
  for (let back = 0; back < 3 && itemBlocks.length === 0; back++) {
    const target = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1));
    const yyyy = String(target.getUTCFullYear());
    const mm = String(target.getUTCMonth() + 1).padStart(2, '0');
    triedMonths.push(`${yyyy}-${mm}`);
    itemBlocks = await fetchTocMonth(plant, yyyy, mm);
  }
  if (itemBlocks.length === 0) {
    throw new Error(`물환경 수질측정망 응답에 데이터가 없습니다(지점 ${plant.ptNo}, 조회월: ${triedMonths.join(', ')})`);
  }

  let latestBlock = null;
  let latestDate = null;
  for (const block of itemBlocks) {
    const wmcymd = extractTag(block, 'wmcymd');
    if (!wmcymd) continue;
    const d = new Date(wmcymd.replace(/\./g, '-'));
    if (!latestDate || d > latestDate) { latestDate = d; latestBlock = block; }
  }
  if (!latestBlock) {
    throw new Error(`물환경 수질측정망 응답에서 측정일자를 찾을 수 없습니다(지점 ${plant.ptNo})`);
  }

  return { toc_mg_l: parseNumeric(extractTag(latestBlock, 'itemToc')) };
}

async function getPlantToc(plant) {
  const hasKey = !!process.env.ALGAE_API_KEY;

  if (hasKey) {
    try {
      const data = await fetchRealToc(plant);
      return { ...data, source: 'real' };
    } catch (e) {
      console.error(`[${plant.id}] 물환경 수질측정망 API 호출 실패, 가상 데이터로 대체:`, e.message);
      return { ...generateMockToc(), source: 'mock' };
    }
  }
  return { ...generateMockToc(), source: 'mock' };
}

export default async () => {
  const today = new Date().toISOString().slice(0, 10);

  const rows = [];
  for (const plant of PLANTS) {
    const data = await getPlantToc(plant);
    rows.push({
      plant_id: plant.id,
      recorded_date: today,
      toc_mg_l: data.toc_mg_l,
      toc_source: data.source,
    });
  }

  const res = await fetch(`${SUPABASE_URL}/rest/v1/environment_data?on_conflict=plant_id,recorded_date`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify(rows),
  });

  const resultText = await res.text();
  return new Response(JSON.stringify({ ok: res.ok, status: res.status, date: today, rows, result: resultText }), {
    headers: { 'Content-Type': 'application/json' },
  });
};

// 매주 자동 실행 (매주 월요일 00:00 UTC — 한국시간 월요일 오전 9시)
export const config = {
  schedule: '0 0 * * 1',
};
