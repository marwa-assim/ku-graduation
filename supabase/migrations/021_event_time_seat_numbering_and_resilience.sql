-- Event/seat final accuracy repair
begin;

-- Aisle values mean "place an aisle after this seat number". Aisles are visual gaps,
-- never seat records, and never consume a serial number.
create or replace function public.generate_zone_seats(p_zone_id uuid)
returns integer language plpgsql security definer set search_path=public as $$
declare
  z public.seating_zones%rowtype;
  r integer;
  c integer;
  serial_no integer := 0;
  generated integer := 0;
  seat_code text;
  seat_kind text;
begin
  if public.app_current_role() not in ('admin','land') then
    raise exception 'Not authorized';
  end if;

  select * into z
  from public.seating_zones
  where id=p_zone_id and organization_id=public.current_org()
  for update;
  if not found then raise exception 'Zone not found'; end if;

  -- Preserve already booked/held seats. Replace only unused generated seats.
  delete from public.seats
  where zone_id=z.id
    and status in ('available'::public.seat_status,'blocked'::public.seat_status);

  seat_kind := case z.zone_type
    when 'stage' then 'graduate'
    when 'graduate' then 'graduate'
    when 'staff' then 'staff'
    when 'vip' then 'vip'
    when 'paid_guest' then 'paid_guest'
    when 'accessible' then 'accessible'
    else 'free_guest'
  end;

  for r in 1..z.rows_count loop
    for c in 1..z.columns_count loop
      serial_no := serial_no + 1;
      seat_code := coalesce(nullif(trim(z.seat_prefix),''),'S') || lpad(serial_no::text,3,'0');
      insert into public.seats(
        organization_id,event_id,zone_id,code,label,row_label,row_number,column_number,
        status,section,seat_type,price_bhd,college_id,is_aisle,color,x_position,y_position
      ) values (
        z.organization_id,z.event_id,z.id,seat_code,seat_code,chr(64+least(r,26)),r,c,
        'available'::public.seat_status,
        case when z.zone_type in ('stage','graduate') then 'stage' when z.zone_type='vip' then 'vip' else 'audience' end,
        seat_kind,z.price_bhd,z.college_id,false,z.color,c,r
      );
      generated := generated + 1;
    end loop;
  end loop;
  return generated;
end $$;

grant execute on function public.generate_zone_seats(uuid) to authenticated;

-- Remove obsolete unused aisle records created by older generators.
delete from public.seats
where is_aisle=true
  and status in ('available'::public.seat_status,'blocked'::public.seat_status);

-- Replace old UUID-style visible codes with deterministic continuous serials per zone.
update public.seats set code='TMP-'||id::text, label=null where is_aisle=false;
with numbered as (
  select s.id,z.seat_prefix,
         row_number() over(partition by s.zone_id order by s.row_number,s.column_number,s.created_at,s.id) as serial_no
  from public.seats s
  join public.seating_zones z on z.id=s.zone_id
  where coalesce(s.is_aisle,false)=false
)
update public.seats s
set code=coalesce(nullif(trim(n.seat_prefix),''),'S')||lpad(n.serial_no::text,3,'0'),
    label=coalesce(nullif(trim(n.seat_prefix),''),'S')||lpad(n.serial_no::text,3,'0')
from numbered n where n.id=s.id;

commit;
