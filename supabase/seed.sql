insert into public.events(name,ceremony_date,venue,booking_deadline,status)
values(
  'Kingdom University Graduation Ceremony 2026',
  '2026-10-15 18:00:00+03',
  'Exhibition World Bahrain',
  '2026-10-01 23:59:59+03',
  'published'
);

with ev as (select id from public.events limit 1)
insert into public.seats(event_id,code,section,price_bhd)
select ev.id,
       chr(65 + ((n-1)/10)::int) || ((n-1)%10 + 1),
       'guest',
       case when n <= 20 then 0 else 5.000 end
from ev, generate_series(1,80) n;
