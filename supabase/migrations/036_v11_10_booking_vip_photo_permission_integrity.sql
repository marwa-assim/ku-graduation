-- v11.10: booking-seat integrity, VIP derived seating state, and stale-link cleanup.

-- Remove stale links that point to seats already marked available. Active bookings retain ownership.
delete from public.booking_seats bs
using public.seats s, public.bookings b
where bs.seat_id=s.id
  and bs.booking_id=b.id
  and s.status='available'
  and b.status in ('expired','cancelled','refunded');

-- VIP seating state is derived exclusively from whether a seat is assigned.
create or replace function public.sync_vip_seating_status()
returns trigger language plpgsql as $$
begin
  new.seating_status := case when new.seat_id is null then 'pending' else 'seated' end;
  return new;
end $$;

drop trigger if exists trg_sync_vip_seating_status on public.vip_assignments;
create trigger trg_sync_vip_seating_status
before insert or update of seat_id,seating_status on public.vip_assignments
for each row execute function public.sync_vip_seating_status();

update public.vip_assignments
set seating_status=case when seat_id is null then 'pending' else 'seated' end
where seating_status is distinct from case when seat_id is null then 'pending' else 'seated' end;

notify pgrst, 'reload schema';
