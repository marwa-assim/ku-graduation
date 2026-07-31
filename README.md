# Professional Multi-Tenant Ceremony Platform

This package expands the original KU graduation prototype into a reusable solution for universities and companies.

## Roles
Student, Admin, Scanner, Registration Committee, VIP, Land/Venue, Finance, Tailor and Photographer.

## Implemented shared modules
Organizations, multiple events, people directory, student and staff fitting, photography, seating, booking, payments foundation, tickets, QR scanning, VIP, services, schedules, email and reports.

## Important permission rules
- Tailor, Admin and Registration Committee update student, academic staff and administrative staff fittings.
- Photographer, Admin and Registration Committee update photography records.
- Supabase RLS enforces role and organization isolation.
- Realtime refresh keeps role screens synchronized.

Read `docs/PRODUCTION-SETUP.md` for installation, database and publishing steps.

External live payment and Microsoft 365 sending require the institution's actual sandbox/production credentials and provider documentation. Those cannot be safely embedded in source code.

## v5 upgrade
Run `supabase/migrations/005_complete_admin_and_enum_fix.sql` after migration 004. It fixes the `seat_status` enum error and adds degree levels, academic programs, person academic links, invitation designs, and their RLS policies.
