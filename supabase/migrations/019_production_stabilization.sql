begin;

-- Keep legacy and current audit schemas compatible.
create table if not exists public.audit_log(
 id bigint generated always as identity primary key,
 organization_id uuid,
 event_id uuid,
 actor_id uuid,
 table_name text,
 record_id text,
 operation text,
 entity_type text,
 entity_id text,
 action text,
 old_data jsonb,
 new_data jsonb,
 created_at timestamptz default now()
);
alter table public.audit_log add column if not exists event_id uuid;
alter table public.audit_log add column if not exists actor_id uuid;
alter table public.audit_log add column if not exists table_name text;
alter table public.audit_log add column if not exists record_id text;
alter table public.audit_log add column if not exists operation text;
alter table public.audit_log add column if not exists entity_type text;
alter table public.audit_log add column if not exists entity_id text;
alter table public.audit_log add column if not exists action text;
alter table public.audit_log add column if not exists old_data jsonb;
alter table public.audit_log add column if not exists new_data jsonb;
alter table public.audit_log add column if not exists created_at timestamptz default now();
alter table public.audit_log alter column entity_type drop not null;
alter table public.audit_log alter column entity_id drop not null;
alter table public.audit_log alter column action drop not null;
update public.audit_log set
 table_name=coalesce(table_name,entity_type,'unknown'),
 entity_type=coalesce(entity_type,table_name,'unknown'),
 record_id=coalesce(record_id,entity_id),
 entity_id=coalesce(entity_id,record_id),
 operation=coalesce(operation,action,'UNKNOWN'),
 action=coalesce(action,operation,'UNKNOWN');

create or replace function public.capture_audit_log() returns trigger
language plpgsql security definer set search_path=public as $$
declare payload jsonb; org uuid; evt uuid; rid text;
begin
 payload:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 begin org:=nullif(payload->>'organization_id','')::uuid; exception when others then org:=null; end;
 begin evt:=nullif(payload->>'event_id','')::uuid; exception when others then evt:=null; end;
 rid:=coalesce(payload->>'id',payload->>'person_id',payload->>'profile_id',payload->>'booking_id');
 insert into public.audit_log(organization_id,event_id,actor_id,table_name,record_id,operation,entity_type,entity_id,action,old_data,new_data,created_at)
 values(org,evt,auth.uid(),tg_table_name,rid,tg_op,tg_table_name,rid,tg_op,case when tg_op<>'INSERT' then to_jsonb(old) end,case when tg_op<>'DELETE' then to_jsonb(new) end,now());
 return case when tg_op='DELETE' then old else new end;
end;$$;

-- Recreate triggers so every operational table uses the compatible function.
do $$ declare t text; begin
 foreach t in array array['people_directory','bookings','tickets','fittings','photo_sessions','invitations','vip_assignments','event_services','ceremony_expenses'] loop
  if to_regclass('public.'||t) is not null then
   execute format('drop trigger if exists audit_%I on public.%I',t,t);
   execute format('create trigger audit_%I after insert or update or delete on public.%I for each row execute function public.capture_audit_log()',t,t);
  end if;
 end loop;
end $$;

alter table public.audit_log enable row level security;
drop policy if exists audit_admin_read on public.audit_log;
drop policy if exists audit_log_select on public.audit_log;
create policy audit_log_select on public.audit_log for select to authenticated using(organization_id=public.current_org());
grant select on public.audit_log to authenticated;

-- Multi-role support required by user creation.
create table if not exists public.profile_roles(
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 profile_id uuid not null references public.profiles(id) on delete cascade,
 role text not null,
 created_at timestamptz default now(),
 unique(organization_id,profile_id,role)
);
alter table public.profile_roles enable row level security;
drop policy if exists profile_roles_org_access on public.profile_roles;
create policy profile_roles_org_access on public.profile_roles for all to authenticated using(organization_id=public.current_org()) with check(organization_id=public.current_org());
grant select,insert,update,delete on public.profile_roles to authenticated;

-- Organization identity/contact persistence.
alter table public.organizations add column if not exists domain text;
alter table public.organizations add column if not exists contact_email text;
alter table public.organizations add column if not exists contact_phone text;
alter table public.organizations add column if not exists address text;
alter table public.organizations add column if not exists contact_title text;
alter table public.organizations add column if not exists contact_description text;
alter table public.organizations add column if not exists contact_whatsapp text;
alter table public.organizations add column if not exists background_color text default '#0C0D11';
alter table public.organizations add column if not exists surface_color text default '#14161D';
alter table public.organizations add column if not exists accent_color text default '#D4A843';
alter table public.organizations add column if not exists timezone text default 'Asia/Bahrain';
alter table public.organizations add column if not exists locale text default 'en';

-- Invitation delivery tracking.
alter table public.people_directory add column if not exists invitation_status text default 'pending';
alter table public.people_directory add column if not exists invitation_sent_at timestamptz;
alter table public.invitation_designs add column if not exists email_subject text;
alter table public.invitation_designs add column if not exists email_body text;

-- Restore clean visible labels only. Internal unique codes are intentionally untouched.
with numbered as (
 select s.id,s.is_aisle,z.seat_prefix,s.row_number,
  count(*) filter(where not coalesce(s.is_aisle,false)) over(partition by s.zone_id,s.row_number order by s.column_number rows between unbounded preceding and current row) serial
 from public.seats s
 join public.seating_zones z on z.id=s.zone_id
 where s.row_number is not null and s.column_number is not null
)
update public.seats s set label=case when n.is_aisle then 'AISLE' else coalesce(n.seat_prefix,'S')||lpad(n.row_number::text,2,'0')||'-'||lpad(n.serial::text,3,'0') end
from numbered n where s.id=n.id;

create index if not exists audit_log_org_created on public.audit_log(organization_id,created_at desc);
notify pgrst,'reload schema';
commit;
