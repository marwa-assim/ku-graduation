begin;

create or replace function public.generate_zone_seats(p_zone_id uuid) returns integer
language plpgsql security definer set search_path=public as $$
declare
 z public.seating_zones%rowtype;
 r integer;
 c integer;
 generated integer:=0;
 seat_code text;
 v_status public.seat_status;
 v_is_aisle boolean;
 row_width integer;
 column_width integer;
begin
 if public.app_current_role() not in ('admin','land') then raise exception 'Not authorized'; end if;
 select * into z from public.seating_zones where id=p_zone_id and organization_id=public.current_org() for update;
 if not found then raise exception 'Zone not found'; end if;
 if z.rows_count < 1 or z.columns_count < 1 then raise exception 'Rows and columns must be greater than zero'; end if;

 row_width := greatest(2, length(z.rows_count::text));
 column_width := greatest(3, length(z.columns_count::text));

 -- Remove all unassigned generated positions before rebuilding the complete grid.
 delete from public.seats
 where zone_id=z.id
   and status in ('available'::public.seat_status,'blocked'::public.seat_status);

 for r in 1..z.rows_count loop
  for c in 1..z.columns_count loop
   seat_code := z.seat_prefix || lpad(r::text,row_width,'0') || '-' || lpad(c::text,column_width,'0');
   v_is_aisle := coalesce(c=any(coalesce(z.aisle_columns,'{}'::integer[])),false);
   v_status := case when v_is_aisle or z.zone_type='blocked'
     then 'blocked'::public.seat_status else 'available'::public.seat_status end;

   insert into public.seats(
    organization_id,event_id,zone_id,code,label,section,seat_type,price_bhd,status,
    row_number,column_number,color,college_id,is_aisle,x_position,y_position
   ) values(
    z.organization_id,z.event_id,z.id,seat_code,seat_code,
    case when z.zone_type='stage' then 'stage' when z.zone_type='vip' then 'vip' when z.zone_type='staff' then 'staff' else 'guest' end,
    case when z.zone_type in ('free_guest','paid_guest','vip','staff','accessible','blocked') then z.zone_type else 'graduate' end,
    z.price_bhd,v_status,r,c,z.color,z.college_id,v_is_aisle,c,r
   )
   on conflict(event_id,code) do update set
    zone_id=excluded.zone_id,label=excluded.label,section=excluded.section,
    seat_type=excluded.seat_type,price_bhd=excluded.price_bhd,status=excluded.status,
    row_number=excluded.row_number,column_number=excluded.column_number,
    color=excluded.color,college_id=excluded.college_id,is_aisle=excluded.is_aisle,
    x_position=excluded.x_position,y_position=excluded.y_position;
   generated:=generated+1;
  end loop;
 end loop;
 return generated;
end $$;

grant execute on function public.generate_zone_seats(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
