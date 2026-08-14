-- 환경 데이터 테이블에 유해남조류 세포수(원수조류발생현황) 컬럼 추가 - Supabase SQL Editor에서 실행하세요.
-- fetch-water-quality.mjs(주 단위)가 국립환경과학원 조류경보제 API에서 수온·지오스민·2-MIB와 함께 받아옵니다.

alter table environment_data add column if not exists algae_cell_count numeric;
