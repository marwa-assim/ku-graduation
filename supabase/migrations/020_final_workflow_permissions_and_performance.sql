-- Final workflow, compatibility, permissions and performance stabilization
begin;

-- CSV import conflict target and duplicate cleanup support
create unique index if not exists people_directory_org_reference_uq
  on public.people_directory(organization_id, reference_number)
  where reference_number is not null;
create unique index if not exists people_directory_org_email_uq
  on public.people_directory(organization_id, lower(email))
  where email is not null;

-- Directory-only people and VIP guests do not require auth users
alter table public.bookings alter column user_id drop not null;
alter table public.tickets alter column user_id drop not null;

-- Invitation compatibility
alter table public.invitations add column if not exists recipient text;
update public.invitations i set recipient=p.email
from public.people_directory p where i.person_id=p.id and i.recipient is null;
alter table public.invitations alter column recipient drop not null;
create unique index if not exists invitations_event_person_uq2 on public.invitations(event_id,person_id);

-- Faster operational pages
create index if not exists idx_people_org_type_name on public.people_directory(organization_id,person_type,full_name);
create index if not exists idx_people_org_role on public.people_directory(organization_id,role);
create index if not exists idx_seats_event_status_type on public.seats(event_id,status,seat_type,zone_id);
create index if not exists idx_tickets_event_person on public.tickets(event_id,person_id);
create index if not exists idx_vip_org_event_person on public.vip_assignments(organization_id,event_id,person_id);
create index if not exists idx_fittings_org_person on public.fittings(organization_id,person_id);
create index if not exists idx_photos_org_person on public.photo_sessions(organization_id,person_id);

-- Accurate continuous visible seat numbering; aisles do not consume a number.
create or replace function public.generate_zone_seats(p_zone_id uuid)
returns integer language plpgsql security definer set search_path=public as $$
declare z public.seating_zones%rowtype; r int; c int; serial_no int:=0; generated int:=0;
        is_aisle boolean; seat_code text; seat_kind text;
begin
 select * into z from public.seating_zones where id=p_zone_id;
 if not found then raise exception 'Seating zone not found'; end if;
 delete from public.seats where zone_id=z.id and status in ('available'::public.seat_status,'blocked'::public.seat_status);
 seat_kind:=case z.zone_type when 'graduate' then 'graduate' when 'staff' then 'staff' when 'vip' then 'vip' when 'paid_guest' then 'paid_guest' else 'free_guest' end;
 for r in 1..z.rows_count loop
  for c in 1..z.columns_count loop
   is_aisle := c=any(coalesce(z.aisle_columns,'{}'::int[]));
   if not is_aisle then
    serial_no:=serial_no+1;
    seat_code:=coalesce(nullif(trim(z.seat_prefix),''),'S')||lpad(serial_no::text,3,'0');
    insert into public.seats(organization_id,event_id,zone_id,code,row_label,row_number,column_number,status,section,seat_type,price_bhd,college_id)
    values(z.organization_id,z.event_id,z.id,seat_code,chr(64+r),r,c,'available'::public.seat_status,
      case when z.zone_type='graduate' then 'stage' when z.zone_type='vip' then 'vip' else 'audience' end,
      seat_kind,z.price_bhd,z.college_id);
    generated:=generated+1;
   end if;
  end loop;
 end loop;
 return generated;
end $$;

-- Operational RLS: one shared database source, role-restricted writes, organization-wide reads for reports.
do $$
declare t text;
begin
 foreach t in array array['people_directory','bookings','tickets','fittings','photo_sessions','vip_assignments','invitations','seats','seating_zones'] loop
  execute format('drop policy if exists %I_shared_read on public.%I',t,t);
  execute format('create policy %I_shared_read on public.%I for select to authenticated using (organization_id=public.current_org())',t,t);
 end loop;
end $$;

-- VIP committee may maintain invited VIP directory records only.
drop policy if exists people_directory_vip_committee_write on public.people_directory;
create policy people_directory_vip_committee_write on public.people_directory
for all to authenticated
using (organization_id=public.current_org() and public.app_current_role() in ('admin','regcom','vip'))
with check (organization_id=public.current_org() and public.app_current_role() in ('admin','regcom','vip'));

-- Role-limited operational writes.
drop policy if exists fittings_role_write on public.fittings;
create policy fittings_role_write on public.fittings for all to authenticated
using (organization_id=public.current_org() and public.app_current_role() in ('admin','regcom','tailor'))
with check (organization_id=public.current_org() and public.app_current_role() in ('admin','regcom','tailor'));
drop policy if exists photos_role_write on public.photo_sessions;
create policy photos_role_write on public.photo_sessions for all to authenticated
using (organization_id=public.current_org() and public.app_current_role() in ('admin','regcom','photographer'))
with check (organization_id=public.current_org() and public.app_current_role() in ('admin','regcom','photographer'));
drop policy if exists vip_role_write on public.vip_assignments;
create policy vip_role_write on public.vip_assignments for all to authenticated
using (organization_id=public.current_org() and public.app_current_role() in ('admin','vip'))
with check (organization_id=public.current_org() and public.app_current_role() in ('admin','vip'));

commit;
