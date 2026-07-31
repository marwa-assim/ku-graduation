# Version 14.4 — Authoritative Ticket Attendance

## Correction
Student and academic staff attendance is now derived exclusively from accepted `entry_scans` linked to their graduate or staff ticket. Legacy `people_directory.arrival_status` is retained only as a compatibility cache and is no longer used by dashboards, reports, people tables, ticket registers, seating maps, or CSV exports.

## Administration
Only an Admin can reset an entered student or academic staff member to Pending. The reset reverses the accepted scan record for the latest event through `reset_person_attendance`, clears the compatibility cache, and allows the ticket to be scanned again. No role can manually set a participant to Entered; entry is created only by scanning a valid ticket.

## Live consistency
The People screen now calculates arrival from the same accepted scans as Dashboard, Reports, Tickets, Map, and Exports. Realtime refresh on `entry_scans` synchronizes all open authorized role screens.

## Required migration
Run `supabase/migrations/042_v14_4_authoritative_ticket_attendance.sql` after migration 041.
