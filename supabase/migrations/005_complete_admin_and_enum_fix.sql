-- Complete admin expansion and seat_status enum correction
begin;

create table if not exists public.degree_levels (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  code text not null,
  display_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(organization_id, code)
);

create table if not exists public.academic_programs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  college_id uuid not null references public.colleges(id) on delete cascade,
  degree_level_id uuid not null references public.degree_levels(id) on delete restrict,
  name text not null,
  code text not null,
  display_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(organization_id, code)
);

alter table public.people_directory add column if not exists college_id uuid references public.colleges(id) on delete set null;
alter table public.people_directory add column if not exists degree_level_id uuid references public.degree_levels(id) on delete set null;
alter table public.people_directory add column if not exists program_id uuid references public.academic_programs(id) on delete set null;

create table if not exists public.invitation_designs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null default 'Default invitation',
  title_text text,
  body_text text,
  footer_text text,
  font_family text not null default 'Arial',
  title_font_size integer not null default 34 check(title_font_size between 12 and 96),
  body_font_size integer not null default 18 check(body_font_size between 10 and 64),
  text_color text not null default '#FFFFFF',
  accent_color text not null default '#D4A843',
  background_color text not null default '#0C0D11',
  background_image_url text,
  logo_url text,
  card_width integer not null default 1200,
  card_height integer not null default 675,
  settings jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(event_id, name)
);

alter table public.degree_levels enable row level security;
alter table public.academic_programs enable row level security;
alter table public.invitation_designs enable row level security;

drop policy if exists degree_levels_read on public.degree_levels;
create policy degree_levels_read on public.degree_levels for select to authenticated using(organization_id=public.current_org());
drop policy if exists degree_levels_write on public.degree_levels;
create policy degree_levels_write on public.degree_levels for all to authenticated using(organization_id=public.current_org() and public.app_current_role()='admin') with check(organization_id=public.current_org() and public.app_current_role()='admin');

drop policy if exists academic_programs_read on public.academic_programs;
create policy academic_programs_read on public.academic_programs for select to authenticated using(organization_id=public.current_org());
drop policy if exists academic_programs_write on public.academic_programs;
create policy academic_programs_write on public.academic_programs for all to authenticated using(organization_id=public.current_org() and public.app_current_role()='admin') with check(organization_id=public.current_org() and public.app_current_role()='admin');

drop policy if exists invitation_designs_read on public.invitation_designs;
create policy invitation_designs_read on public.invitation_designs for select to authenticated using(organization_id=public.current_org());
drop policy if exists invitation_designs_write on public.invitation_designs;
create policy invitation_designs_write on public.invitation_designs for all to authenticated using(organization_id=public.current_org() and public.app_current_role() in ('admin','regcom')) with check(organization_id=public.current_org());

create or replace function public.generate_zone_seats(p_zone_id uuid) returns integer
language plpgsql security definer set search_path=public as $$
declare z public.seating_zones%rowtype; r integer; c integer; generated integer:=0; seat_code text; v_status public.seat_status;
begin
 if public.app_current_role() not in ('admin','land') then raise exception 'Not authorized'; end if;
 select * into z from public.seating_zones where id=p_zone_id and organization_id=public.current_org() for update;
 if not found then raise exception 'Zone not found'; end if;
 delete from public.seats where zone_id=z.id and status in ('available'::public.seat_status,'blocked'::public.seat_status);
 for r in 1..z.rows_count loop
   for c in 1..z.columns_count loop
     seat_code := z.seat_prefix || lpad(r::text,2,'0') || '-' || lpad(c::text,2,'0');
     v_status := case when c=any(z.aisle_columns) or z.zone_type='blocked' then 'blocked'::public.seat_status else 'available'::public.seat_status end;
     insert into public.seats(organization_id,event_id,zone_id,code,label,section,seat_type,price_bhd,status,row_number,column_number,color,college_id,is_aisle,x_position,y_position)
     values(z.organization_id,z.event_id,z.id,seat_code,seat_code,
       case when z.zone_type='stage' then 'stage' when z.zone_type='vip' then 'vip' when z.zone_type='staff' then 'staff' else 'guest' end,
       case when z.zone_type in ('free_guest','paid_guest','vip','staff','accessible','blocked') then z.zone_type else 'graduate' end,
       z.price_bhd,v_status,r,c,z.color,z.college_id,c=any(z.aisle_columns),c,r);
     generated:=generated+1;
   end loop;
 end loop;
 return generated;
end $$;

grant execute on function public.generate_zone_seats(uuid) to authenticated;

-- sensible defaults
insert into public.degree_levels(organization_id,name,code,display_order)
select id,'Bachelor','BACHELOR',1 from public.organizations
on conflict(organization_id,code) do nothing;
insert into public.degree_levels(organization_id,name,code,display_order)
select id,'Master','MASTER',2 from public.organizations
on conflict(organization_id,code) do nothing;

commit;
