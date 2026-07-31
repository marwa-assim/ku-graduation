-- v9.3 final seat integrity and cancellation repair
begin;
create or replace function public.generate_zone_seats(p_zone_id uuid)
returns integer language plpgsql security definer set search_path=public as $$
declare z public.seating_zones%rowtype; r integer; c integer; existing_id uuid; seat_code text; seat_kind text; generated integer:=0;
begin
 if public.app_current_role() not in ('admin','land') then raise exception 'Not authorized'; end if;
 select * into z from public.seating_zones where id=p_zone_id and organization_id=public.current_org() for update;
 if not found then raise exception 'Zone not found'; end if;
 seat_kind:=case z.zone_type when 'stage' then 'graduate' when 'staff' then 'staff' when 'vip' then 'vip' when 'paid_guest' then 'paid_guest' when 'accessible' then 'accessible' else 'free_guest' end;
 delete from public.seats where zone_id=z.id and coalesce(is_aisle,false)=true and status in ('available'::public.seat_status,'blocked'::public.seat_status);
 delete from public.seats where zone_id=z.id and status='available'::public.seat_status and (row_number>z.rows_count or column_number>z.columns_count);
 for r in 1..z.rows_count loop
  for c in 1..z.columns_count loop
   seat_code:=upper(coalesce(nullif(regexp_replace(trim(z.seat_prefix),'[^A-Za-z0-9]','','g'),''),'S'))||'-R'||lpad(r::text,2,'0')||'-S'||lpad(c::text,3,'0');
   select id into existing_id from public.seats where zone_id=z.id and row_number=r and column_number=c and coalesce(is_aisle,false)=false limit 1;
   if existing_id is null then
    insert into public.seats(organization_id,event_id,zone_id,code,label,row_number,column_number,status,section,seat_type,price_bhd,college_id,is_aisle,color,x_position,y_position)
    values(z.organization_id,z.event_id,z.id,seat_code,seat_code,r,c,'available'::public.seat_status,case when z.zone_type='stage' then 'stage' when z.zone_type='vip' then 'vip' else 'audience' end,seat_kind,z.price_bhd,z.college_id,false,z.color,c,r);
   else
    update public.seats set code=seat_code,label=seat_code,section=case when z.zone_type='stage' then 'stage' when z.zone_type='vip' then 'vip' else 'audience' end,seat_type=seat_kind,price_bhd=z.price_bhd,college_id=z.college_id,is_aisle=false,color=z.color,x_position=c,y_position=r where id=existing_id;
   end if;
   generated:=generated+1;
  end loop;
 end loop;
 return generated;
end $$;
grant execute on function public.generate_zone_seats(uuid) to authenticated;
update public.seats s set code=upper(coalesce(nullif(regexp_replace(trim(z.seat_prefix),'[^A-Za-z0-9]','','g'),''),'S'))||'-R'||lpad(s.row_number::text,2,'0')||'-S'||lpad(s.column_number::text,3,'0'),label=upper(coalesce(nullif(regexp_replace(trim(z.seat_prefix),'[^A-Za-z0-9]','','g'),''),'S'))||'-R'||lpad(s.row_number::text,2,'0')||'-S'||lpad(s.column_number::text,3,'0'),is_aisle=false from public.seating_zones z where s.zone_id=z.id and coalesce(s.is_aisle,false)=false;
create index if not exists idx_seats_zone_position on public.seats(zone_id,row_number,column_number);
create index if not exists idx_tickets_seat_status on public.tickets(seat_id,status);
create index if not exists idx_tickets_person_event on public.tickets(person_id,event_id);
create index if not exists idx_fittings_person_event on public.fittings(person_id,event_id);
create index if not exists idx_photo_person_event on public.photo_sessions(person_id,event_id);
commit;
