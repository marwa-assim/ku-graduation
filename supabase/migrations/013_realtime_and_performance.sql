-- v8.4: indexes and realtime publication for concurrent ceremony operations
create index if not exists idx_people_org_type_status on public.people_directory(organization_id,person_type,registration_status,payment_status);
create index if not exists idx_people_org_academic on public.people_directory(organization_id,college_id,degree_level_id,program_id);
create index if not exists idx_tickets_event_person on public.tickets(event_id,person_id,user_id,seat_id,status);
create index if not exists idx_bookings_event_person on public.bookings(event_id,person_id,user_id,status);
create index if not exists idx_fittings_org_person on public.fittings(organization_id,person_id,status,collected_status);
create index if not exists idx_photos_org_person on public.photo_sessions(organization_id,person_id,status);
create index if not exists idx_invitations_org_person on public.invitations(organization_id,person_id,status);
create index if not exists idx_seats_event_zone_position on public.seats(event_id,zone_id,row_number,column_number,status);

do $$
begin
  alter table public.people_directory replica identity full;
  alter table public.seats replica identity full;
  alter table public.bookings replica identity full;
  alter table public.tickets replica identity full;
  alter table public.fittings replica identity full;
  alter table public.photo_sessions replica identity full;
  alter table public.invitations replica identity full;
exception when undefined_table then null;
end $$;

do $$
declare t text;
begin
 foreach t in array array['people_directory','seats','bookings','tickets','fittings','photo_sessions','invitations','vip_assignments'] loop
  begin
   execute format('alter publication supabase_realtime add table public.%I',t);
  exception when duplicate_object then null; when undefined_table then null;
  end;
 end loop;
end $$;
notify pgrst,'reload schema';
