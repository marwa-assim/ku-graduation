-- v11.9: fix invalid booking_status='failed', release failed paid holds safely.
create or replace function public.process_payment_webhook(
  p_booking_id uuid,
  p_transaction_id text,
  p_status text
) returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_status text := lower(coalesce(p_status,''));
begin
  update public.payments
  set status = case
      when v_status='paid' then 'paid'::public.payment_status
      when v_status in ('failed','expired','invalided') then 'failed'::public.payment_status
      when v_status in ('cancelled','canceled') then 'cancelled'::public.payment_status
      else status
    end,
    updated_at=now()
  where booking_id=p_booking_id
    and provider_transaction_id=p_transaction_id;

  if v_status='paid' then
    update public.bookings
      set status='confirmed'::public.booking_status,
          expires_at=null
      where id=p_booking_id;
    perform public.issue_tickets(p_booking_id);
  elsif v_status in ('failed','expired','invalided') then
    update public.seats s
      set status='available', held_until=null
      from public.booking_seats bs
      where bs.booking_id=p_booking_id
        and bs.seat_id=s.id
        and s.status='held';
    delete from public.booking_seats where booking_id=p_booking_id;
    update public.bookings
      set status='expired'::public.booking_status,
          expires_at=null
      where id=p_booking_id;
  elsif v_status in ('cancelled','canceled') then
    update public.seats s
      set status='available', held_until=null
      from public.booking_seats bs
      where bs.booking_id=p_booking_id
        and bs.seat_id=s.id
        and s.status='held';
    delete from public.booking_seats where booking_id=p_booking_id;
    update public.bookings
      set status='cancelled'::public.booking_status,
          expires_at=null
      where id=p_booking_id;
  end if;
end $$;

notify pgrst, 'reload schema';
