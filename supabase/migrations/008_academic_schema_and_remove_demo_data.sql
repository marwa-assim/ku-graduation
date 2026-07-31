begin;

create table if not exists public.degree_levels (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  code text not null,
  display_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
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
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

alter table public.people_directory
  add column if not exists college_id uuid references public.colleges(id) on delete set null;
alter table public.people_directory
  add column if not exists degree_level_id uuid references public.degree_levels(id) on delete set null;
alter table public.people_directory
  add column if not exists program_id uuid references public.academic_programs(id) on delete set null;

alter table public.degree_levels enable row level security;
alter table public.academic_programs enable row level security;

drop policy if exists degree_levels_read on public.degree_levels;
create policy degree_levels_read on public.degree_levels for select to authenticated
using (organization_id = public.current_org());

drop policy if exists degree_levels_write on public.degree_levels;
create policy degree_levels_write on public.degree_levels for all to authenticated
using (organization_id = public.current_org() and public.app_current_role() = 'admin')
with check (organization_id = public.current_org() and public.app_current_role() = 'admin');

drop policy if exists academic_programs_read on public.academic_programs;
create policy academic_programs_read on public.academic_programs for select to authenticated
using (organization_id = public.current_org());

drop policy if exists academic_programs_write on public.academic_programs;
create policy academic_programs_write on public.academic_programs for all to authenticated
using (organization_id = public.current_org() and public.app_current_role() = 'admin')
with check (organization_id = public.current_org() and public.app_current_role() = 'admin');

create index if not exists degree_levels_org_idx on public.degree_levels(organization_id);
create index if not exists academic_programs_org_idx on public.academic_programs(organization_id);
create index if not exists academic_programs_college_idx on public.academic_programs(college_id);
create index if not exists people_directory_degree_idx on public.people_directory(degree_level_id);
create index if not exists people_directory_program_idx on public.people_directory(program_id);

-- Remove only the known demonstration records shipped in the old seed file.
delete from public.people_directory
where email in (
  'sara.student@example.com',
  'ahmed.academic@example.com',
  'mona.admin@example.com'
)
and reference_number in ('20260001','AC1001','AD2001');

notify pgrst, 'reload schema';
commit;
