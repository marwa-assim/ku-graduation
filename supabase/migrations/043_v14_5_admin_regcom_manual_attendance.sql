-- V14.5: one authoritative attendance source with controlled manual updates.
-- Admin and Registration Committee may mark students/staff Entered or Pending.
-- Scanner entry and manual entry both write accepted records to entry_scans.
begin;

alter table public.entry_scans add column if not exists entry_method text not null default 'scanner';
alter table public.entry_scans add column if not exists attendance_note text;

alter table public.entry_scans drop constraint if exists entry_scans_entry_method_check;
alter table public.entry_scans add constraint entry_scans_entry_method_check
 check (entry_method in ('scanner','manual'));

create index if not exists idx_entry_scans_org_result_method_time
 on public.entry_scans(organization_id,result,entry_method,scanned_at desc);

create or replace function public.set_person_attendance(
 p_person_id uuid,
 p_status text,
 p_reason text default null
) returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
 v_org uuid:=public.current_org();
 v_role text:=public.app_current_role();
 v_profile uuid;
 v_person_type text;
 v_ticket public.tickets%rowtype;
 v_scan_id uuid;
 v_now timestamptz:=now();
 v_count integer:=0;
begin
 if v_role not in ('admin','regcom') then
  raise exception 'Only Admin or Registration Committee can update attendance manually';
 end if;
 if p_status not in ('pending','entered') then
  raise exception 'Attendance status must be pending or entered';
 end if;

 select profile_id,person_type into v_profile,v_person_type
 from public.people_directory
 where id=p_person_id and organization_id=v_org
   and person_type in ('student','academic_staff');
 if not found then raise exception 'Student or academic staff record not found'; end if;

 if p_status='entered' then
  select t.* into v_ticket
  from public.tickets t
  join public.seats s on s.id=t.seat_id
  left join public.events e on e.id=t.event_id
  where t.organization_id=v_org
    and coalesce(t.status,'active')<>'cancelled'
    and s.seat_type=case when v_person_type='student' then 'graduate' else 'staff' end
    and (t.person_id=p_person_id or (v_profile is not null and t.user_id=v_profile))
  order by e.ceremony_date desc nulls last,t.created_at desc
  limit 1;
  if v_ticket.id is null then
   raise exception 'A valid % ticket is required before manual entry',case when v_person_type='student' then 'graduate' else 'staff' end;
  end if;

  select id into v_scan_id from public.entry_scans
  where ticket_id=v_ticket.id and result='accepted' limit 1;

  if v_scan_id is null then
   insert into public.entry_scans(
    organization_id,ticket_id,scanned_by,scanned_at,result,entry_method,attendance_note
   ) values(
    v_org,v_ticket.id,auth.uid(),v_now,'accepted','manual',coalesce(nullif(trim(p_reason),''),'Manual entry')
   ) returning id into v_scan_id;
  end if;

  update public.people_directory
  set arrival_status='entered',arrived_at=coalesce((select scanned_at from public.entry_scans where id=v_scan_id),v_now),arrived_by=auth.uid(),updated_at=v_now
  where id=p_person_id and organization_id=v_org;

  return jsonb_build_object('personId',p_person_id,'ticketId',v_ticket.id,'scanId',v_scan_id,'arrivalStatus','entered','entryMethod','manual');
 end if;

 update public.entry_scans es
 set result='reversed',reversed_at=v_now,reversed_by=auth.uid(),
     reversal_reason=coalesce(nullif(trim(p_reason),''),'Manual reset to pending')
 from public.tickets t
 join public.seats s on s.id=t.seat_id
 where es.ticket_id=t.id
   and es.organization_id=v_org
   and es.result='accepted'
   and t.organization_id=v_org
   and s.seat_type in ('graduate','staff')
   and (t.person_id=p_person_id or (v_profile is not null and t.user_id=v_profile));
 get diagnostics v_count=row_count;

 update public.people_directory
 set arrival_status='pending',arrived_at=null,arrived_by=null,updated_at=v_now
 where id=p_person_id and organization_id=v_org;

 return jsonb_build_object('personId',p_person_id,'reversedScans',v_count,'arrivalStatus','pending','entryMethod','manual');
end $$;

grant execute on function public.set_person_attendance(uuid,text,text) to authenticated;

-- Keep the legacy reset RPC compatible, but allow both authorized operational roles.
create or replace function public.reset_person_attendance(
 p_person_id uuid,
 p_reason text default 'Manual reset to pending'
) returns jsonb
language sql
security definer
set search_path=public
as $$
 select public.set_person_attendance(p_person_id,'pending',p_reason);
$$;
grant execute on function public.reset_person_attendance(uuid,text) to authenticated;

notify pgrst,'reload schema';
commit;
