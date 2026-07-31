-- Run this migration as a standalone script. It is intentionally not wrapped in one transaction
-- because PostgreSQL enum values must be committed before they can be used safely.
do $$ begin
  alter type public.app_role add value if not exists 'academic_staff';
exception when duplicate_object then null; end $$;

alter table public.bookings add column if not exists assigned_by_admin boolean not null default false;
alter table public.bookings add column if not exists person_id uuid references public.people_directory(id) on delete set null;
alter table public.tickets add column if not exists assigned_by_admin boolean not null default false;
alter table public.tickets add column if not exists person_id uuid references public.people_directory(id) on delete set null;
alter table public.organizations add column if not exists contact_title text default 'Contact us';
alter table public.organizations add column if not exists contact_description text;
alter table public.organizations add column if not exists contact_whatsapp text;

-- Allow the measured status when an older fittings check constraint exists.
do $$ declare r record; begin
 for r in select conname from pg_constraint where conrelid='public.fittings'::regclass and contype='c' and pg_get_constraintdef(oid) ilike '%status%' loop
   execute format('alter table public.fittings drop constraint if exists %I',r.conname);
 end loop;
 alter table public.fittings add constraint fittings_status_check check(status in ('pending','measured','fitted','ready'));
exception when duplicate_object then null; end $$;

-- Audit trail for operational transactions.
create table if not exists public.audit_log(
 id uuid primary key default gen_random_uuid(), organization_id uuid, actor_id uuid,
 table_name text not null, record_id text, operation text not null,
 old_data jsonb, new_data jsonb, created_at timestamptz not null default now()
);
alter table public.audit_log enable row level security;
drop policy if exists audit_log_select on public.audit_log;
create policy audit_log_select on public.audit_log for select to authenticated using(organization_id=public.current_org() and public.app_current_role() in ('admin','finance','regcom'));
grant select on public.audit_log to authenticated;
create or replace function public.capture_audit_log() returns trigger language plpgsql security definer set search_path=public as $$
declare org uuid; rid text; begin
 org:=coalesce((to_jsonb(new)->>'organization_id')::uuid,(to_jsonb(old)->>'organization_id')::uuid);
 rid:=coalesce(to_jsonb(new)->>'id',to_jsonb(old)->>'id');
 insert into public.audit_log(organization_id,actor_id,table_name,record_id,operation,old_data,new_data)
 values(org,auth.uid(),tg_table_name,rid,tg_op,case when tg_op<>'INSERT' then to_jsonb(old) end,case when tg_op<>'DELETE' then to_jsonb(new) end);
 return coalesce(new,old); end $$;
do $$ declare t text; begin
 foreach t in array array['people_directory','bookings','tickets','fittings','photo_sessions','vip_assignments','ceremony_expenses','revenue_adjustments','invitations'] loop
   execute format('drop trigger if exists audit_%I on public.%I',t,t);
   execute format('create trigger audit_%I after insert or update or delete on public.%I for each row execute function public.capture_audit_log()',t,t);
 end loop;
end $$;

-- Aisle positions remain visual gaps. Seat serials count only real seats and remain continuous.
create or replace function public.generate_zone_seats(p_zone_id uuid) returns integer language plpgsql security definer set search_path=public as $$
declare z public.seating_zones%rowtype; r integer; c integer; seat_no integer; is_gap boolean; code_value text; total integer:=0; begin
 select * into z from public.seating_zones where id=p_zone_id; if not found then raise exception 'Zone not found'; end if;
 delete from public.seats where zone_id=z.id and status in ('available','blocked');
 for r in 1..z.rows_count loop
   seat_no:=0;
   for c in 1..z.columns_count loop
     is_gap:=coalesce(c=any(coalesce(z.aisle_columns,'{}'::integer[])),false);
     if is_gap then
       code_value:='AISLE-'||z.id::text||'-'||r||'-'||c;
       insert into public.seats(organization_id,event_id,zone_id,code,label,section,seat_type,price_bhd,status,row_number,column_number,color,college_id,is_aisle,x_position,y_position)
       values(z.organization_id,z.event_id,z.id,code_value,'',z.name,z.zone_type,0,'blocked',r,c,z.color,z.college_id,true,c,r)
       on conflict(event_id,code) do update set is_aisle=true,status='blocked',label='';
     else
       seat_no:=seat_no+1;
       code_value:=z.seat_prefix||lpad(r::text,greatest(2,length(z.rows_count::text)),'0')||'-'||lpad(seat_no::text,greatest(3,length((z.columns_count-coalesce(array_length(z.aisle_columns,1),0))::text)),'0');
       insert into public.seats(organization_id,event_id,zone_id,code,label,section,seat_type,price_bhd,status,row_number,column_number,color,college_id,is_aisle,x_position,y_position)
       values(z.organization_id,z.event_id,z.id,code_value,code_value,z.name,z.zone_type,z.price_bhd,case when z.zone_type='blocked' then 'blocked' else 'available' end,r,c,z.color,z.college_id,false,c,r)
       on conflict(event_id,code) do update set zone_id=excluded.zone_id,label=excluded.label,section=excluded.section,seat_type=excluded.seat_type,price_bhd=excluded.price_bhd,row_number=excluded.row_number,column_number=excluded.column_number,color=excluded.color,college_id=excluded.college_id,is_aisle=false,x_position=excluded.x_position,y_position=excluded.y_position;
       total:=total+1;
     end if;
   end loop;
 end loop;
 return total; end $$;
grant execute on function public.generate_zone_seats(uuid) to authenticated;

-- Ensure invitation upsert can identify one record per event/person.
create unique index if not exists invitations_event_person_uq on public.invitations(event_id,person_id);
create index if not exists audit_log_org_created on public.audit_log(organization_id,created_at desc);
notify pgrst,'reload schema';
