// 정수장별 강수량·수온 데이터를 매일 자동으로 가져와 Supabase에 저장하는 함수.
// 기상청/WAMIS API 키가 아직 없으면 가상 데이터를 생성해서 채우고,
// Netlify 환경변수(KMA_API_KEY, WAMIS_API_KEY)가 설정되면 자동으로 실제 API 호출로 전환됩니다.

const SUPABASE_URL = 'https://ndcdxqqljnbwnwgqszwi.supabase.co';
const SUPABASE_KEY = 'sb_publishable__FQ1RVW68XSRozWOQez8Bg_Zf44FbNd';

// 정수장 id, 이름, (나중에 채울) 기상청 지점번호·WAMIS 관측소 코드
const PLANTS = [
  { id: 'gumi', name: '구미정수장', kmaStationId: null, wamisStationId: null },
  { id: 'goryeong', name: '고령정수장', kmaStationId: null, wamisStationId: null },
  { id: 'bansong', name: '반송정수장', kmaStationId: null, wamisStationId: null },
  { id: 'yeoncho', name: '연초정수장', kmaStationId: null, wamisStationId: null },
];

function randomBetween(min, max, decimals = 1) {
  return +(min + Math.random() * (max - min)).toFixed(decimals);
}

// 가상 데이터 생성 (API 키가 없을 때 사용)
function generateMockData() {
  return {
    precipitation_mm: randomBetween(0, 40, 1),
    water_temp_c: randomBetween(8, 27, 1),
    source: 'mock',
  };
}

// TODO: 기상청 API 키를 발급받으면 이 함수 안을 실제 API 호출 코드로 채우세요.
// 예: `https://apis.data.go.kr/1360000/...?serviceKey=${process.env.KMA_API_KEY}&stationId=${plant.kmaStationId}`
async function fetchRealPrecipitation(plant) {
  throw new Error('기상청 실제 연동 미구현');
}

// TODO: WAMIS API 키를 발급받으면 이 함수 안을 실제 API 호출 코드로 채우세요.
// 예: `https://www.wamis.go.kr:8081/wamis/openapi/wkw/...?key=${process.env.WAMIS_API_KEY}&obscd=${plant.wamisStationId}`
async function fetchRealWaterTemp(plant) {
  throw new Error('WAMIS 실제 연동 미구현');
}

async function getPlantEnvironmentData(plant) {
  const hasKmaKey = !!process.env.KMA_API_KEY;
  const hasWamisKey = !!process.env.WAMIS_API_KEY;

  if (hasKmaKey && hasWamisKey) {
    try {
      const [precipitation_mm, water_temp_c] = await Promise.all([
        fetchRealPrecipitation(plant),
        fetchRealWaterTemp(plant),
      ]);
      return { precipitation_mm, water_temp_c, source: 'real' };
    } catch (e) {
      console.error(`[${plant.id}] 실제 API 호출 실패, 가상 데이터로 대체:`, e.message);
      return generateMockData();
    }
  }
  return generateMockData();
}

export default async () => {
  const today = new Date().toISOString().slice(0, 10);

  const rows = [];
  for (const plant of PLANTS) {
    const data = await getPlantEnvironmentData(plant);
    rows.push({
      plant_id: plant.id,
      recorded_date: today,
      precipitation_mm: data.precipitation_mm,
      water_temp_c: data.water_temp_c,
      source: data.source,
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

// 매일 자정(UTC) 자동 실행 — 한국시간 오전 9시
export const config = {
  schedule: '@daily',
};
