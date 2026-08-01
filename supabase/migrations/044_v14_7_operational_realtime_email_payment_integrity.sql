begin;

-- VIP arrival audit details used by reports and exports.
alter table public.vip_assignments add column if not exists arrived_at timestamptz;
update public.vip_assignments
set arrived_at=coalesce(arrived_at,updated_at,now())
where arrival_status in ('arrived','entered') and arrived_at is null;

create or replace function public.sync_vip_operational_state()
returns trigger language plpgsql set search_path=public as $$
begin
  new.seating_status:=case when new.seat_id is null then 'pending' else 'seated' end;
  if new.arrival_status in ('arrived','entered') then
    new.arrived_at:=coalesce(new.arrived_at,now());
  else
    new.arrived_at:=null;
  end if;
  return new;
end $$;
drop trigger if exists trg_sync_vip_operational_state on public.vip_assignments;
create trigger trg_sync_vip_operational_state before insert or update on public.vip_assignments
for each row execute function public.sync_vip_operational_state();

-- Photography and delivery are independent operational statuses.
alter table public.photo_sessions add column if not exists delivery_status text not null default 'pending';
alter table public.photo_sessions add column if not exists photographed_at timestamptz;
alter table public.photo_sessions add column if not exists delivered_at timestamptz;
alter table public.photo_sessions drop constraint if exists photo_sessions_delivery_status_check;
alter table public.photo_sessions add constraint photo_sessions_delivery_status_check check (delivery_status in ('pending','delivered'));
update public.photo_sessions set delivery_status='delivered',delivered_at=coalesce(delivered_at,updated_at,now()),status='photographed'
where status='delivered';
update public.photo_sessions set photographed_at=coalesce(photographed_at,updated_at,now()) where status='photographed';

create or replace function public.sync_photo_operational_times()
returns trigger language plpgsql set search_path=public as $$
begin
 if new.status='photographed' and (tg_op='INSERT' or old.status is distinct from new.status) then new.photographed_at:=coalesce(new.photographed_at,now()); end if;
 if new.status<>'photographed' then new.photographed_at:=null; end if;
 if new.delivery_status='delivered' and (tg_op='INSERT' or old.delivery_status is distinct from new.delivery_status) then new.delivered_at:=coalesce(new.delivered_at,now()); end if;
 if new.delivery_status<>'delivered' then new.delivered_at:=null; end if;
 return new;
end $$;
drop trigger if exists trg_sync_photo_operational_times on public.photo_sessions;
create trigger trg_sync_photo_operational_times before insert or update on public.photo_sessions
for each row execute function public.sync_photo_operational_times();


-- Admin-configurable invitation email typography.
alter table public.invitation_designs add column if not exists email_font_family text default 'Arial';
alter table public.invitation_designs add column if not exists email_font_size integer default 16;
alter table public.invitation_designs add column if not exists email_text_color text default '#111827';
alter table public.invitation_designs add column if not exists email_bold boolean default false;

-- Correct the legacy booking_status enum comparison. booking_status supports only held/confirmed/expired/cancelled.
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
 into v_org,v_free_quota,v_paid_quota,v_hold from public.events
 where id=p_event_id and status='published' and allow_guest_booking=true
 and (booking_deadline is null or booking_deadline>now()) for update;
 if not found then raise exception 'Guest booking is closed'; end if;
 select id into v_person from public.people_directory where profile_id=p_user_id and organization_id=v_org and person_type='student' limit 1;
 if v_person is null then raise exception 'Student profile not found'; end if;

 delete from public.booking_seats bs using public.bookings b
 where bs.booking_id=b.id and bs.seat_id=any(p_seat_ids) and b.status in ('expired','cancelled');

 for v_seat in select id,seat_type,coalesce(price_bhd,0) price_bhd,status from public.seats
  where id=any(p_seat_ids) and event_id=p_event_id order by id for update
 loop
  v_locked_count:=v_locked_count+1;
  if v_seat.seat_type not in ('free_guest','paid_guest') then raise exception 'Only guest seats can be booked'; end if;
  if v_seat.status<>'available' then raise exception 'One or more seats are no longer available'; end if;
  if exists(select 1 from public.booking_seats bs join public.bookings b on b.id=bs.booking_id where bs.seat_id=v_seat.id and b.status in ('confirmed','held')) then raise exception 'One or more seats are already linked to an active booking'; end if;
  if v_seat.seat_type='free_guest' then v_free_requested:=v_free_requested+1;v_free_ids:=array_append(v_free_ids,v_seat.id);
  else v_paid_requested:=v_paid_requested+1;v_paid_ids:=array_append(v_paid_ids,v_seat.id);v_paid_total:=v_paid_total+v_seat.price_bhd;end if;
 end loop;
 if v_locked_count<>cardinality(p_seat_ids) then raise exception 'One or more selected seats do not exist'; end if;
 select count(*) filter(where s.seat_type='free_guest'),count(*) filter(where s.seat_type='paid_guest') into v_free_existing,v_paid_existing
 from public.tickets t join public.seats s on s.id=t.seat_id where t.event_id=p_event_id and t.status='valid' and (t.user_id=p_user_id or t.person_id=v_person);
 if v_free_existing+v_free_requested>coalesce(v_free_quota,0) then raise exception 'Free guest ticket quota exceeded'; end if;
 if v_paid_existing+v_paid_requested>coalesce(v_paid_quota,0) then raise exception 'Paid guest ticket quota exceeded'; end if;
 if v_paid_requested>0 and not exists(select 1 from public.events where id=p_event_id and allow_paid_booking=true) then raise exception 'Paid guest booking is closed'; end if;
 if v_free_requested>0 then
  insert into public.bookings(organization_id,event_id,user_id,person_id,status,total_bhd,expires_at,assigned_by_admin) values(v_org,p_event_id,p_user_id,v_person,'confirmed',0,null,false) returning id into v_free_booking;
  insert into public.booking_seats(booking_id,seat_id,price_bhd) select v_free_booking,id,0 from public.seats where id=any(v_free_ids);
  insert into public.tickets(organization_id,event_id,user_id,person_id,seat_id,booking_id,status) select v_org,p_event_id,p_user_id,v_person,id,v_free_booking,'valid' from public.seats where id=any(v_free_ids) on conflict do nothing;
  update public.seats set status='booked',held_until=null where id=any(v_free_ids);
 end if;
 if v_paid_requested>0 then
  insert into public.bookings(organization_id,event_id,user_id,person_id,status,total_bhd,expires_at,assigned_by_admin) values(v_org,p_event_id,p_user_id,v_person,'held',v_paid_total,now()+make_interval(mins=>greatest(5,coalesce(v_hold,15))),false) returning id into v_paid_booking;
  insert into public.booking_seats(booking_id,seat_id,price_bhd) select v_paid_booking,id,coalesce(price_bhd,0) from public.seats where id=any(v_paid_ids);
  update public.seats set status='held',held_until=now()+make_interval(mins=>greatest(5,coalesce(v_hold,15))) where id=any(v_paid_ids);
 end if;
 return jsonb_build_object('free_booking_id',v_free_booking,'paid_booking_id',v_paid_booking,'booking_id',coalesce(v_paid_booking,v_free_booking),'total_bhd',v_paid_total,'free_count',v_free_requested,'paid_count',v_paid_requested);
end $$;
grant execute on function public.reserve_seats(uuid,uuid[],uuid) to authenticated;

-- Realtime publication is idempotent when guarded.
do $$ begin
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='vip_assignments') then alter publication supabase_realtime add table public.vip_assignments; end if;
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='photo_sessions') then alter publication supabase_realtime add table public.photo_sessions; end if;
end $$;

notify pgrst,'reload schema';
commit;
