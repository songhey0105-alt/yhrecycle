// 정수장별 원수 수온 데이터를 주 단위로 자동으로 가져와 Supabase에 저장하는 함수.
// 환경부 물환경 수질측정망(또는 K-water 공공데이터) API 키가 아직 없어 가상 데이터로 채우고,
// Netlify 환경변수(WATER_QUALITY_API_KEY)가 설정되고 fetchRealWaterTemp()를 채우면 자동으로 실제 데이터로 전환됩니다.

const SUPABASE_URL = 'https://ndcdxqqljnbwnwgqszwi.supabase.co';
const SUPABASE_KEY = 'sb_publishable__FQ1RVW68XSRozWOQez8Bg_Zf44FbNd';

// 정수장 id, 이름, (나중에 채울) 물환경측정망 관측지점 코드
const PLANTS = [
  { id: 'gumi', name: '구미정수장', waterQualityStationId: null },
  { id: 'goryeong', name: '고령정수장', waterQualityStationId: null },
  { id: 'bansong', name: '반송정수장', waterQualityStationId: null },
  { id: 'yeoncho', name: '연초정수장', waterQualityStationId: null },
];

function randomBetween(min, max, decimals = 1) {
  return +(min + Math.random() * (max - min)).toFixed(decimals);
}

// 수온 가상 데이터 (API 키가 없거나 호출 실패 시 사용)
function generateMockWaterTemp() {
  return { water_temp_c: randomBetween(8, 27, 1) };
}

// TODO: 물환경 수질측정망(또는 K-water) API 키를 발급받으면 이 함수 안을 실제 API 호출 코드로 채우세요.
// 예: `https://apis.data.go.kr/.../물환경측정망?serviceKey=${process.env.WATER_QUALITY_API_KEY}&stationId=${plant.waterQualityStationId}`
async function fetchRealWaterTemp(plant) {
  throw new Error('물환경측정망 실제 연동 미구현');
}

async function getPlantWaterTemp(plant) {
  const hasKey = !!process.env.WATER_QUALITY_API_KEY;

  if (hasKey) {
    try {
      const data = await fetchRealWaterTemp(plant);
      return { ...data, source: 'real' };
    } catch (e) {
      console.error(`[${plant.id}] 물환경측정망 API 호출 실패, 가상 데이터로 대체:`, e.message);
      return { ...generateMockWaterTemp(), source: 'mock' };
    }
  }
  return { ...generateMockWaterTemp(), source: 'mock' };
}

export default async () => {
  const today = new Date().toISOString().slice(0, 10);

  const rows = [];
  for (const plant of PLANTS) {
    const data = await getPlantWaterTemp(plant);
    rows.push({
      plant_id: plant.id,
      recorded_date: today,
      water_temp_c: data.water_temp_c,
      water_temp_source: data.source,
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
