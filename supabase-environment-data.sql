-- 환경 데이터(강수량·수온) 테이블 - Supabase SQL Editor에서 실행하세요.
-- 정수장별로 하루 1건씩 강수량·수온 데이터를 쌓는 테이블입니다.

create table if not exists environment_data (
  id bigint generated always as identity primary key,
  plant_id text not null references plants(id) on delete cascade,
  recorded_date date not null,
  precipitation_mm numeric,
  water_temp_c numeric,
  source text not null default 'mock',
  created_at timestamptz not null default now(),
  unique (plant_id, recorded_date)
);

alter table environment_data enable row level security;

create policy "environment_data 읽기 허용" on environment_data for select using (true);
create policy "environment_data 추가 허용" on environment_data for insert with check (true);
create policy "environment_data 수정 허용" on environment_data for update using (true) with check (true);

alter publication supabase_realtime add table environment_data;
