-- v10.1: zone-safe deterministic seat regeneration
-- Visible label: <ZONE PREFIX>-R<ROW>-S<SEAT>
-- Internal code: visible label plus a short zone suffix, preventing collisions when
-- several zones intentionally use the same prefix (for example stage left/centre/right).
begin;

alter table public.seats drop constraint if exists seats_section_check;
alter table public.seats add constraint seats_section_check
check (section in ('stage','guest','vip','staff'));

create or replace function public.generate_zone_seats(p_zone_id uuid)
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare
 z public.seating_zones%rowtype;
 r integer;
 c integer;
 generated integer:=0;
 prefix text;
 visible_label text;
 internal_code text;
 zone_key text;
 seat_kind text;
 section_value text;
 keep_id uuid;
begin
 if public.app_current_role() <> 'admin' then
  raise exception 'Not authorized';
 end if;

 select * into z
 from public.seating_zones
 where id=p_zone_id and organization_id=public.current_org()
 for update;
 if not found then raise exception 'Zone not found'; end if;

 prefix:=upper(coalesce(nullif(regexp_replace(trim(coalesce(z.seat_prefix,'')),'[^A-Za-z0-9_-]','','g'),''),'S'));
 zone_key:=upper(substr(replace(z.id::text,'-',''),1,8));
 seat_kind:=case z.zone_type
  when 'stage' then 'graduate'
  when 'staff' then 'staff'
  when 'vip' then 'vip'
  when 'paid_guest' then 'paid_guest'
  when 'accessible' then 'accessible'
  else 'free_guest' end;
 section_value:=case z.zone_type
  when 'stage' then 'stage'
  when 'vip' then 'vip'
  when 'staff' then 'staff'
  else 'guest' end;

 -- Eliminate duplicate available rows at a physical position while preserving
 -- booked/held records. Aisles are layout gaps, never seat rows.
 delete from public.seats where zone_id=z.id and coalesce(is_aisle,false)=true;
 with ranked as (
  select id,row_number() over(
   partition by zone_id,row_number,column_number
   order by case when status='booked'::public.seat_status then 0
                 when status='held'::public.seat_status then 1 else 2 end,id
  ) rn
  from public.seats
  where zone_id=z.id and coalesce(is_aisle,false)=false
 )
 delete from public.seats s using ranked d
 where s.id=d.id and d.rn>1 and s.status='available'::public.seat_status;

 -- Move only this zone's codes to collision-proof temporary values before
 -- assigning the final values. This avoids the event/code unique-key error.
 update public.seats
 set code='TMP-'||replace(id::text,'-',''), label='TMP-'||replace(id::text,'-','')
 where zone_id=z.id and coalesce(is_aisle,false)=false;

 delete from public.seats
 where zone_id=z.id
   and status='available'::public.seat_status
   and (row_number<1 or column_number<1 or row_number>z.rows_count or column_number>z.columns_count);

 for r in 1..z.rows_count loop
  for c in 1..z.columns_count loop
   visible_label:=prefix||'-R'||lpad(r::text,2,'0')||'-S'||lpad(c::text,3,'0');
   internal_code:=visible_label||'-Z'||zone_key;

   select id into keep_id
   from public.seats
   where zone_id=z.id and row_number=r and column_number=c and coalesce(is_aisle,false)=false
   order by case when status='booked'::public.seat_status then 0
                 when status='held'::public.seat_status then 1 else 2 end,id
   limit 1;

   if keep_id is null then
    insert into public.seats(
     organization_id,event_id,zone_id,code,label,row_number,column_number,status,
     section,seat_type,price_bhd,college_id,is_aisle,color,x_position,y_position
    ) values(
     z.organization_id,z.event_id,z.id,internal_code,visible_label,r,c,'available'::public.seat_status,
     section_value,seat_kind,coalesce(z.price_bhd,0),z.college_id,false,z.color,c,r
    );
   else
    update public.seats set
     code=internal_code,
     label=visible_label,
     row_number=r,
     column_number=c,
     section=section_value,
     seat_type=seat_kind,
     price_bhd=coalesce(z.price_bhd,0),
     college_id=z.college_id,
     is_aisle=false,
     color=z.color,
     x_position=c,
     y_position=r
    where id=keep_id;
   end if;
   generated:=generated+1;
  end loop;
 end loop;
 return generated;
end $$;

grant execute on function public.generate_zone_seats(uuid) to authenticated;
commit;
