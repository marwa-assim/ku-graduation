-- v11.11: reconcile stale seat status and allow controlled audit-log cleanup.

create or replace function public.reconcile_event_seat_statuses(p_event_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_changed integer := 0;
begin
  select organization_id into v_org
  from public.events
  where id = p_event_id;

  if v_org is null then
    raise exception 'Event not found';
  end if;

  if v_org <> public.current_org() then
    raise exception 'Access denied';
  end if;

  -- A VIP assignment is the source of truth for VIP occupancy.
  update public.seats s
     set status = 'booked'::public.seat_status
   where s.event_id = p_event_id
     and coalesce(s.is_aisle,false) = false
     and exists (
       select 1 from public.vip_assignments va
       where va.event_id = s.event_id and va.seat_id = s.id
     )
     and s.status is distinct from 'booked'::public.seat_status;
  get diagnostics v_changed = row_count;

  -- Valid tickets are also authoritative booked-seat records.
  update public.seats s
     set status = 'booked'::public.seat_status
   where s.event_id = p_event_id
     and coalesce(s.is_aisle,false) = false
     and exists (
       select 1 from public.tickets t
       where t.event_id = s.event_id
         and t.seat_id = s.id
         and t.status = 'valid'
     )
     and s.status is distinct from 'booked'::public.seat_status;
  v_changed := v_changed + row_count;

  -- Active payment holds remain held only while the booking is genuinely held.
  update public.seats s
     set status = 'held'::public.seat_status
   where s.event_id = p_event_id
     and coalesce(s.is_aisle,false) = false
     and not exists (select 1 from public.vip_assignments va where va.event_id=s.event_id and va.seat_id=s.id)
     and not exists (select 1 from public.tickets t where t.event_id=s.event_id and t.seat_id=s.id and t.status='valid')
     and exists (
       select 1
       from public.booking_seats bs
       join public.bookings b on b.id = bs.booking_id
       where bs.seat_id = s.id
         and b.event_id = s.event_id
         and b.status = 'held'
         and (b.hold_expires_at is null or b.hold_expires_at > now())
     )
     and s.status is distinct from 'held'::public.seat_status;
  v_changed := v_changed + row_count;

  -- Any seat with no real assignment, valid ticket, or active hold is available.
  update public.seats s
     set status = 'available'::public.seat_status
   where s.event_id = p_event_id
     and coalesce(s.is_aisle,false) = false
     and s.status <> 'blocked'::public.seat_status
     and not exists (select 1 from public.vip_assignments va where va.event_id=s.event_id and va.seat_id=s.id)
     and not exists (select 1 from public.tickets t where t.event_id=s.event_id and t.seat_id=s.id and t.status='valid')
     and not exists (
       select 1
       from public.booking_seats bs
       join public.bookings b on b.id = bs.booking_id
       where bs.seat_id = s.id
         and b.event_id = s.event_id
         and b.status = 'held'
         and (b.hold_expires_at is null or b.hold_expires_at > now())
     )
     and s.status is distinct from 'available'::public.seat_status;
  v_changed := v_changed + row_count;

  return v_changed;
end;
$$;

grant execute on function public.reconcile_event_seat_statuses(uuid) to authenticated;

-- Keep VIP seat state synchronized even when assignments are changed outside the UI.
create or replace function public.sync_vip_seat_status()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if tg_op in ('UPDATE','DELETE') and old.seat_id is not null then
    update public.seats s
       set status='available'::public.seat_status
     where s.id=old.seat_id
       and not exists (select 1 from public.vip_assignments va where va.seat_id=s.id and va.id is distinct from old.id)
       and not exists (select 1 from public.tickets t where t.seat_id=s.id and t.status='valid');
  end if;

  if tg_op in ('INSERT','UPDATE') and new.seat_id is not null then
    update public.seats set status='booked'::public.seat_status where id=new.seat_id;
    new.seating_status := 'seated';
  elsif tg_op in ('INSERT','UPDATE') then
    new.seating_status := 'pending';
  end if;

  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_vip_seat_status on public.vip_assignments;
create trigger trg_sync_vip_seat_status
before insert or update or delete on public.vip_assignments
for each row execute function public.sync_vip_seat_status();

-- Admin-controlled audit deletion.
drop policy if exists audit_log_delete_admin on public.audit_log;
create policy audit_log_delete_admin on public.audit_log
for delete to authenticated
using (
  organization_id = public.current_org()
  and public.app_current_role() = 'admin'
);
grant delete on public.audit_log to authenticated;

-- One-time correction for existing stale seats.
update public.seats s
set status = 'available'::public.seat_status
where coalesce(s.is_aisle,false)=false
  and s.status in ('booked'::public.seat_status,'held'::public.seat_status)
  and not exists (select 1 from public.vip_assignments va where va.event_id=s.event_id and va.seat_id=s.id)
  and not exists (select 1 from public.tickets t where t.event_id=s.event_id and t.seat_id=s.id and t.status='valid')
  and not exists (
    select 1 from public.booking_seats bs
    join public.bookings b on b.id=bs.booking_id
    where bs.seat_id=s.id and b.event_id=s.event_id and b.status='held'
      and (b.hold_expires_at is null or b.hold_expires_at>now())
  );
