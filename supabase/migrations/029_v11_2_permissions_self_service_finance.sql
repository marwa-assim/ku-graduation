-- v11.2 permission, finance, self-service and schema compatibility
alter table if exists public.people_directory add column if not exists photo_url text;
alter table if exists public.profiles add column if not exists photo_url text;
alter table if exists public.events add column if not exists student_booking_enabled boolean not null default true;
alter table if exists public.events add column if not exists show_student_invitation boolean not null default false;
create index if not exists idx_people_org_type_name on public.people_directory(organization_id,person_type,full_name);
create index if not exists idx_tickets_org_event_person on public.tickets(organization_id,event_id,person_id);
create index if not exists idx_tickets_org_event_user on public.tickets(organization_id,event_id,user_id);
notify pgrst, 'reload schema';
