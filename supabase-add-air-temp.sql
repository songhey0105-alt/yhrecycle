-- 환경 데이터 테이블에 기온(air_temp_c) 컬럼 추가 - Supabase SQL Editor에서 실행하세요.
-- 기존 environment_data 테이블은 강수량·수온만 저장하고 있었는데,
-- 기상청 ASOS 실연동에서 기온도 함께 받아오도록 컬럼을 추가합니다.

alter table environment_data add column if not exists air_temp_c numeric;
