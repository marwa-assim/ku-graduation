begin;

-- Academic staff login role and multi-role compatibility.
do $$ begin
  alter type public.app_role add value if not exists 'academic_staff';
exception when duplicate_object then null; end $$;

-- Repair administrative booking columns.
alter table public.bookings add column if not exists person_id uuid references public.people_directory(id) on delete set null;
alter table public.bookings add column if not exists assigned_by_admin boolean not null default false;
alter table public.tickets add column if not exists person_id uuid references public.people_directory(id) on delete set null;
alter table public.tickets add column if not exists assigned_by_admin boolean not null default false;

-- Event commercial periods and configurable revenue values.
alter table public.events add column if not exists paid_booking_open_at timestamptz;
alter table public.events add column if not exists paid_booking_close_at timestamptz;
alter table public.events add column if not exists extra_ticket_open_at timestamptz;
alter table public.events add column if not exists extra_ticket_close_at timestamptz;
alter table public.events add column if not exists paid_ticket_price_bhd numeric(12,3) not null default 0;
alter table public.events add column if not exists extra_ticket_price_bhd numeric(12,3) not null default 0;
alter table public.events add column if not exists registration_fee_bhd numeric(12,3) not null default 180;

-- Editable finance ledger.
create table if not exists public.ceremony_expenses(
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 event_id uuid not null references public.events(id) on delete cascade,
 item_name text not null,
 service_details text,
 unit_price_bhd numeric(12,3) not null default 0,
 quantity numeric(12,3) not null default 1,
 total_bhd numeric(12,3) generated always as (unit_price_bhd * quantity) stored,
 receipt_no text,
 vendor text,
 receipt_date date,
 completion_date date,
 status text not null default 'pending' check(status in ('pending','quoted','paid','completed')),
 notes text,
 created_by uuid references public.profiles(id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create table if not exists public.revenue_adjustments(
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 event_id uuid not null references public.events(id) on delete cascade,
 person_id uuid references public.people_directory(id) on delete set null,
 amount_bhd numeric(12,3) not null,
 source text not null default 'manual',
 description text,
 created_by uuid references public.profiles(id) on delete set null,
 created_at timestamptz not null default now()
);

-- Contact-us content.
alter table public.organizations add column if not exists contact_title text default 'Contact us';
alter table public.organizations add column if not exists contact_description text;
alter table public.organizations add column if not exists contact_whatsapp text;

create index if not exists idx_bookings_org_person on public.bookings(organization_id,person_id);
create index if not exists idx_tickets_org_person on public.tickets(organization_id,person_id);
create index if not exists idx_expenses_org_event on public.ceremony_expenses(organization_id,event_id,status);
create index if not exists idx_revenue_adjustments_org_event on public.revenue_adjustments(organization_id,event_id);

alter table public.ceremony_expenses enable row level security;
alter table public.revenue_adjustments enable row level security;
drop policy if exists ceremony_expenses_org on public.ceremony_expenses;
create policy ceremony_expenses_org on public.ceremony_expenses for all to authenticated
 using (organization_id=public.current_org() and public.app_current_role() in ('admin','finance'))
 with check (organization_id=public.current_org() and public.app_current_role() in ('admin','finance'));
drop policy if exists revenue_adjustments_org on public.revenue_adjustments;
create policy revenue_adjustments_org on public.revenue_adjustments for all to authenticated
 using (organization_id=public.current_org() and public.app_current_role() in ('admin','finance'))
 with check (organization_id=public.current_org() and public.app_current_role() in ('admin','finance'));

grant select,insert,update,delete on public.ceremony_expenses to authenticated;
grant select,insert,update,delete on public.revenue_adjustments to authenticated;

-- Repair all existing seat serials from actual row/column values. Temporary codes avoid uniqueness collisions.
update public.seats
set code='TMP-'||id::text, label='TMP-'||id::text
where row_number is not null and column_number is not null;

update public.seats s
set code=z.seat_prefix||lpad(s.row_number::text,greatest(2,length(z.rows_count::text)),'0')||'-'||lpad(s.column_number::text,greatest(3,length(z.columns_count::text)),'0'),
    label=z.seat_prefix||lpad(s.row_number::text,greatest(2,length(z.rows_count::text)),'0')||'-'||lpad(s.column_number::text,greatest(3,length(z.columns_count::text)),'0')
from public.seating_zones z
where s.zone_id=z.id and s.row_number is not null and s.column_number is not null;

notify pgrst,'reload schema';
commit;
