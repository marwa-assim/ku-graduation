# Version 14.5 — Admin and Registration Committee Manual Attendance

## Authoritative attendance source

Student and academic-staff attendance is authoritative only when an accepted record exists in `entry_scans` for the corresponding Graduate or Staff ticket.

Both scanner entry and manual entry write to this same table:

- Scanner: `entry_method = scanner`
- Admin/Registration Committee: `entry_method = manual`

All dashboards, reports, cards, charts, ticket states, seating maps, realtime views and exports continue to derive attendance from accepted `entry_scans` records.

## Permissions

- Admin: Pending → Entered and Entered → Pending
- Registration Committee: Pending → Entered and Entered → Pending
- Scanner: creates Entered through valid ticket scanning only
- All other roles: view only according to their existing role permissions

## Manual entry safeguards

A manual Entered update requires a valid Graduate ticket for a student or Staff ticket for academic staff. This ensures attendance remains ticket-based and cannot create an unmatched attendee.

Resetting to Pending reverses the accepted attendance record, removes the entered state from all consumers and permits a later scan or manual entry.

## Required migration

Run after migration 042:

`supabase/migrations/043_v14_5_admin_regcom_manual_attendance.sql`
