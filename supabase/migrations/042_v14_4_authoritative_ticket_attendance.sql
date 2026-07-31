-- V14.4: ticket scans are the sole authoritative attendance source for students and academic staff.
begin;

alter table public.entry_scans add column if not exists reversed_at timestamptz;
alter table public.entry_scans add column if not exists reversed_by uuid;
alter table public.entry_scans add column if not exists reversal_reason text;

create index if not exists idx_entry_scans_ticket_result on public.entry_scans(ticket_id,result);

create or replace function public.reset_person_attendance(
 p_person_id uuid,
 p_reason text default 'Reset by administrator'
) returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
 v_org uuid:=public.current_org();
 v_role text:=public.app_current_role();
 v_profile uuid;
 v_event uuid;
 v_count integer:=0;
begin
 if v_role<>'admin' then raise exception 'Only an administrator can reset attendance'; end if;
 if not exists(select 1 from public.people_directory where id=p_person_id and organization_id=v_org and person_type in ('student','academic_staff')) then
  raise exception 'Student or academic staff record not found';
 end if;
 select profile_id into v_profile from public.people_directory where id=p_person_id and organization_id=v_org;
 select id into v_event from public.events where organization_id=v_org order by ceremony_date desc nulls last,created_at desc limit 1;

 update public.entry_scans es
 set result='reversed',reversed_at=now(),reversed_by=auth.uid(),reversal_reason=coalesce(nullif(trim(p_reason),''),'Reset by administrator')
 from public.tickets t
 join public.seats s on s.id=t.seat_id
 where es.ticket_id=t.id
   and es.organization_id=v_org
   and es.result='accepted'
   and t.organization_id=v_org
   and (v_event is null or t.event_id=v_event)
   and s.seat_type in ('graduate','staff')
   and (t.person_id=p_person_id or (v_profile is not null and t.user_id=v_profile));
 get diagnostics v_count=row_count;

 -- Compatibility cache only. All application counts and reports must read accepted entry_scans.
 update public.people_directory
 set arrival_status='pending',arrived_at=null,arrived_by=null,updated_at=now()
 where id=p_person_id and organization_id=v_org;

 return jsonb_build_object('personId',p_person_id,'eventId',v_event,'reversedScans',v_count,'arrivalStatus','pending');
end $$;

grant execute on function public.reset_person_attendance(uuid,text) to authenticated;

-- Reconcile the legacy cache with the authoritative accepted scan records.
update public.people_directory p
set arrival_status='pending',arrived_at=null,arrived_by=null
where p.person_type in ('student','academic_staff')
  and not exists (
   select 1 from public.tickets t
   join public.seats s on s.id=t.seat_id and s.seat_type in ('graduate','staff')
   join public.entry_scans es on es.ticket_id=t.id and es.result='accepted'
   where t.organization_id=p.organization_id
     and (t.person_id=p.id or (p.profile_id is not null and t.user_id=p.profile_id))
  );

notify pgrst,'reload schema';
commit;
