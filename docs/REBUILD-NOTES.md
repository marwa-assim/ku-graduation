# Professional rebuild notes

Run migrations in order: `001_initial.sql`, `002_multi_tenant_roles.sql`, corrected `003_booking_rules_admin_vip.sql`, then `004_professional_event_platform.sql`.

The v4 rebuild adds editable tenant branding, organization administration, expanded event details and GPS, user/login creation with role assignment, CSV directory import, college configuration, visual stage/audience seating zones, compact seats, aisle columns, pricing, live dashboards, charts and CSV reporting.

Before production, configure Microsoft Graph and payment gateway secrets, test all RLS policies with every role, and add scheduled execution for expired paid-seat holds.
