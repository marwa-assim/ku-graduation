create extension if not exists pgcrypto;

create type public.app_role as enum ('student','admin','scanner','regcom','vip','land','finance','tailor');
create type public.event_status as enum ('draft','published','closed');
create type public.seat_status as enum ('available','held','booked','blocked');
create type public.booking_status as enum ('held','confirmed','expired','cancelled');
create type public.payment_status as enum ('pending','paid','failed','cancelled','refunded');
create type public.ticket_status as enum ('valid','used','cancelled');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null,
  role public.app_role not null default 'student',
  student_number text unique,
  college text,
  program text,
  phone text,
  created_at timestamptz not null default now()
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  ceremony_date timestamptz not null,
  venue text not null,
  booking_deadline timestamptz,
  status public.event_status not null default 'draft',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.seats (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  code text not null,
  section text not null check (section in ('stage','guest','vip','staff')),
  price_bhd numeric(10,3) not null default 0 check (price_bhd >= 0),
  status public.seat_status not null default 'available',
  held_until timestamptz,
  unique(event_id,code)
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id),
  user_id uuid not null references public.profiles(id),
  status public.booking_status not null default 'held',
  total_bhd numeric(10,3) not null default 0,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.booking_seats (
  booking_id uuid not null references public.bookings(id) on delete cascade,
  seat_id uuid not null references public.seats(id),
  price_bhd numeric(10,3) not null,
  primary key(booking_id,seat_id),
  unique(seat_id)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id),
  provider text not null,
  provider_transaction_id text unique,
  amount_bhd numeric(10,3) not null,
  status public.payment_status not null default 'pending',
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id),
  user_id uuid not null references public.profiles(id),
  seat_id uuid not null references public.seats(id),
  booking_id uuid not null references public.bookings(id),
  qr_token text not null unique default encode(gen_random_bytes(32),'hex'),
  status public.ticket_status not null default 'valid',
  created_at timestamptz not null default now(),
  unique(event_id,seat_id)
);

create table public.entry_scans (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id),
  scanned_by uuid not null references public.profiles(id),
  scanned_at timestamptz not null default now(),
  result text not null
);

create or replace function public.current_role()
returns public.app_role language sql stable security definer set search_path=public
as $$ select role from public.profiles where id=auth.uid() $$;

alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.seats enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_seats enable row level security;
alter table public.payments enable row level security;
alter table public.tickets enable row level security;
alter table public.entry_scans enable row level security;

create policy "profiles self or admin" on public.profiles for select
using (id=auth.uid() or public.current_role() in ('admin','regcom','finance','tailor'));

create policy "events authenticated read" on public.events for select to authenticated using (true);
create policy "events admin write" on public.events for all to authenticated
using (public.current_role()='admin') with check (public.current_role()='admin');

create policy "seats authenticated read" on public.seats for select to authenticated using (true);
create policy "seats ops write" on public.seats for all to authenticated
using (public.current_role() in ('admin','vip','land')) with check (public.current_role() in ('admin','vip','land'));

create policy "bookings own or ops read" on public.bookings for select to authenticated
using (user_id=auth.uid() or public.current_role() in ('admin','regcom','finance'));
create policy "booking seats own or ops read" on public.booking_seats for select to authenticated
using (exists(select 1 from public.bookings b where b.id=booking_id and
  (b.user_id=auth.uid() or public.current_role() in ('admin','regcom','finance'))));

create policy "payments own or finance" on public.payments for select to authenticated
using (exists(select 1 from public.bookings b where b.id=booking_id and
  (b.user_id=auth.uid() or public.current_role() in ('admin','finance'))));

create policy "tickets own or operations" on public.tickets for select to authenticated
using (user_id=auth.uid() or public.current_role() in ('admin','scanner','regcom','finance','tailor'));

create policy "scans scanner read" on public.entry_scans for select to authenticated
using (public.current_role() in ('admin','scanner','regcom'));

create or replace function public.reserve_seats(
  p_event_id uuid,
  p_seat_ids uuid[],
  p_user_id uuid
) returns jsonb
language plpgsql security definer set search_path=public
as $$
declare
  v_booking uuid;
  v_total numeric(10,3);
  v_count int;
begin
  if auth.uid() is distinct from p_user_id then
    raise exception 'User mismatch';
  end if;

  perform 1 from public.events
  where id=p_event_id and status='published'
    and (booking_deadline is null or booking_deadline > now());
  if not found then raise exception 'Booking is closed'; end if;

  select count(*) into v_count from public.seats
  where id=any(p_seat_ids) and event_id=p_event_id and status='available'
  for update;
  if v_count <> cardinality(p_seat_ids) then
    raise exception 'One or more seats are no longer available';
  end if;

  insert into public.bookings(event_id,user_id,status,expires_at)
  values(p_event_id,p_user_id,'held',now()+interval '15 minutes')
  returning id into v_booking;

  insert into public.booking_seats(booking_id,seat_id,price_bhd)
  select v_booking,id,price_bhd from public.seats where id=any(p_seat_ids);

  select coalesce(sum(price_bhd),0) into v_total
  from public.booking_seats where booking_id=v_booking;

  update public.bookings set total_bhd=v_total where id=v_booking;
  update public.seats set status='held',held_until=now()+interval '15 minutes'
  where id=any(p_seat_ids);

  return jsonb_build_object('booking_id',v_booking,'total_bhd',v_total);
end $$;

create or replace function public.issue_tickets(p_booking_id uuid)
returns void language plpgsql security definer set search_path=public
as $$
begin
  insert into public.tickets(event_id,user_id,seat_id,booking_id)
  select b.event_id,b.user_id,bs.seat_id,b.id
  from public.bookings b join public.booking_seats bs on bs.booking_id=b.id
  where b.id=p_booking_id
  on conflict do nothing;

  update public.seats s set status='booked',held_until=null
  from public.booking_seats bs where bs.booking_id=p_booking_id and bs.seat_id=s.id;
  update public.bookings set status='confirmed',expires_at=null where id=p_booking_id;
end $$;

create or replace function public.confirm_free_booking(p_booking_id uuid)
returns void language plpgsql security definer set search_path=public
as $$
begin
  if not exists(select 1 from public.bookings where id=p_booking_id and user_id=auth.uid() and total_bhd=0 and status='held')
  then raise exception 'Booking cannot be confirmed'; end if;
  perform public.issue_tickets(p_booking_id);
end $$;

create or replace function public.process_payment_webhook(
  p_booking_id uuid,
  p_transaction_id text,
  p_status text
) returns void language plpgsql security definer set search_path=public
as $$
begin
  update public.payments set
    status=case p_status when 'paid' then 'paid'::public.payment_status when 'failed' then 'failed'::public.payment_status else 'cancelled'::public.payment_status end,
    updated_at=now()
  where booking_id=p_booking_id and provider_transaction_id=p_transaction_id;

  if p_status='paid' then perform public.issue_tickets(p_booking_id); end if;
end $$;

create or replace function public.scan_ticket(p_qr_token text,p_scanned_by uuid)
returns jsonb language plpgsql security definer set search_path=public
as $$
declare
  v_ticket public.tickets%rowtype;
  v_name text;
  v_seat text;
begin
  if auth.uid() is distinct from p_scanned_by or public.current_role() not in ('scanner','admin','regcom')
  then raise exception 'Not authorized'; end if;

  select * into v_ticket from public.tickets where qr_token=p_qr_token for update;
  if not found then raise exception 'Invalid ticket'; end if;
  if v_ticket.status='used' then raise exception 'Ticket already used'; end if;
  if v_ticket.status<>'valid' then raise exception 'Ticket is not valid'; end if;

  update public.tickets set status='used' where id=v_ticket.id;
  insert into public.entry_scans(ticket_id,scanned_by,result) values(v_ticket.id,p_scanned_by,'accepted');

  select full_name into v_name from public.profiles where id=v_ticket.user_id;
  select code into v_seat from public.seats where id=v_ticket.seat_id;
  return jsonb_build_object('studentName',v_name,'seatCode',v_seat);
end $$;

create or replace function public.release_expired_holds()
returns void language plpgsql security definer set search_path=public
as $$
begin
  update public.seats s set status='available',held_until=null
  from public.booking_seats bs join public.bookings b on b.id=bs.booking_id
  where bs.seat_id=s.id and b.status='held' and b.expires_at<now();

  update public.bookings set status='expired'
  where status='held' and expires_at<now();
end $$;

grant execute on function public.reserve_seats(uuid,uuid[],uuid) to authenticated;
grant execute on function public.confirm_free_booking(uuid) to authenticated;
grant execute on function public.scan_ticket(text,uuid) to authenticated;

alter publication supabase_realtime add table public.seats;
alter publication supabase_realtime add table public.tickets;
