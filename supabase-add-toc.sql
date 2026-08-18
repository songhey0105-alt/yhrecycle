-- 환경 데이터 테이블에 원수 TOC(총유기탄소) 컬럼 추가 - Supabase SQL Editor에서 실행하세요.
-- fetch-toc.mjs(일 단위)가 국립환경과학원 실시간 수질자동측정망 API(m81 항목)에서 받아옵니다.

alter table environment_data add column if not exists toc_mg_l numeric;
alter table environment_data add column if not exists toc_source text;
