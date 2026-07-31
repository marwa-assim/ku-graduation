begin;

-- One clear fitting workflow: pending or fitted only.
update public.fittings set status='fitted' where status in ('measured','ready');
alter table public.fittings drop constraint if exists fittings_status_check;
alter table public.fittings add constraint fittings_status_check check(status in ('pending','fitted'));

-- Invitation email customization and delivery evidence.
alter table public.invitation_designs add column if not exists email_subject text default 'Invitation to {{event}}';
alter table public.invitation_designs add column if not exists email_body text default 'Dear {{name}},\n\nPlease find your personalized invitation attached.\n\nDate: {{date}}\nTime: {{time}}\nVenue: {{venue}}\nDirections: {{gps_link}}';
alter table public.people_directory add column if not exists invitation_status text not null default 'pending';
alter table public.people_directory add column if not exists invitation_sent_at timestamptz;
alter table public.bookings add column if not exists confirmation_email_sent_at timestamptz;

-- Guarantee invitation upsert can update the same student/event record.
do $$ begin
 if not exists(select 1 from pg_constraint where conname='invitations_event_person_unique') then
  alter table public.invitations add constraint invitations_event_person_unique unique(event_id,person_id);
 end if;
exception when duplicate_object then null; end $$;

-- Read-only audit visibility for every authenticated member of the same organization.
drop policy if exists audit_admin_read on public.audit_log;
drop policy if exists audit_log_select on public.audit_log;
create policy audit_log_select on public.audit_log for select to authenticated using(organization_id=public.current_org());
grant select on public.audit_log to authenticated;

notify pgrst,'reload schema';
commit;
