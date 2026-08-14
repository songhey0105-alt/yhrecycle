-- 환경 데이터 테이블에 수온 출처, 지오스민·2-MIB 컬럼을 추가 - Supabase SQL Editor에서 실행하세요.
-- 수온(주 단위)과 지오스민·2-MIB(월 단위)는 강수량·기온(일 단위)과 수집 주기가 달라
-- 각각 별도의 Netlify 함수(fetch-water-temp.mjs, fetch-taste-odor.mjs)에서 관리하며,
-- 서로 덮어쓰지 않도록 출처(source) 컬럼도 항목별로 분리했습니다.

alter table environment_data add column if not exists water_temp_source text;
alter table environment_data add column if not exists geosmin_ng_l numeric;
alter table environment_data add column if not exists mib_ng_l numeric;
alter table environment_data add column if not exists taste_odor_source text;
