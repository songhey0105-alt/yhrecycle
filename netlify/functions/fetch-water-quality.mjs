// 정수장 원수의 수온·지오스민·2-MIB·유해남조류세포수(원수조류발생현황) 데이터를
// 주 단위로 자동으로 가져와 Supabase에 저장하는 함수.
// 환경부 국립환경과학원_조류경보제 조회서비스(algaePreMeasure) API로 실제 연동되어 있습니다.
// 이 조사 자체가 조류경보제 관측지점 기준 주 단위로 이루어져, 네 항목을 한 번의 호출로 함께 받아옵니다.

const SUPABASE_URL = 'https://ndcdxqqljnbwnwgqszwi.supabase.co';
const SUPABASE_KEY = 'sb_publishable__FQ1RVW68XSRozWOQez8Bg_Zf44FbNd';

// 정수장 id, 이름, 조류경보제 관측지점 코드(swmnCode)
const PLANTS = [
  { id: 'gumi', name: '구미정수장', swmnCode: '2011G26' }, // 낙동강 해평
  { id: 'goryeong', name: '고령정수장', swmnCode: '2011G56' }, // 낙동강 강정·고령
  { id: 'bansong', name: '반송정수장', swmnCode: '2020G33' }, // 낙동강 칠서
  { id: 'yeoncho', name: '연초정수장', swmnCode: '2018G20' }, // 진양호 내동 - 거제 인근에 조류경보제 관측지점이 없어 지리적으로 가장 가까운 대안
];

function randomBetween(min, max, decimals = 1) {
  return +(min + Math.random() * (max - min)).toFixed(decimals);
}

// 가상 데이터 (API 키가 없거나 호출 실패 시 사용)
function generateMockWaterQuality() {
  return {
    water_temp_c: randomBetween(8, 27, 1),
    geosmin_ng_l: randomBetween(0, 15, 1),
    mib_ng_l: randomBetween(0, 15, 1),
    algae_cell_count: Math.round(randomBetween(0, 20000, 0)),
  };
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
  return m[1] !== undefined ? m[1] : null;
}

async function fetchAlgaeMonth(plant, yyyy, mm) {
  // data.go.kr 서비스키는 이미 퍼센트 인코딩된 상태로 제공되는 경우가 많아, 그대로 쓰면 이중 인코딩됩니다.
  let serviceKey = process.env.ALGAE_API_KEY;
  try { serviceKey = decodeURIComponent(serviceKey); } catch (e) { /* 이미 원문이면 그대로 사용 */ }

  const params = new URLSearchParams({
    serviceKey,
    pageNo: '1',
    numOfRows: '20',
    resultType: 'XML',
    ptNoList: plant.swmnCode,
    wmyrList: yyyy,
    wmodList: mm,
  });

  const url = `https://apis.data.go.kr/1480523/nieragainstalgae/algaePreMeasure?${params.toString()}`;
  const res = await fetch(url);
  const text = await res.text();

  const resultCode = text.match(/<resultCode>(.*?)<\/resultCode>/)?.[1];
  const resultMsg = text.match(/<resultMsg>(.*?)<\/resultMsg>/)?.[1];
  if (resultCode !== '00') {
    throw new Error(`조류경보제 API 오류(${plant.swmnCode}): [${resultCode}] ${resultMsg || text.slice(0, 200)}`);
  }

  return [...text.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(m => m[1]);
}

// 항목별로 측정일자(chckDe)가 가장 최근이면서 해당 태그 값이 실제로 채워진(숫자로 파싱되는) 항목을 찾습니다.
// 지오스민·2-MIB는 실험실 분석 항목이라 수온·남조류세포수보다 훨씬 드문드문(격주~월 1회 수준) 채워지므로,
// 네 항목을 같은 회차에서 한꺼번에 뽑으면 그 회차에 아직 분석이 안 끝난 항목만 계속 비어 보이게 됩니다.
function latestWithValue(itemBlocks, tag) {
  let best = null;
  let bestDate = null;
  for (const block of itemBlocks) {
    const raw = extractTag(block, tag);
    const value = parseNumeric(raw);
    if (value == null) continue;
    const chckDe = extractTag(block, 'chckDe');
    if (!chckDe) continue;
    const d = new Date(chckDe.replace(/\./g, '-'));
    if (!bestDate || d > bestDate) { bestDate = d; best = value; }
  }
  return best;
}

// 환경부 국립환경과학원_조류경보제 조회서비스 (algaePreMeasure)
// 최근 몇 개월치 회차를 모아서, 항목별로 값이 채워진 가장 최근 회차를 각각 독립적으로 사용합니다.
async function fetchRealWaterQuality(plant) {
  const now = new Date();
  let itemBlocks = [];
  for (let back = 0; back < 4; back++) {
    const target = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1));
    const yyyy = String(target.getUTCFullYear());
    const mm = String(target.getUTCMonth() + 1).padStart(2, '0');
    itemBlocks = itemBlocks.concat(await fetchAlgaeMonth(plant, yyyy, mm));
  }
  if (itemBlocks.length === 0) {
    throw new Error(`조류경보제 응답에 데이터가 없습니다(지점 ${plant.swmnCode}, 최근 4개월 조회)`);
  }

  return {
    water_temp_c: latestWithValue(itemBlocks, 'iemWtrtp'),
    geosmin_ng_l: latestWithValue(itemBlocks, 'iemGeosm'),
    mib_ng_l: latestWithValue(itemBlocks, 'iemMib2'),
    algae_cell_count: latestWithValue(itemBlocks, 'iemBgalageCellCo'),
  };
}

async function getPlantWaterQuality(plant) {
  const hasKey = !!process.env.ALGAE_API_KEY;

  if (hasKey) {
    try {
      const data = await fetchRealWaterQuality(plant);
      return { ...data, source: 'real' };
    } catch (e) {
      console.error(`[${plant.id}] 조류경보제 API 호출 실패, 가상 데이터로 대체:`, e.message);
      return { ...generateMockWaterQuality(), source: 'mock' };
    }
  }
  return { ...generateMockWaterQuality(), source: 'mock' };
}

export default async () => {
  const today = new Date().toISOString().slice(0, 10);

  const rows = [];
  for (const plant of PLANTS) {
    const data = await getPlantWaterQuality(plant);
    rows.push({
      plant_id: plant.id,
      recorded_date: today,
      water_temp_c: data.water_temp_c,
      water_temp_source: data.source,
      geosmin_ng_l: data.geosmin_ng_l,
      mib_ng_l: data.mib_ng_l,
      taste_odor_source: data.source,
      algae_cell_count: data.algae_cell_count,
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
