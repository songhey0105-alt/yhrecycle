// 정수장 원수의 지오스민·2-MIB(맛·냄새물질) 데이터를 월 단위로 자동으로 가져와 Supabase에 저장하는 함수.
// 정수장 법정 수질검사 항목 특성상 원본 데이터 자체가 월 1회 갱신되므로 월 단위로만 수집합니다.
// K-water 상수도 정수 수질검사 정보(또는 전국상수도수질검사표준데이터) API 키가 아직 없어 가상 데이터로 채우고,
// Netlify 환경변수(TASTE_ODOR_API_KEY)가 설정되고 fetchRealTasteOdor()를 채우면 자동으로 실제 데이터로 전환됩니다.

const SUPABASE_URL = 'https://ndcdxqqljnbwnwgqszwi.supabase.co';
const SUPABASE_KEY = 'sb_publishable__FQ1RVW68XSRozWOQez8Bg_Zf44FbNd';

// 정수장 id, 이름, (나중에 채울) 수질검사 정보 조회용 정수장 코드
const PLANTS = [
  { id: 'gumi', name: '구미정수장', waterPlantCode: null },
  { id: 'goryeong', name: '고령정수장', waterPlantCode: null },
  { id: 'bansong', name: '반송정수장', waterPlantCode: null },
  { id: 'yeoncho', name: '연초정수장', waterPlantCode: null },
];

function randomBetween(min, max, decimals = 1) {
  return +(min + Math.random() * (max - min)).toFixed(decimals);
}

// 지오스민·2-MIB 가상 데이터 (API 키가 없거나 호출 실패 시 사용, 단위 ng/L)
function generateMockTasteOdor() {
  return { geosmin_ng_l: randomBetween(0, 15, 1), mib_ng_l: randomBetween(0, 15, 1) };
}

// TODO: K-water_상수도 정수 수질검사 정보(또는 전국상수도수질검사표준데이터) API 키를 발급받으면
// 이 함수 안을 실제 API 호출 코드로 채우세요.
// 예: `https://apis.data.go.kr/.../상수도정수수질검사?serviceKey=${process.env.TASTE_ODOR_API_KEY}&plantCode=${plant.waterPlantCode}`
async function fetchRealTasteOdor(plant) {
  throw new Error('상수도 정수 수질검사 정보 실제 연동 미구현');
}

async function getPlantTasteOdor(plant) {
  const hasKey = !!process.env.TASTE_ODOR_API_KEY;

  if (hasKey) {
    try {
      const data = await fetchRealTasteOdor(plant);
      return { ...data, source: 'real' };
    } catch (e) {
      console.error(`[${plant.id}] 수질검사 정보 API 호출 실패, 가상 데이터로 대체:`, e.message);
      return { ...generateMockTasteOdor(), source: 'mock' };
    }
  }
  return { ...generateMockTasteOdor(), source: 'mock' };
}

export default async () => {
  const today = new Date().toISOString().slice(0, 10);

  const rows = [];
  for (const plant of PLANTS) {
    const data = await getPlantTasteOdor(plant);
    rows.push({
      plant_id: plant.id,
      recorded_date: today,
      geosmin_ng_l: data.geosmin_ng_l,
      mib_ng_l: data.mib_ng_l,
      taste_odor_source: data.source,
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

// 매월 1일 자동 실행 (00:00 UTC — 한국시간 오전 9시)
export const config = {
  schedule: '0 0 1 * *',
};
