-- v11 final: scanner-driven arrival synchronization for students, academic staff and VIP guests
begin;

alter table public.people_directory add column if not exists arrival_status text not null default 'pending';
alter table public.people_directory add column if not exists arrived_at timestamptz;
alter table public.people_directory add column if not exists arrived_by uuid;
alter table public.people_directory drop constraint if exists people_directory_arrival_status_check;
alter table public.people_directory add constraint people_directory_arrival_status_check check (arrival_status in ('pending','entered'));

create index if not exists idx_people_directory_arrival on public.people_directory(organization_id,person_type,arrival_status);

create or replace function public.scan_ticket(p_qr_token text,p_scanned_by uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
 t public.tickets%rowtype;
 s public.seats%rowtype;
 person_record public.people_directory%rowtype;
 existing_scan uuid;
begin
 if public.app_current_role() not in ('admin','scanner','regcom','land','vip') then
  raise exception 'Not authorized to scan tickets';
 end if;

 select * into t from public.tickets
 where qr_token=p_qr_token and organization_id=public.current_org() and status <> 'cancelled'
 limit 1 for update;
 if not found then raise exception 'Invalid or cancelled ticket'; end if;

 select * into s from public.seats where id=t.seat_id;

 select * into person_record from public.people_directory
 where organization_id=public.current_org()
   and (id=t.person_id or profile_id=t.user_id)
 order by case when id=t.person_id then 0 else 1 end
 limit 1 for update;

 select id into existing_scan from public.entry_scans
 where ticket_id=t.id and result='accepted'
 limit 1;
 if existing_scan is not null then raise exception 'Ticket has already been used'; end if;

 insert into public.entry_scans(ticket_id,scanned_by,scanned_at,result)
 values(t.id,p_scanned_by,now(),'accepted');

 if person_record.id is not null then
  update public.people_directory
  set arrival_status='entered',arrived_at=now(),arrived_by=p_scanned_by
  where id=person_record.id;
 end if;

 if s.seat_type='vip' and person_record.id is not null then
  update public.vip_assignments
  set arrival_status='arrived',updated_at=now()
  where organization_id=public.current_org()
    and event_id=t.event_id
    and person_id=person_record.id;
 end if;

 return jsonb_build_object(
  'accepted',true,
  'personName',coalesce(person_record.full_name,'Ticket holder'),
  'studentName',coalesce(person_record.full_name,'Ticket holder'),
  'personType',coalesce(person_record.person_type::text,'guest'),
  'seatCode',coalesce(s.label,s.code),
  'arrivalStatus','entered',
  'arrivedAt',now()
 );
end $$;

grant execute on function public.scan_ticket(text,uuid) to authenticated;
commit;
