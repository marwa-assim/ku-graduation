begin;

-- Release paid-seat holds immediately when payment-session creation fails.
create or replace function public.release_payment_hold(p_booking_id uuid)
returns boolean
language plpgsql
security definer
set search_path=public
as $$
declare
  v_user uuid;
begin
  select user_id into v_user from public.bookings where id=p_booking_id for update;
  if v_user is null then return false; end if;
  if auth.uid() is distinct from v_user and public.app_current_role() not in ('admin','finance') then
    raise exception 'Access denied';
  end if;
  update public.seats s
     set status='available'::public.seat_status, held_until=null
   where s.id in (select seat_id from public.booking_seats where booking_id=p_booking_id)
     and s.status='held'::public.seat_status;
  update public.bookings set status='expired'::public.booking_status where id=p_booking_id and status='held'::public.booking_status;
  delete from public.booking_seats where booking_id=p_booking_id;
  return true;
end;
$$;
grant execute on function public.release_payment_hold(uuid) to authenticated;

-- Normalize old photography scheduled rows to pending; scheduling is not a business status.
update public.photo_sessions set status='pending' where status='scheduled';

notify pgrst,'reload schema';
commit;
