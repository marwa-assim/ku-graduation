begin;

-- Repair the audit table created by older migrations without losing existing rows.
create table if not exists public.audit_log (
 id bigint generated always as identity primary key,
 organization_id uuid references public.organizations(id) on delete cascade,
 event_id uuid references public.events(id) on delete set null,
 actor_id uuid references public.profiles(id) on delete set null,
 table_name text,
 record_id text,
 operation text,
 old_data jsonb,
 new_data jsonb,
 created_at timestamptz default now()
);
alter table public.audit_log add column if not exists table_name text;
alter table public.audit_log add column if not exists record_id text;
alter table public.audit_log add column if not exists operation text;
alter table public.audit_log add column if not exists actor_id uuid;
alter table public.audit_log add column if not exists old_data jsonb;
alter table public.audit_log add column if not exists new_data jsonb;
alter table public.audit_log add column if not exists created_at timestamptz default now();
-- Copy legacy names when they exist.
do $$ begin
 if exists(select 1 from information_schema.columns where table_schema='public' and table_name='audit_log' and column_name='entity_type') then
  execute 'update public.audit_log set table_name=coalesce(table_name,entity_type) where table_name is null';
 end if;
 if exists(select 1 from information_schema.columns where table_schema='public' and table_name='audit_log' and column_name='entity_id') then
  execute 'update public.audit_log set record_id=coalesce(record_id,entity_id) where record_id is null';
 end if;
 if exists(select 1 from information_schema.columns where table_schema='public' and table_name='audit_log' and column_name='action') then
  execute 'update public.audit_log set operation=coalesce(operation,action) where operation is null';
 end if;
end $$;
update public.audit_log set table_name=coalesce(table_name,'unknown'),operation=coalesce(operation,'UNKNOWN');

create or replace function public.capture_audit_log() returns trigger language plpgsql security definer set search_path=public as $$
declare payload jsonb; org uuid; rid text;
begin
 payload:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 org:=nullif(payload->>'organization_id','')::uuid;
 rid:=coalesce(payload->>'id',payload->>'person_id',payload->>'profile_id');
 insert into public.audit_log(organization_id,actor_id,table_name,record_id,operation,old_data,new_data)
 values(org,auth.uid(),tg_table_name,rid,tg_op,case when tg_op<>'INSERT' then to_jsonb(old) end,case when tg_op<>'DELETE' then to_jsonb(new) end);
 return case when tg_op='DELETE' then old else new end;
end $$;

alter table public.audit_log enable row level security;
drop policy if exists audit_admin_read on public.audit_log;
drop policy if exists audit_log_select on public.audit_log;
create policy audit_log_select on public.audit_log for select to authenticated using(organization_id=public.current_org());
grant select on public.audit_log to authenticated;

-- Repair optional multi-role schema. VIP invitees do not require a login/profile role.
create table if not exists public.profile_roles(
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 profile_id uuid not null references public.profiles(id) on delete cascade,
 role public.app_role not null,
 created_at timestamptz not null default now(),
 unique(profile_id,role)
);
alter table public.profile_roles enable row level security;
drop policy if exists profile_roles_select on public.profile_roles;
create policy profile_roles_select on public.profile_roles for select to authenticated using(organization_id=public.current_org() and (profile_id=auth.uid() or public.app_current_role() in('admin','regcom')));
drop policy if exists profile_roles_write on public.profile_roles;
create policy profile_roles_write on public.profile_roles for all to authenticated using(organization_id=public.current_org() and public.app_current_role()='admin') with check(organization_id=public.current_org());
grant select,insert,update,delete on public.profile_roles to authenticated;

alter table public.bookings add column if not exists assigned_by_admin boolean not null default false;
alter table public.bookings add column if not exists person_id uuid references public.people_directory(id) on delete set null;
alter table public.tickets add column if not exists assigned_by_admin boolean not null default false;
alter table public.tickets add column if not exists person_id uuid references public.people_directory(id) on delete set null;

alter table public.organizations add column if not exists contact_title text default 'Contact us';
alter table public.organizations add column if not exists contact_description text;
alter table public.organizations add column if not exists contact_whatsapp text;
alter table public.organizations add column if not exists contact_email text;
alter table public.organizations add column if not exists contact_phone text;
alter table public.organizations add column if not exists address text;

-- Continuous seat serials: aisle grid positions do not consume a seat number.
with numbered as (
 select s.id,z.seat_prefix,s.row_number,
        count(*) filter(where not coalesce(s2.is_aisle,false)) over(partition by s.zone_id,s.row_number order by s.column_number rows between unbounded preceding and current row) as serial
 from public.seats s
 join public.seating_zones z on z.id=s.zone_id
 join public.seats s2 on s2.id=s.id
 where not coalesce(s.is_aisle,false)
)
update public.seats s set code=n.seat_prefix||lpad(n.row_number::text,2,'0')||'-'||lpad(n.serial::text,3,'0'),label=lpad(n.serial::text,3,'0')
from numbered n where s.id=n.id;

create index if not exists audit_log_org_created on public.audit_log(organization_id,created_at desc);
create index if not exists people_org_type_college on public.people_directory(organization_id,person_type,college_id);
create index if not exists seats_event_available_college on public.seats(event_id,status,college_id,seat_type);
notify pgrst,'reload schema';
commit;
