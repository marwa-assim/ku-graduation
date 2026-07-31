# Version 14.1 — Unified Live Attendance

## Required migration
Run `supabase/migrations/040_v14_1_unified_live_attendance.sql` before deployment.

## Corrections
- `entry_scans` is now the authoritative attendance source for dashboards, reports, tickets, seating and exports.
- Student and academic-staff entry is derived from accepted Graduate/Staff ticket scans.
- Guest entry is derived from accepted Free Guest/Paid Guest ticket scans.
- Scanner, admin and operational roles read the same organization-scoped scan records.
- New scans include `organization_id` and old scans are backfilled.
- Dashboard, report and ticket screens subscribe to live `entry_scans` updates.
- Ticket cards and chips display Entered/Awaiting Entry and entry time.
- Scanner-role report exports are enabled and use accepted scans.
