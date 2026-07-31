-- v9.5: seat section compatibility, ticket integrity, profile photos and direct password support
begin;

-- Existing databases originally allowed only stage/guest/vip/staff. Guest zones must use guest.
alter table public.seats drop constraint if exists seats_section_check;
alter table public.seats add constraint seats_section_check
check (section in ('stage','guest','vip','staff'));

-- Repair section values created by older migrations.
update public.seats
set section=case
  when seat_type='graduate' then 'stage'
  when seat_type='vip' then 'vip'
  when seat_type='staff' then 'staff'
  else 'guest'
end
where section is null or section not in ('stage','guest','vip','staff');

alter table public.people_directory add column if not exists photo_url text;
alter table public.profiles add column if not exists photo_url text;

-- Prevent duplicate active tickets for the same physical seat while allowing historical cancelled rows.
create unique index if not exists uq_tickets_active_event_seat
on public.tickets(event_id,seat_id)
where status in ('valid','used');

create or replace function public.generate_zone_seats(p_zone_id uuid)
returns integer language plpgsql security definer set search_path=public as $$
declare z public.seating_zones%rowtype; r integer; c integer; existing_id uuid; seat_code text; seat_kind text; generated integer:=0; prefix text; section_value text;
begin
 if public.app_current_role() not in ('admin') then raise exception 'Not authorized'; end if;
 select * into z from public.seating_zones where id=p_zone_id and organization_id=public.current_org() for update;
 if not found then raise exception 'Zone not found'; end if;
 prefix:=upper(coalesce(nullif(regexp_replace(trim(z.seat_prefix),'[^A-Za-z0-9]','','g'),''),'S'));
 seat_kind:=case z.zone_type when 'stage' then 'graduate' when 'staff' then 'staff' when 'vip' then 'vip' when 'paid_guest' then 'paid_guest' when 'accessible' then 'accessible' else 'free_guest' end;
 section_value:=case z.zone_type when 'stage' then 'stage' when 'vip' then 'vip' when 'staff' then 'staff' else 'guest' end;
 delete from public.seats where zone_id=z.id and coalesce(is_aisle,false)=true;
 delete from public.seats where zone_id=z.id and status='available'::public.seat_status and (row_number>z.rows_count or column_number>z.columns_count);
 for r in 1..z.rows_count loop
  for c in 1..z.columns_count loop
   seat_code:=prefix||'-R'||lpad(r::text,2,'0')||'-S'||lpad(c::text,3,'0');
   select id into existing_id from public.seats where zone_id=z.id and row_number=r and column_number=c and coalesce(is_aisle,false)=false order by id limit 1;
   if existing_id is null then
    insert into public.seats(organization_id,event_id,zone_id,code,label,row_number,column_number,status,section,seat_type,price_bhd,college_id,is_aisle,color,x_position,y_position)
    values(z.organization_id,z.event_id,z.id,seat_code,seat_code,r,c,'available'::public.seat_status,section_value,seat_kind,z.price_bhd,z.college_id,false,z.color,c,r);
   else
    update public.seats set code=seat_code,label=seat_code,row_number=r,column_number=c,section=section_value,seat_type=seat_kind,price_bhd=z.price_bhd,college_id=z.college_id,is_aisle=false,color=z.color,x_position=c,y_position=r where id=existing_id;
   end if;
   generated:=generated+1;
  end loop;
 end loop;
 return generated;
end $$;
grant execute on function public.generate_zone_seats(uuid) to authenticated;

commit;
