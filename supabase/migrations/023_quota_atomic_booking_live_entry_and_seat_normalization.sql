-- v9.4: authoritative quota enforcement, atomic guest booking, seat-code normalization and release logic
begin;

-- Ensure every physical seat has one deterministic visible code based on its configured zone prefix, row and seat position.
create or replace function public.generate_zone_seats(p_zone_id uuid)
returns integer language plpgsql security definer set search_path=public as $$
declare z public.seating_zones%rowtype; r integer; c integer; existing_id uuid; seat_code text; seat_kind text; generated integer:=0; prefix text;
begin
 if public.app_current_role() not in ('admin') then raise exception 'Not authorized'; end if;
 select * into z from public.seating_zones where id=p_zone_id and organization_id=public.current_org() for update;
 if not found then raise exception 'Zone not found'; end if;
 prefix:=upper(coalesce(nullif(regexp_replace(trim(z.seat_prefix),'[^A-Za-z0-9]','','g'),''),'S'));
 seat_kind:=case z.zone_type when 'stage' then 'graduate' when 'staff' then 'staff' when 'vip' then 'vip' when 'paid_guest' then 'paid_guest' when 'accessible' then 'accessible' else 'free_guest' end;
 delete from public.seats where zone_id=z.id and coalesce(is_aisle,false)=true;
 delete from public.seats where zone_id=z.id and status='available'::public.seat_status and (row_number>z.rows_count or column_number>z.columns_count);
 for r in 1..z.rows_count loop
  for c in 1..z.columns_count loop
   seat_code:=prefix||'-R'||lpad(r::text,2,'0')||'-S'||lpad(c::text,3,'0');
   select id into existing_id from public.seats where zone_id=z.id and row_number=r and column_number=c and coalesce(is_aisle,false)=false order by id limit 1;
   if existing_id is null then
    insert into public.seats(organization_id,event_id,zone_id,code,label,row_number,column_number,status,section,seat_type,price_bhd,college_id,is_aisle,color,x_position,y_position)
    values(z.organization_id,z.event_id,z.id,seat_code,seat_code,r,c,'available'::public.seat_status,case when z.zone_type='stage' then 'stage' when z.zone_type='vip' then 'vip' else 'audience' end,seat_kind,z.price_bhd,z.college_id,false,z.color,c,r);
   else
    update public.seats set code=seat_code,label=seat_code,row_number=r,column_number=c,section=case when z.zone_type='stage' then 'stage' when z.zone_type='vip' then 'vip' else 'audience' end,seat_type=seat_kind,price_bhd=z.price_bhd,college_id=z.college_id,is_aisle=false,color=z.color,x_position=c,y_position=r where id=existing_id;
   end if;
   generated:=generated+1;
  end loop;
 end loop;
 return generated;
end $$;
grant execute on function public.generate_zone_seats(uuid) to authenticated;

-- Normalize all existing generated seats. Aisles are visual gaps and never consume a seat position.
update public.seats s set
 code=upper(coalesce(nullif(regexp_replace(trim(z.seat_prefix),'[^A-Za-z0-9]','','g'),''),'S'))||'-R'||lpad(s.row_number::text,2,'0')||'-S'||lpad(s.column_number::text,3,'0'),
 label=upper(coalesce(nullif(regexp_replace(trim(z.seat_prefix),'[^A-Za-z0-9]','','g'),''),'S'))||'-R'||lpad(s.row_number::text,2,'0')||'-S'||lpad(s.column_number::text,3,'0'),
 is_aisle=false
from public.seating_zones z
where s.zone_id=z.id and coalesce(s.is_aisle,false)=false and s.row_number is not null and s.column_number is not null;

-- Release any expired held booking and make its seats immediately available again.
create or replace function public.release_expired_bookings()
returns integer language plpgsql security definer set search_path=public as $$
declare n integer;
begin
 update public.seats s set status='available'::public.seat_status,held_until=null
 from public.booking_seats bs join public.bookings b on b.id=bs.booking_id
 where s.id=bs.seat_id and b.status='held'::public.booking_status and b.expires_at<now();
 update public.bookings set status='expired'::public.booking_status where status='held'::public.booking_status and expires_at<now();
 get diagnostics n=row_count; return n;
end $$;

create or replace function public.cancel_own_booking(p_booking_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
 if not exists(select 1 from public.bookings where id=p_booking_id and user_id=auth.uid() and status in ('held','confirmed')) then raise exception 'Booking not found'; end if;
 update public.tickets set status='cancelled'::public.ticket_status where booking_id=p_booking_id;
 update public.seats s set status='available'::public.seat_status,held_until=null from public.booking_seats bs where bs.booking_id=p_booking_id and bs.seat_id=s.id;
 update public.bookings set status='cancelled'::public.booking_status where id=p_booking_id;
end $$;
grant execute on function public.cancel_own_booking(uuid) to authenticated;

-- Students can reserve only guest seats and never exceed the event quotas. Row locking prevents double booking.
create or replace function public.reserve_seats(p_event_id uuid,p_seat_ids uuid[],p_user_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_booking uuid;v_total numeric(10,3);v_count int;v_free_requested int;v_paid_requested int;v_free_existing int;v_paid_existing int;v_free_quota int;v_paid_quota int;v_hold int;v_person uuid;
begin
 if auth.uid() is distinct from p_user_id then raise exception 'User mismatch'; end if;
 perform public.release_expired_bookings();
 select free_ticket_quota,paid_ticket_quota,paid_hold_minutes into v_free_quota,v_paid_quota,v_hold from public.events where id=p_event_id and status='published' and allow_guest_booking=true and (booking_deadline is null or booking_deadline>now()) for update;
 if not found then raise exception 'Guest booking is closed'; end if;
 select id into v_person from public.people_directory where profile_id=p_user_id and person_type='student' limit 1;
 if v_person is null then raise exception 'Student profile not found'; end if;
 select count(*) filter(where seat_type='free_guest'),count(*) filter(where seat_type='paid_guest'),count(*) into v_free_requested,v_paid_requested,v_count from public.seats where id=any(p_seat_ids) and event_id=p_event_id and status='available' and seat_type in ('free_guest','paid_guest') for update;
 if v_count<>cardinality(p_seat_ids) then raise exception 'One or more seats are no longer available or are not guest seats'; end if;
 select count(*) filter(where s.seat_type='free_guest'),count(*) filter(where s.seat_type='paid_guest') into v_free_existing,v_paid_existing from public.tickets t join public.seats s on s.id=t.seat_id where t.event_id=p_event_id and t.status='valid' and (t.user_id=p_user_id or t.person_id=v_person);
 if v_free_existing+v_free_requested>coalesce(v_free_quota,0) then raise exception 'Free guest ticket quota exceeded'; end if;
 if v_paid_existing+v_paid_requested>coalesce(v_paid_quota,0) then raise exception 'Paid guest ticket quota exceeded'; end if;
 if v_paid_requested>0 and not exists(select 1 from public.events where id=p_event_id and allow_paid_booking=true) then raise exception 'Paid guest booking is closed'; end if;
 insert into public.bookings(organization_id,event_id,user_id,person_id,status,expires_at,assigned_by_admin) select organization_id,id,p_user_id,v_person,'held',now()+make_interval(mins=>greatest(5,coalesce(v_hold,15))),false from public.events where id=p_event_id returning id into v_booking;
 insert into public.booking_seats(booking_id,seat_id,price_bhd) select v_booking,id,price_bhd from public.seats where id=any(p_seat_ids);
 select coalesce(sum(price_bhd),0) into v_total from public.booking_seats where booking_id=v_booking;
 update public.bookings set total_bhd=v_total where id=v_booking;
 update public.seats set status='held'::public.seat_status,held_until=now()+make_interval(mins=>greatest(5,coalesce(v_hold,15))) where id=any(p_seat_ids);
 return jsonb_build_object('booking_id',v_booking,'total_bhd',v_total);
end $$;

-- Tickets inherit the directory person so dashboards and scanners update one common live record.
create or replace function public.issue_tickets(p_booking_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
 insert into public.tickets(organization_id,event_id,user_id,person_id,seat_id,booking_id)
 select b.organization_id,b.event_id,b.user_id,b.person_id,bs.seat_id,b.id from public.bookings b join public.booking_seats bs on bs.booking_id=b.id where b.id=p_booking_id on conflict do nothing;
 update public.seats s set status='booked'::public.seat_status,held_until=null from public.booking_seats bs where bs.booking_id=p_booking_id and bs.seat_id=s.id;
 update public.bookings set status='confirmed'::public.booking_status,expires_at=null where id=p_booking_id;
end $$;

create index if not exists idx_seats_event_type_status on public.seats(event_id,seat_type,status);
create index if not exists idx_bookings_user_event_status on public.bookings(user_id,event_id,status);
create index if not exists idx_entry_scans_ticket_scanned on public.entry_scans(ticket_id,scanned_at);
commit;
