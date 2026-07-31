begin;

-- Go-live repair: reserve each physical seat row before counting it. This removes
-- PostgreSQL's "FOR UPDATE is not allowed with aggregate functions" failure.
-- Free seats are confirmed immediately; paid seats are held independently.
create or replace function public.reserve_seats(p_event_id uuid,p_seat_ids uuid[],p_user_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
 v_org uuid; v_person uuid; v_free_booking uuid; v_paid_booking uuid;
 v_free_requested int:=0; v_paid_requested int:=0; v_free_existing int:=0; v_paid_existing int:=0;
 v_free_quota int:=0; v_paid_quota int:=0; v_hold int:=15; v_paid_total numeric(10,3):=0;
 v_locked_count int:=0; v_seat record; v_free_ids uuid[]:='{}'; v_paid_ids uuid[]:='{}';
begin
 if auth.uid() is distinct from p_user_id then raise exception 'User mismatch'; end if;
 perform public.release_expired_bookings();
 select organization_id,free_ticket_quota,paid_ticket_quota,paid_hold_minutes
 into v_org,v_free_quota,v_paid_quota,v_hold
 from public.events
 where id=p_event_id and status='published' and allow_guest_booking=true
   and (booking_deadline is null or booking_deadline>now())
 for update;
 if not found then raise exception 'Guest booking is closed'; end if;

 select id into v_person from public.people_directory
 where profile_id=p_user_id and organization_id=v_org and person_type='student' limit 1;
 if v_person is null then raise exception 'Student profile not found'; end if;

 for v_seat in
  select id,seat_type,coalesce(price_bhd,0) price_bhd
  from public.seats
  where id=any(p_seat_ids) and event_id=p_event_id
  order by id
  for update
 loop
  v_locked_count:=v_locked_count+1;
  if v_seat.seat_type not in ('free_guest','paid_guest') then raise exception 'Only guest seats can be booked'; end if;
  if exists(select 1 from public.seats where id=v_seat.id and status<>'available') then raise exception 'One or more seats are no longer available'; end if;
  if v_seat.seat_type='free_guest' then
   v_free_requested:=v_free_requested+1; v_free_ids:=array_append(v_free_ids,v_seat.id);
  else
   v_paid_requested:=v_paid_requested+1; v_paid_ids:=array_append(v_paid_ids,v_seat.id); v_paid_total:=v_paid_total+v_seat.price_bhd;
  end if;
 end loop;
 if v_locked_count<>cardinality(p_seat_ids) then raise exception 'One or more selected seats do not exist'; end if;

 select count(*) filter(where s.seat_type='free_guest'),count(*) filter(where s.seat_type='paid_guest')
 into v_free_existing,v_paid_existing
 from public.tickets t join public.seats s on s.id=t.seat_id
 where t.event_id=p_event_id and t.status='valid' and (t.user_id=p_user_id or t.person_id=v_person);

 if v_free_existing+v_free_requested>coalesce(v_free_quota,0) then raise exception 'Free guest ticket quota exceeded'; end if;
 if v_paid_existing+v_paid_requested>coalesce(v_paid_quota,0) then raise exception 'Paid guest ticket quota exceeded'; end if;
 if v_paid_requested>0 and not exists(select 1 from public.events where id=p_event_id and allow_paid_booking=true) then raise exception 'Paid guest booking is closed'; end if;

 if v_free_requested>0 then
  insert into public.bookings(organization_id,event_id,user_id,person_id,status,total_bhd,expires_at,assigned_by_admin)
  values(v_org,p_event_id,p_user_id,v_person,'confirmed',0,null,false) returning id into v_free_booking;
  insert into public.booking_seats(booking_id,seat_id,price_bhd) select v_free_booking,id,0 from public.seats where id=any(v_free_ids);
  insert into public.tickets(organization_id,event_id,user_id,person_id,seat_id,booking_id,status)
  select v_org,p_event_id,p_user_id,v_person,id,v_free_booking,'valid' from public.seats where id=any(v_free_ids)
  on conflict do nothing;
  update public.seats set status='booked',held_until=null where id=any(v_free_ids);
 end if;

 if v_paid_requested>0 then
  insert into public.bookings(organization_id,event_id,user_id,person_id,status,total_bhd,expires_at,assigned_by_admin)
  values(v_org,p_event_id,p_user_id,v_person,'held',v_paid_total,now()+make_interval(mins=>greatest(5,coalesce(v_hold,15))),false)
  returning id into v_paid_booking;
  insert into public.booking_seats(booking_id,seat_id,price_bhd) select v_paid_booking,id,coalesce(price_bhd,0) from public.seats where id=any(v_paid_ids);
  update public.seats set status='held',held_until=now()+make_interval(mins=>greatest(5,coalesce(v_hold,15))) where id=any(v_paid_ids);
 end if;

 return jsonb_build_object('free_booking_id',v_free_booking,'paid_booking_id',v_paid_booking,'booking_id',coalesce(v_paid_booking,v_free_booking),'total_bhd',v_paid_total,'free_count',v_free_requested,'paid_count',v_paid_requested);
end $$;
grant execute on function public.reserve_seats(uuid,uuid[],uuid) to authenticated;

-- Keep profile-only committee accounts out of the directory only when explicitly deleted.
-- Directory rows linked to an auth profile remain unique and queryable.
create unique index if not exists ux_people_directory_profile_org
on public.people_directory(organization_id,profile_id) where profile_id is not null;

-- Fast and accurate operational counts.
create index if not exists idx_tickets_org_event_person_status on public.tickets(organization_id,event_id,person_id,status);
create index if not exists idx_tickets_org_event_user_status on public.tickets(organization_id,event_id,user_id,status);
create index if not exists idx_people_org_type_profile on public.people_directory(organization_id,person_type,profile_id);

notify pgrst,'reload schema';
commit;
