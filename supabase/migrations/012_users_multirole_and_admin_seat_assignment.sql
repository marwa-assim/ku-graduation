-- Users, multi-role access and admin seat assignment compatibility.
-- Self-contained academic schema repair.
create extension if not exists pgcrypto;
create table if not exists public.degree_levels(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete cascade,name text not null,code text not null,display_order integer not null default 0,active boolean not null default true,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(organization_id,code));
create table if not exists public.academic_programs(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete cascade,college_id uuid not null references public.colleges(id) on delete cascade,degree_level_id uuid not null references public.degree_levels(id) on delete restrict,name text not null,code text not null,display_order integer not null default 0,active boolean not null default true,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(organization_id,code));
grant select,insert,update,delete on public.degree_levels,public.academic_programs to authenticated;
alter type public.app_role add value if not exists 'photographer';
alter table public.people_directory add column if not exists college_id uuid references public.colleges(id) on delete set null;
alter table public.people_directory add column if not exists degree_level_id uuid references public.degree_levels(id) on delete set null;
alter table public.people_directory add column if not exists program_id uuid references public.academic_programs(id) on delete set null;
create unique index if not exists people_reference_unique on public.people_directory(organization_id,reference_number) where reference_number is not null;
create table if not exists public.profile_roles(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete cascade,profile_id uuid not null references public.profiles(id) on delete cascade,role public.app_role not null,created_at timestamptz not null default now(),unique(profile_id,role));
alter table public.profile_roles enable row level security;
drop policy if exists profile_roles_select on public.profile_roles;create policy profile_roles_select on public.profile_roles for select to authenticated using(organization_id=public.current_org() and (profile_id=auth.uid() or public.current_role() in('admin','regcom')));
drop policy if exists profile_roles_write on public.profile_roles;create policy profile_roles_write on public.profile_roles for all to authenticated using(organization_id=public.current_org() and public.current_role()='admin') with check(organization_id=public.current_org());
insert into public.profile_roles(organization_id,profile_id,role) select organization_id,id,role from public.profiles where organization_id is not null on conflict(profile_id,role) do nothing;
alter table public.bookings alter column user_id drop not null;
alter table public.tickets alter column user_id drop not null;
alter table public.bookings add column if not exists person_id uuid references public.people_directory(id) on delete cascade;
alter table public.tickets add column if not exists person_id uuid references public.people_directory(id) on delete cascade;
alter table public.bookings add column if not exists assigned_by_admin boolean not null default false;
alter table public.tickets add column if not exists assigned_by_admin boolean not null default false;
create index if not exists bookings_person_idx on public.bookings(organization_id,person_id);
create index if not exists tickets_person_idx on public.tickets(organization_id,person_id);
grant select,insert,update,delete on public.profile_roles to authenticated;
notify pgrst,'reload schema';
