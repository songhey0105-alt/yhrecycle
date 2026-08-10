-- 활성탄 통합관리 대시보드 - Supabase 초기 설정 스크립트
-- Supabase 프로젝트의 SQL Editor에 이 내용을 붙여넣고 실행(Run)하세요.

-- 1) 테이블 생성
create table if not exists plants (
  id text primary key,
  name text not null,
  gac_ton numeric not null default 0,
  oper_months numeric not null default 0,
  bv numeric not null default 0,
  iodine numeric not null default 0,
  doc numeric not null default 0,
  dbps_pct numeric not null default 0,
  geosmin_mib numeric not null default 0
);

create table if not exists warehouses (
  id text primary key,
  name text not null,
  capacity numeric not null default 0,
  stock numeric not null default 0,
  safety numeric not null default 0,
  daily_outflow numeric not null default 0
);

create table if not exists facility (
  id int primary key,
  capacity_per_day numeric not null default 2.6
);

-- 2) 초기 가상 데이터 입력 (이미 있으면 건너뜀)
insert into plants (id, name, gac_ton, oper_months, bv, iodine, doc, dbps_pct, geosmin_mib) values
  ('gumi', '구미정수장', 9, 14, 28000, 788.5, 1.46, 51.4, 3.45),
  ('goryeong', '고령정수장', 11, 22, 42000, 611, 1.89, 69.4, 9.2),
  ('bansong', '반송정수장', 13, 30, 51000, 539.1, 1.66, 52.4, 4.44),
  ('yeoncho', '연초정수장', 15, 34, 48000, 615.2, 2.04, 78.3, 10.49)
on conflict (id) do nothing;

insert into warehouses (id, name, capacity, stock, safety, daily_outflow) values
  ('W1', '구미 입상활성탄 비축창고', 180, 90, 75, 3.0)
on conflict (id) do nothing;

insert into facility (id, capacity_per_day) values (1, 2.6)
on conflict (id) do nothing;

-- 3) 접근 권한 설정 (RLS 활성화 + 접속한 누구나 읽기/쓰기 허용)
alter table plants enable row level security;
alter table warehouses enable row level security;
alter table facility enable row level security;

create policy "plants 읽기 허용" on plants for select using (true);
create policy "plants 추가 허용" on plants for insert with check (true);
create policy "plants 수정 허용" on plants for update using (true) with check (true);
create policy "plants 삭제 허용" on plants for delete using (true);

create policy "warehouses 읽기 허용" on warehouses for select using (true);
create policy "warehouses 추가 허용" on warehouses for insert with check (true);
create policy "warehouses 수정 허용" on warehouses for update using (true) with check (true);
create policy "warehouses 삭제 허용" on warehouses for delete using (true);

create policy "facility 읽기 허용" on facility for select using (true);
create policy "facility 수정 허용" on facility for update using (true) with check (true);

-- 4) 실시간 동기화(다른 브라우저에서도 즉시 반영)를 위한 Realtime 발행 설정
alter publication supabase_realtime add table plants;
alter publication supabase_realtime add table warehouses;
alter publication supabase_realtime add table facility;
