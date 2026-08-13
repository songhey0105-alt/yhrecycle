-- 흡착지(지) 단위 데이터 테이블 - Supabase SQL Editor에서 실행하세요.
-- 정수장의 지표(요오드가/DOC/DBPs/Geosmin&MIB/운영기간/BV/활성탄물량)를
-- 정수장 단위가 아니라 흡착지(지) 단위로 관리하기 위한 테이블입니다.
--
-- 고정 지 구성: 구미 18지(GAC 12 + F/A 6), 고령 GAC 5지, 반송 F/A 10지, 연초 F/A 4지 (총 37지)

create table if not exists basins (
  id text primary key,
  plant_id text not null references plants(id) on delete cascade,
  carbon_spec text not null,
  basin_no text not null,
  gac_ton numeric not null default 0,
  oper_months numeric not null default 0,
  bv numeric not null default 0,
  iodine numeric not null default 0,
  doc numeric not null default 0,
  dbps_pct numeric not null default 0,
  geosmin_mib numeric not null default 0,
  unique (plant_id, carbon_spec, basin_no)
);

alter table basins enable row level security;

create policy "basins 읽기 허용" on basins for select using (true);
create policy "basins 추가 허용" on basins for insert with check (true);
create policy "basins 수정 허용" on basins for update using (true) with check (true);
create policy "basins 삭제 허용" on basins for delete using (true);

alter publication supabase_realtime add table basins;

-- 초기 가상 데이터 시드 (37개 지, 값은 데모용으로 몇 가지 패턴을 순환 배치)
insert into basins (id, plant_id, carbon_spec, basin_no, gac_ton, oper_months, bv, iodine, doc, dbps_pct, geosmin_mib)
select
  b.plant_id || '-' || b.carbon_spec || '-' || replace(b.basin_no, ' ', '_'),
  b.plant_id, b.carbon_spec, b.basin_no,
  (array[8,10,12,9,11])[(b.idx % 5)+1],
  (array[10,22,30,15,26,34])[(b.idx % 6)+1],
  (array[20000,40000,51000,15000,47000])[(b.idx % 5)+1],
  (array[850,720,880,610,560,940,505,770,690,830,470,900])[(b.idx % 12)+1],
  (array[1.2,1.8,0.9,2.1,1.5])[(b.idx % 5)+1],
  (array[45,70,30,85,60])[(b.idx % 5)+1],
  (array[3,8,2,11,5])[(b.idx % 5)+1]
from (values
  ('gumi','GAC','1',0),('gumi','GAC','2',1),('gumi','GAC','3',2),('gumi','GAC','4',3),
  ('gumi','GAC','5',4),('gumi','GAC','6',5),('gumi','GAC','7',6),('gumi','GAC','8',7),
  ('gumi','GAC','9',8),('gumi','GAC','10',9),('gumi','GAC','11',10),('gumi','GAC','12',11),
  ('gumi','F/A','1',12),('gumi','F/A','2',13),('gumi','F/A','3',14),
  ('gumi','F/A','4',15),('gumi','F/A','5',16),('gumi','F/A','6',17),
  ('goryeong','GAC','1',18),('goryeong','GAC','2',19),('goryeong','GAC','3',20),
  ('goryeong','GAC','4',21),('goryeong','GAC','5',22),
  ('bansong','F/A','1',23),('bansong','F/A','2',24),('bansong','F/A','3',25),
  ('bansong','F/A','4',26),('bansong','F/A','5',27),('bansong','F/A','6',28),
  ('bansong','F/A','7',29),('bansong','F/A','8',30),('bansong','F/A','9',31),('bansong','F/A','10',32),
  ('yeoncho','F/A','1',33),('yeoncho','F/A','2',34),('yeoncho','F/A','3',35),('yeoncho','F/A','4',36)
) as b(plant_id, carbon_spec, basin_no, idx)
on conflict (id) do nothing;
