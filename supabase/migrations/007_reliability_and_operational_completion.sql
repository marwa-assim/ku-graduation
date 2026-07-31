begin;
-- Safe compatibility patch for installations where earlier migrations were partially applied.
create table if not exists public.invitation_designs (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
 event_id uuid not null references public.events(id) on delete cascade, name text not null default 'Default invitation',
 title_text text,body_text text,footer_text text,font_family text not null default 'Arial',title_font_size integer not null default 34,
 body_font_size integer not null default 18,text_color text not null default '#FFFFFF',accent_color text not null default '#D4A843',
 background_color text not null default '#0C0D11',background_image_url text,logo_url text,settings jsonb not null default '{}'::jsonb,
 active boolean not null default true,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(event_id,name));
alter table public.invitation_designs add column if not exists show_name boolean not null default true;
alter table public.invitation_designs add column if not exists show_reference boolean not null default true;
alter table public.invitation_designs add column if not exists show_college boolean not null default true;
alter table public.invitation_designs add column if not exists show_program boolean not null default true;
alter table public.invitation_designs add column if not exists show_degree boolean not null default true;
alter table public.invitation_designs add column if not exists show_date boolean not null default true;
alter table public.invitation_designs add column if not exists show_time boolean not null default true;
alter table public.invitation_designs add column if not exists show_venue boolean not null default true;
alter table public.invitation_designs add column if not exists show_location boolean not null default false;
alter table public.people_directory add column if not exists registration_status text not null default 'pending';
alter table public.people_directory add column if not exists payment_status text not null default 'pending';
alter table public.people_directory add column if not exists entered_status text not null default 'pending';
alter table public.fittings add column if not exists collected_status text not null default 'pending';
create index if not exists people_directory_status_idx on public.people_directory(organization_id,registration_status,payment_status,entered_status);
create index if not exists fittings_person_event_idx on public.fittings(organization_id,event_id,person_id);
commit;
