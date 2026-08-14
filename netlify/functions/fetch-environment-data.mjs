// 정수장별 강수량·기온·수온 데이터를 매일 자동으로 가져와 Supabase에 저장하는 함수.
// 강수량·기온은 기상청 ASOS 시간자료 API로 실제 연동되어 있습니다.
// 수온은 WAMIS API 키가 아직 없어 가상 데이터로 채워지며,
// Netlify 환경변수(WAMIS_API_KEY)가 설정되고 fetchRealWaterTemp()를 채우면 자동으로 실제 데이터로 전환됩니다.

const SUPABASE_URL = 'https://ndcdxqqljnbwnwgqszwi.supabase.co';
const SUPABASE_KEY = 'sb_publishable__FQ1RVW68XSRozWOQez8Bg_Zf44FbNd';

// 정수장 id, 이름, 기상청 ASOS 지점번호(kmaStationId)·WAMIS 관측소 코드(wamisStationId)
const PLANTS = [
  { id: 'gumi', name: '구미정수장', kmaStationId: 279, wamisStationId: null },
  { id: 'goryeong', name: '고령정수장', kmaStationId: 143, wamisStationId: null },
  { id: 'bansong', name: '반송정수장', kmaStationId: 155, wamisStationId: null }, // 창원 지점(가장 가까운 ASOS 관측소)
  { id: 'yeoncho', name: '연초정수장', kmaStationId: 294, wamisStationId: null },
];

function randomBetween(min, max, decimals = 1) {
  return +(min + Math.random() * (max - min)).toFixed(decimals);
}

// 강수량·기온 가상 데이터 (기상청 키가 없거나 호출 실패 시 사용)
function generateMockPrecipAirTemp() {
  return { precipitation_mm: randomBetween(0, 40, 1), air_temp_c: randomBetween(5, 33, 1) };
}

// 수온 가상 데이터 (WAMIS 키가 없거나 호출 실패 시 사용)
function generateMockWaterTemp() {
  return { water_temp_c: randomBetween(8, 27, 1) };
}

// 기상청_지상(종관, ASOS) 시간자료 조회서비스
// 전날(00~23시) 시간자료를 모두 가져와 강수량은 합산, 기온은 가장 최근 유효값을 사용합니다.
async function fetchRealPrecipitationAndAirTemp(plant) {
  const target = new Date();
  target.setUTCDate(target.getUTCDate() - 1); // 오늘 데이터는 아직 다 안 쌓였을 수 있어 전날 기준으로 조회
  const dateStr = target.toISOString().slice(0, 10).replace(/-/g, '');

  const params = new URLSearchParams({
    serviceKey: process.env.KMA_API_KEY,
    pageNo: '1',
    numOfRows: '24',
    dataType: 'JSON',
    dataCd: 'ASOS',
    dateCd: 'HR',
    startDt: dateStr,
    startHh: '00',
    endDt: dateStr,
    endHh: '23',
    stnIds: String(plant.kmaStationId),
  });

  const url = `https://apis.data.go.kr/1360000/AsosHourlyInfoService/getWthrDataList?${params.toString()}`;
  const res = await fetch(url);
  const text = await res.text();

  let json;
  try {
    json = JSON.parse(text);
  } catch (e) {
    throw new Error(`KMA 응답 파싱 실패: ${text.slice(0, 200)}`);
  }

  const header = json?.response?.header;
  if (!header || header.resultCode !== '00') {
    throw new Error(`KMA API 오류(${plant.kmaStationId}): ${header?.resultMsg || '알 수 없는 오류'}`);
  }

  const rawItems = json?.response?.body?.items?.item;
  const items = Array.isArray(rawItems) ? rawItems : (rawItems ? [rawItems] : []);
  if (items.length === 0) {
    throw new Error(`KMA 응답에 데이터가 없습니다(지점 ${plant.kmaStationId}, ${dateStr})`);
  }

  const totalRain = items.reduce((sum, it) => sum + (parseFloat(it.rn) || 0), 0);
  const lastWithTemp = [...items].reverse().find(it => it.ta !== '' && it.ta != null);
  if (!lastWithTemp) {
    throw new Error(`KMA 응답에 기온 값이 없습니다(지점 ${plant.kmaStationId}, ${dateStr})`);
  }

  return {
    precipitation_mm: +totalRain.toFixed(1),
    air_temp_c: parseFloat(lastWithTemp.ta),
  };
}

// TODO: WAMIS API 키를 발급받으면 이 함수 안을 실제 API 호출 코드로 채우세요.
// 예: `https://www.wamis.go.kr:8081/wamis/openapi/wkw/...?key=${process.env.WAMIS_API_KEY}&obscd=${plant.wamisStationId}`
async function fetchRealWaterTemp(plant) {
  throw new Error('WAMIS 실제 연동 미구현');
}

async function getPlantEnvironmentData(plant) {
  const hasKmaKey = !!process.env.KMA_API_KEY;
  const hasWamisKey = !!process.env.WAMIS_API_KEY;

  let precipAirTemp;
  let precipSource;
  if (hasKmaKey) {
    try {
      precipAirTemp = await fetchRealPrecipitationAndAirTemp(plant);
      precipSource = 'real';
    } catch (e) {
      console.error(`[${plant.id}] 기상청 API 호출 실패, 가상 데이터로 대체:`, e.message);
      precipAirTemp = generateMockPrecipAirTemp();
      precipSource = 'mock';
    }
  } else {
    precipAirTemp = generateMockPrecipAirTemp();
    precipSource = 'mock';
  }

  let waterTemp;
  let waterSource;
  if (hasWamisKey) {
    try {
      waterTemp = await fetchRealWaterTemp(plant);
      waterSource = 'real';
    } catch (e) {
      console.error(`[${plant.id}] WAMIS API 호출 실패, 가상 데이터로 대체:`, e.message);
      waterTemp = generateMockWaterTemp();
      waterSource = 'mock';
    }
  } else {
    waterTemp = generateMockWaterTemp();
    waterSource = 'mock';
  }

  return {
    precipitation_mm: precipAirTemp.precipitation_mm,
    air_temp_c: precipAirTemp.air_temp_c,
    water_temp_c: waterTemp.water_temp_c,
    source: (precipSource === 'real' || waterSource === 'real') ? 'real' : 'mock',
  };
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
      air_temp_c: data.air_temp_c,
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

// 매일 자동 실행 (00:00 UTC — 한국시간 오전 9시)
export const config = {
  schedule: '0 0 * * *',
};
