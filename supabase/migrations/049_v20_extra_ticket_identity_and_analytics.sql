begin;

alter table public.booking_seats add column if not exists is_extra boolean not null default false;
alter table public.tickets add column if not exists is_extra boolean not null default false;

create or replace function public.sync_ticket_extra_flag()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  select coalesce(bs.is_extra,false) into new.is_extra
  from public.booking_seats bs
  where bs.booking_id=new.booking_id and bs.seat_id=new.seat_id
  limit 1;
  new.is_extra:=coalesce(new.is_extra,false);
  return new;
end $$;

drop trigger if exists trg_sync_ticket_extra_flag on public.tickets;
create trigger trg_sync_ticket_extra_flag before insert or update of booking_id,seat_id on public.tickets
for each row execute function public.sync_ticket_extra_flag();

update public.booking_seats bs set is_extra=true
from public.bookings b, public.events e
where bs.booking_id=b.id and b.event_id=e.id
  and coalesce(bs.price_bhd,0)=coalesce(nullif(e.extra_ticket_price_bhd,0),-1)
  and coalesce(e.extra_ticket_price_bhd,0)>0;

update public.tickets t set is_extra=coalesce(bs.is_extra,false)
from public.booking_seats bs where bs.booking_id=t.booking_id and bs.seat_id=t.seat_id;

create or replace function public.reserve_seats(p_event_id uuid,p_seat_ids uuid[],p_user_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
 v_org uuid; v_person uuid; v_free_booking uuid; v_paid_booking uuid;
 v_free_requested int:=0; v_paid_requested int:=0; v_free_existing int:=0; v_paid_existing int:=0;
 v_free_quota int:=0; v_paid_quota int:=0; v_hold int:=15; v_paid_total numeric(10,3):=0; v_effective_price numeric(10,3):=0;
 v_paid_open timestamptz; v_paid_close timestamptz; v_extra_open timestamptz; v_extra_close timestamptz;
 v_normal_price numeric(10,3):=0; v_extra_price numeric(10,3):=0; v_extra_active boolean:=false;
 v_locked_count int:=0; v_seat record; v_free_ids uuid[]:='{}'; v_paid_ids uuid[]:='{}';
begin
 if auth.uid() is distinct from p_user_id then raise exception 'User mismatch'; end if;
 perform public.release_expired_bookings();
 select organization_id,free_ticket_quota,paid_ticket_quota,paid_hold_minutes,paid_booking_open_at,paid_booking_close_at,extra_ticket_open_at,extra_ticket_close_at,paid_ticket_price_bhd,extra_ticket_price_bhd
 into v_org,v_free_quota,v_paid_quota,v_hold,v_paid_open,v_paid_close,v_extra_open,v_extra_close,v_normal_price,v_extra_price
 from public.events where id=p_event_id and status='published' and allow_guest_booking=true and (booking_deadline is null or booking_deadline>now()) for update;
 if not found then raise exception 'Guest booking is closed'; end if;
 v_extra_active:=v_extra_open is not null and now()>=v_extra_open and (v_extra_close is null or now()<=v_extra_close);
 select id into v_person from public.people_directory where profile_id=p_user_id and organization_id=v_org and person_type='student' limit 1;
 if v_person is null then raise exception 'Student profile not found'; end if;
 delete from public.booking_seats bs using public.bookings b where bs.booking_id=b.id and bs.seat_id=any(p_seat_ids) and b.status in ('expired','cancelled');
 for v_seat in select id,seat_type,coalesce(price_bhd,0) price_bhd,status from public.seats where id=any(p_seat_ids) and event_id=p_event_id order by id for update loop
  v_locked_count:=v_locked_count+1;
  if v_seat.seat_type not in ('free_guest','paid_guest') then raise exception 'Only guest seats can be booked'; end if;
  if v_seat.status<>'available' then raise exception 'One or more seats are no longer available'; end if;
  if exists(select 1 from public.booking_seats bs join public.bookings b on b.id=bs.booking_id where bs.seat_id=v_seat.id and b.status in ('confirmed','held')) then raise exception 'One or more seats are already linked to an active booking'; end if;
  if v_seat.seat_type='free_guest' then v_free_requested:=v_free_requested+1;v_free_ids:=array_append(v_free_ids,v_seat.id);
  else
   if v_extra_active then v_effective_price:=coalesce(nullif(v_extra_price,0),v_normal_price,0);
   elsif (v_paid_open is null or now()>=v_paid_open) and (v_paid_close is null or now()<=v_paid_close) then v_effective_price:=coalesce(v_normal_price,0);
   else raise exception 'Paid guest booking is not currently open'; end if;
   v_paid_requested:=v_paid_requested+1;v_paid_ids:=array_append(v_paid_ids,v_seat.id);v_paid_total:=v_paid_total+v_effective_price;
  end if;
 end loop;
 if v_locked_count<>cardinality(p_seat_ids) then raise exception 'One or more selected seats do not exist'; end if;
 select count(*) filter(where s.seat_type='free_guest'),count(*) filter(where s.seat_type='paid_guest') into v_free_existing,v_paid_existing
 from public.tickets t join public.seats s on s.id=t.seat_id where t.event_id=p_event_id and t.status='valid' and (t.user_id=p_user_id or t.person_id=v_person);
 if v_free_existing+v_free_requested>coalesce(v_free_quota,0) then raise exception 'Free guest ticket quota exceeded'; end if;
 if not v_extra_active and v_paid_existing+v_paid_requested>coalesce(v_paid_quota,0) then raise exception 'Paid guest ticket quota exceeded'; end if;
 if v_paid_requested>0 and not exists(select 1 from public.events where id=p_event_id and allow_paid_booking=true) then raise exception 'Paid guest booking is closed'; end if;
 if v_free_requested>0 then
  insert into public.bookings(organization_id,event_id,user_id,person_id,status,total_bhd,expires_at,assigned_by_admin) values(v_org,p_event_id,p_user_id,v_person,'confirmed',0,null,false) returning id into v_free_booking;
  insert into public.booking_seats(booking_id,seat_id,price_bhd,is_extra) select v_free_booking,id,0,false from public.seats where id=any(v_free_ids);
  insert into public.tickets(organization_id,event_id,user_id,person_id,seat_id,booking_id,status,is_extra) select v_org,p_event_id,p_user_id,v_person,id,v_free_booking,'valid',false from public.seats where id=any(v_free_ids) on conflict do nothing;
  update public.seats set status='booked',held_until=null where id=any(v_free_ids);
 end if;
 if v_paid_requested>0 then
  insert into public.bookings(organization_id,event_id,user_id,person_id,status,total_bhd,expires_at,assigned_by_admin) values(v_org,p_event_id,p_user_id,v_person,'held',v_paid_total,now()+make_interval(mins=>greatest(5,coalesce(v_hold,15))),false) returning id into v_paid_booking;
  insert into public.booking_seats(booking_id,seat_id,price_bhd,is_extra) select v_paid_booking,id,v_effective_price,v_extra_active from public.seats where id=any(v_paid_ids);
  update public.seats set status='held',held_until=now()+make_interval(mins=>greatest(5,coalesce(v_hold,15))) where id=any(v_paid_ids);
 end if;
 return jsonb_build_object('free_booking_id',v_free_booking,'paid_booking_id',v_paid_booking,'booking_id',coalesce(v_paid_booking,v_free_booking),'total_bhd',v_paid_total,'free_count',v_free_requested,'paid_count',v_paid_requested,'extra_booking',v_extra_active);
end $$;
grant execute on function public.reserve_seats(uuid,uuid[],uuid) to authenticated;
notify pgrst,'reload schema';
commit;
