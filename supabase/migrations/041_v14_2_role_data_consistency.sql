-- V14.2: consistent read access for live operational data across authorized roles
begin;

-- These policies do not alter write permissions. They only ensure each authorized
-- operational role reads the same organization-scoped source records used by admin.
alter table public.people_directory enable row level security;
alter table public.tickets enable row level security;
alter table public.seats enable row level security;
alter table public.fittings enable row level security;
alter table public.photo_sessions enable row level security;
alter table public.invitations enable row level security;
alter table public.vip_assignments enable row level security;

-- Additive role-consistent read policies. Existing tenant policies remain valid.
drop policy if exists v14_2_people_operational_read on public.people_directory;
create policy v14_2_people_operational_read on public.people_directory for select to authenticated
using (organization_id=public.current_org() and public.app_current_role() in ('admin','regcom','scanner','land','finance','vip','tailor','photographer'));

drop policy if exists v14_2_tickets_operational_read on public.tickets;
create policy v14_2_tickets_operational_read on public.tickets for select to authenticated
using (organization_id=public.current_org() and public.app_current_role() in ('admin','regcom','scanner','land','finance','vip'));

drop policy if exists v14_2_seats_operational_read on public.seats;
create policy v14_2_seats_operational_read on public.seats for select to authenticated
using (organization_id=public.current_org() and public.app_current_role() in ('admin','regcom','scanner','land','finance','vip'));

drop policy if exists v14_2_fittings_operational_read on public.fittings;
create policy v14_2_fittings_operational_read on public.fittings for select to authenticated
using (organization_id=public.current_org() and public.app_current_role() in ('admin','regcom','scanner','land','tailor'));

drop policy if exists v14_2_photos_operational_read on public.photo_sessions;
create policy v14_2_photos_operational_read on public.photo_sessions for select to authenticated
using (organization_id=public.current_org() and public.app_current_role() in ('admin','regcom','scanner','land','photographer'));

drop policy if exists v14_2_invitations_operational_read on public.invitations;
create policy v14_2_invitations_operational_read on public.invitations for select to authenticated
using (organization_id=public.current_org() and public.app_current_role() in ('admin','regcom','scanner','land'));

drop policy if exists v14_2_vip_operational_read on public.vip_assignments;
create policy v14_2_vip_operational_read on public.vip_assignments for select to authenticated
using (organization_id=public.current_org() and public.app_current_role() in ('admin','regcom','scanner','land','vip'));

-- Enable live refresh for all operational sources used by dashboard and reports.
do $$
declare t text;
begin
 foreach t in array array['people_directory','tickets','seats','fittings','photo_sessions','invitations','vip_assignments'] loop
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
   execute format('alter publication supabase_realtime add table public.%I',t);
  end if;
 end loop;
end $$;

notify pgrst,'reload schema';
commit;
