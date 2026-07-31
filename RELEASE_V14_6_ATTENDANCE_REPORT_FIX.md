# Version 14.6 — Attendance Report Consistency Fix

## Root cause corrected

The live dashboard queried tickets with their `id`, but the Reports page and the master CSV export queried tickets without the ticket `id`.

Attendance is matched through:

`entry_scans.ticket_id -> tickets.id -> person_id/user_id`

Because `tickets.id` was absent in the Reports query, accepted scans could not be matched to a participant. This caused the dashboard to show entered students/staff while Reports showed zero.

## Changes

- Reports now select `tickets.id` and use the same `buildAttendance()` source as the dashboard.
- Master operations export now selects `tickets.id`, so exported entry status uses the same accepted scan records.
- Application version updated to `2.1.6`.

## Required deployment

No new database migration is required for this correction.

Deploy the latest commit and verify:

1. Scan one student ticket and one academic staff ticket.
2. Confirm Dashboard shows 1 entered student and 1 entered staff.
3. Confirm Reports shows the same values.
4. Export the master CSV and confirm both records have `entry_status=entered`.
