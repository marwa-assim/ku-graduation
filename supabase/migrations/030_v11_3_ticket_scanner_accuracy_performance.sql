-- v11.3 accuracy, scan integrity and query performance
begin;
alter table public.people_directory add column if not exists photo_url text;
create unique index if not exists uq_entry_scans_one_accepted_per_ticket on public.entry_scans(ticket_id) where result='accepted';
create index if not exists idx_tickets_org_event_status_seat on public.tickets(organization_id,event_id,status,seat_id);
create index if not exists idx_bookings_org_event_person_status on public.bookings(organization_id,event_id,person_id,status);
create index if not exists idx_seats_org_event_type_status on public.seats(organization_id,event_id,seat_type,status);
create index if not exists idx_people_org_profile on public.people_directory(organization_id,profile_id);
notify pgrst, 'reload schema';
commit;
