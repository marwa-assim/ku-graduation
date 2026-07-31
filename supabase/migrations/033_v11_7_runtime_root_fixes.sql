-- Runtime root fixes: role visibility controls and reliable expired paid-seat release.
alter table public.events add column if not exists show_invitation_to_students boolean not null default true;
alter table public.events add column if not exists student_seat_access_mode text not null default 'book';
do $$ begin
 if not exists(select 1 from pg_constraint where conname='events_student_seat_access_mode_check') then
  alter table public.events add constraint events_student_seat_access_mode_check check(student_seat_access_mode in ('book','view','hidden'));
 end if;
end $$;

create or replace function public.release_expired_bookings()
returns integer language plpgsql security definer set search_path=public as $$
declare affected integer:=0;
begin
 update public.seats s
 set status='available',held_until=null
 where s.status='held' and s.held_until<now()
   and exists(select 1 from public.booking_seats bs join public.bookings b on b.id=bs.booking_id where bs.seat_id=s.id and b.status='held' and b.expires_at<now());
 get diagnostics affected=row_count;
 update public.bookings set status='expired' where status='held' and expires_at<now();
 return affected;
end $$;
grant execute on function public.release_expired_bookings() to authenticated;

-- Best-effort hourly cleanup when pg_cron is available. UI/API also invokes the function on seat-map load.
do $$ begin
 if exists(select 1 from pg_extension where extname='pg_cron') then
  if not exists(select 1 from cron.job where jobname='release-expired-graduation-seat-holds') then
   perform cron.schedule('release-expired-graduation-seat-holds','* * * * *','select public.release_expired_bookings();');
  end if;
 end if;
exception when others then null;
end $$;
notify pgrst,'reload schema';
