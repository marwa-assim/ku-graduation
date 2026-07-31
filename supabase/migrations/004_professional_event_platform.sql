-- Professional multi-tenant event platform expansion
begin;

alter table public.organizations add column if not exists secondary_color text default '#173B62';
alter table public.organizations add column if not exists background_color text default '#0C0D11';
alter table public.organizations add column if not exists surface_color text default '#14161D';
alter table public.organizations add column if not exists accent_color text default '#D4A843';
alter table public.organizations add column if not exists domain text;
alter table public.organizations add column if not exists timezone text default 'Asia/Bahrain';
alter table public.organizations add column if not exists locale text default 'en';
alter table public.organizations add column if not exists contact_email text;
alter table public.organizations add column if not exists contact_phone text;
alter table public.organizations add column if not exists address text;
alter table public.organizations add column if not exists subscription_status text default 'active';

alter table public.events add column if not exists short_name text;
alter table public.events add column if not exists description text;
alter table public.events add column if not exists end_date timestamptz;
alter table public.events add column if not exists registration_open_at timestamptz;
alter table public.events add column if not exists registration_close_at timestamptz;
alter table public.events add column if not exists venue_address text;
alter table public.events add column if not exists latitude numeric(10,7);
alter table public.events add column if not exists longitude numeric(10,7);
alter table public.events add column if not exists map_url text;
alter table public.events add column if not exists cover_image_url text;
alter table public.events add column if not exists invitation_title text;
alter table public.events add column if not exists invitation_message text;
alter table public.events add column if not exists ticket_footer text;
alter table public.events add column if not exists allow_guest_booking boolean default true;
alter table public.events add column if not exists allow_paid_booking boolean default true;
alter table public.events add column if not exists max_guest_tickets integer default 4;
alter table public.events add column if not exists currency text default 'BHD';
alter table public.events add column if not exists settings jsonb default '{}'::jsonb;

alter table public.profiles add column if not exists active boolean default true;
alter table public.profiles add column if not exists preferred_language text default 'en';
alter table public.profiles add column if not exists avatar_url text;

alter table public.people_directory add column if not exists role public.app_role default 'student';
alter table public.people_directory add column if not exists gender text;
alter table public.people_directory add column if not exists degree text;
alter table public.people_directory add column if not exists graduation_year integer;
alter table public.people_directory add column if not exists active boolean default true;
alter table public.people_directory add column if not exists metadata jsonb default '{}'::jsonb;

alter table public.seats add column if not exists zone_id uuid;
alter table public.seats add column if not exists row_number integer;
alter table public.seats add column if not exists column_number integer;
alter table public.seats add column if not exists label text;
alter table public.seats add column if not exists color text;
alter table public.seats add column if not exists college_id uuid;
alter table public.seats add column if not exists is_aisle boolean default false;
alter table public.seats add column if not exists x_position integer;
alter table public.seats add column if not exists y_position integer;

create table if not exists public.colleges (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
 name text not null, code text not null, color text default '#4A90D9', display_order integer default 0, active boolean default true,
 created_at timestamptz default now(), unique(organization_id,code)
);

create table if not exists public.event_colleges (
 event_id uuid not null references public.events(id) on delete cascade,
 college_id uuid not null references public.colleges(id) on delete cascade,
 expected_graduates integer default 0, stage_order integer default 0, active boolean default true,
 primary key(event_id,college_id)
);

create table if not exists public.seating_zones (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
 event_id uuid not null references public.events(id) on delete cascade,
 name text not null, zone_type text not null check(zone_type in ('stage','vip','staff','free_guest','paid_guest','accessible','blocked')),
 rows_count integer not null default 1 check(rows_count between 1 and 200), columns_count integer not null default 1 check(columns_count between 1 and 200),
 color text default '#D4A843', price_bhd numeric(10,3) default 0, display_order integer default 0,
 college_id uuid references public.colleges(id) on delete set null, seat_prefix text default 'S', aisle_columns integer[] default '{}',
 settings jsonb default '{}'::jsonb, created_at timestamptz default now()
);

alter table public.seats drop constraint if exists seats_zone_id_fkey;
alter table public.seats add constraint seats_zone_id_fkey foreign key(zone_id) references public.seating_zones(id) on delete cascade;
alter table public.seats drop constraint if exists seats_college_id_fkey;
alter table public.seats add constraint seats_college_id_fkey foreign key(college_id) references public.colleges(id) on delete set null;

create table if not exists public.invitations (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
 event_id uuid not null references public.events(id) on delete cascade, person_id uuid references public.people_directory(id) on delete cascade,
 channel text not null default 'email', recipient text not null, subject text, message text, status text default 'draft',
 sent_at timestamptz, opened_at timestamptz, accepted_at timestamptz, token text unique default encode(gen_random_bytes(24),'hex'), created_at timestamptz default now()
);

create table if not exists public.issue_reports (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
 event_id uuid references public.events(id) on delete cascade, reported_by uuid references public.profiles(id), person_id uuid references public.people_directory(id),
 issue_type text not null, description text not null, status text default 'open', resolution text, assigned_to uuid references public.profiles(id),
 created_at timestamptz default now(), resolved_at timestamptz
);

create table if not exists public.audit_log (
 id bigint generated always as identity primary key, organization_id uuid references public.organizations(id) on delete cascade,
 event_id uuid references public.events(id) on delete set null, actor_id uuid references public.profiles(id) on delete set null,
 entity_type text not null, entity_id text, action text not null, old_data jsonb, new_data jsonb, created_at timestamptz default now()
);

alter table public.colleges enable row level security;
alter table public.event_colleges enable row level security;
alter table public.seating_zones enable row level security;
alter table public.invitations enable row level security;
alter table public.issue_reports enable row level security;
alter table public.audit_log enable row level security;

drop policy if exists colleges_read on public.colleges;
create policy colleges_read on public.colleges for select to authenticated using(organization_id=public.current_org());
drop policy if exists colleges_admin on public.colleges;
create policy colleges_admin on public.colleges for all to authenticated using(organization_id=public.current_org() and public.app_current_role()='admin') with check(organization_id=public.current_org() and public.app_current_role()='admin');

drop policy if exists event_colleges_read on public.event_colleges;
create policy event_colleges_read on public.event_colleges for select to authenticated using(exists(select 1 from public.events e where e.id=event_id and e.organization_id=public.current_org()));
drop policy if exists event_colleges_admin on public.event_colleges;
create policy event_colleges_admin on public.event_colleges for all to authenticated using(public.app_current_role()='admin') with check(public.app_current_role()='admin');

drop policy if exists zones_read on public.seating_zones;
create policy zones_read on public.seating_zones for select to authenticated using(organization_id=public.current_org());
drop policy if exists zones_write on public.seating_zones;
create policy zones_write on public.seating_zones for all to authenticated using(organization_id=public.current_org() and public.app_current_role() in ('admin','land')) with check(organization_id=public.current_org() and public.app_current_role() in ('admin','land'));

drop policy if exists invitations_read on public.invitations;
create policy invitations_read on public.invitations for select to authenticated using(organization_id=public.current_org() and public.app_current_role() in ('admin','regcom'));
drop policy if exists invitations_write on public.invitations;
create policy invitations_write on public.invitations for all to authenticated using(organization_id=public.current_org() and public.app_current_role() in ('admin','regcom')) with check(organization_id=public.current_org());

drop policy if exists issues_read on public.issue_reports;
create policy issues_read on public.issue_reports for select to authenticated using(organization_id=public.current_org());
drop policy if exists issues_write on public.issue_reports;
create policy issues_write on public.issue_reports for all to authenticated using(organization_id=public.current_org()) with check(organization_id=public.current_org());

drop policy if exists audit_admin_read on public.audit_log;
create policy audit_admin_read on public.audit_log for select to authenticated using(organization_id=public.current_org() and public.app_current_role()='admin');

create or replace function public.generate_zone_seats(p_zone_id uuid) returns integer
language plpgsql security definer set search_path=public as $$
declare z public.seating_zones%rowtype; r integer; c integer; generated integer:=0; seat_code text;
begin
 if public.app_current_role() not in ('admin','land') then raise exception 'Not authorized'; end if;
 select * into z from public.seating_zones where id=p_zone_id and organization_id=public.current_org() for update;
 if not found then raise exception 'Zone not found'; end if;
 delete from public.seats where zone_id=z.id and status in ('available','blocked');
 for r in 1..z.rows_count loop
   for c in 1..z.columns_count loop
     seat_code := z.seat_prefix || lpad(r::text,2,'0') || '-' || lpad(c::text,2,'0');
     insert into public.seats(organization_id,event_id,zone_id,code,label,section,seat_type,price_bhd,status,row_number,column_number,color,college_id,is_aisle,x_position,y_position)
     values(z.organization_id,z.event_id,z.id,seat_code,seat_code,
       case when z.zone_type='stage' then 'stage' when z.zone_type='vip' then 'vip' when z.zone_type='staff' then 'staff' else 'guest' end,
       case when z.zone_type in ('free_guest','paid_guest','vip','staff','accessible','blocked') then z.zone_type else 'graduate' end,
       z.price_bhd,case when c=any(z.aisle_columns) or z.zone_type='blocked' then 'blocked' else 'available' end,
       r,c,z.color,z.college_id,c=any(z.aisle_columns),c,r);
     generated:=generated+1;
   end loop;
 end loop;
 return generated;
end $$;
grant execute on function public.generate_zone_seats(uuid) to authenticated;

commit;
