-- Operational workflows, communication designer, services and reliable seating generation
begin;
alter table public.organizations add column if not exists tailor_name text;
alter table public.organizations add column if not exists tailor_phone text;
alter table public.organizations add column if not exists tailor_email text;
alter table public.organizations add column if not exists photographer_name text;
alter table public.organizations add column if not exists photographer_phone text;
alter table public.organizations add column if not exists photographer_email text;

alter table public.events add column if not exists live_stream_url text;
alter table public.events add column if not exists live_stream_enabled boolean not null default false;

alter table public.people_directory add column if not exists registration_status text not null default 'pending';
alter table public.people_directory add column if not exists payment_status text not null default 'pending';
alter table public.people_directory add column if not exists entered_status text not null default 'pending';

alter table public.fittings add column if not exists collected_status text not null default 'pending';
alter table public.photo_sessions alter column status set default 'pending';
update public.photo_sessions set status='pending' where status in ('not_scheduled','scheduled') or status is null;

alter table public.vip_assignments add column if not exists seating_status text not null default 'pending';
update public.vip_assignments set arrival_status='pending' where arrival_status='expected' or arrival_status is null;

alter table public.event_services add column if not exists contact_email text;
alter table public.event_services add column if not exists price_bhd numeric(10,3) not null default 0;
alter table public.event_services add column if not exists image_url text;
alter table public.event_services add column if not exists service_url text;
alter table public.event_services add column if not exists service_type text not null default 'general';

alter table public.invitation_designs add column if not exists show_name boolean not null default true;
alter table public.invitation_designs add column if not exists show_reference boolean not null default true;
alter table public.invitation_designs add column if not exists show_college boolean not null default true;
alter table public.invitation_designs add column if not exists show_program boolean not null default true;
alter table public.invitation_designs add column if not exists show_degree boolean not null default true;
alter table public.invitation_designs add column if not exists show_date boolean not null default true;
alter table public.invitation_designs add column if not exists show_time boolean not null default true;
alter table public.invitation_designs add column if not exists show_venue boolean not null default true;
alter table public.invitation_designs add column if not exists show_location boolean not null default false;

create or replace function public.generate_zone_seats(p_zone_id uuid) returns integer
language plpgsql security definer set search_path=public as $$
declare z public.seating_zones%rowtype; r integer; c integer; generated integer:=0; seat_code text; v_status public.seat_status; v_is_aisle boolean;
begin
 if public.app_current_role() not in ('admin','land') then raise exception 'Not authorized'; end if;
 select * into z from public.seating_zones where id=p_zone_id and organization_id=public.current_org() for update;
 if not found then raise exception 'Zone not found'; end if;
 if z.rows_count < 1 or z.columns_count < 1 then raise exception 'Rows and columns must be greater than zero'; end if;
 delete from public.seats where zone_id=z.id and status in ('available'::public.seat_status,'blocked'::public.seat_status);
 for r in 1..z.rows_count loop
  for c in 1..z.columns_count loop
   seat_code:=z.seat_prefix||lpad(r::text,2,'0')||'-'||lpad(c::text,2,'0');
   v_is_aisle:=coalesce(c=any(z.aisle_columns),false);
   v_status:=case when v_is_aisle or z.zone_type='blocked' then 'blocked'::public.seat_status else 'available'::public.seat_status end;
   insert into public.seats(organization_id,event_id,zone_id,code,label,section,seat_type,price_bhd,status,row_number,column_number,color,college_id,is_aisle,x_position,y_position)
   values(z.organization_id,z.event_id,z.id,seat_code,seat_code,
    case when z.zone_type='stage' then 'stage' when z.zone_type='vip' then 'vip' when z.zone_type='staff' then 'staff' else 'guest' end,
    case when z.zone_type in ('free_guest','paid_guest','vip','staff','accessible','blocked') then z.zone_type else 'graduate' end,
    z.price_bhd,v_status,r,c,z.color,z.college_id,v_is_aisle,c,r)
   on conflict(event_id,code) do update set zone_id=excluded.zone_id,label=excluded.label,section=excluded.section,seat_type=excluded.seat_type,price_bhd=excluded.price_bhd,status=excluded.status,row_number=excluded.row_number,column_number=excluded.column_number,color=excluded.color,college_id=excluded.college_id,is_aisle=excluded.is_aisle,x_position=excluded.x_position,y_position=excluded.y_position;
   generated:=generated+1;
  end loop;
 end loop;
 return generated;
end $$;
grant execute on function public.generate_zone_seats(uuid) to authenticated;
commit;
