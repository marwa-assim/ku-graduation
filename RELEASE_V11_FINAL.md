# KU Graduation Platform v11 Final

## Final implementation scope

- Admin dashboard academic-staff register no longer shows Degree, Program or Invitation columns.
- Added live KPI cards and a ceremony operations chart for VIP totals, student/staff/VIP entry, staff fitting/collection/photography and VIP seat assignment.
- Student and academic-staff dashboard registers include Entered and Entry time.
- Booking totals use distinct active ticket seat IDs, preventing over-counting such as 251 assigned when only 250 seats exist.
- Booking-by-program includes the complete academic-program catalogue, including programmes with zero bookings.
- Added Academic Staff Seats Assigned / Total card.
- Graduate, free guest, paid guest and academic-staff seat selectors are naturally/alphabetically ordered.
- Tickets page lists every student and academic staff member, including records without an assigned seat.
- Academic staff tickets include QR preview, download, email and WhatsApp sharing.
- Fitting and photography have separate student and staff add actions.
- Student/staff selectors support search by name or ID.
- Reports and insights include entered students, entered academic staff, entered VIP, staff operations and VIP seat assignment.
- Added dedicated CSV exports for entered students, entered academic staff and entered VIP.
- QR scanning updates people_directory.arrival_status, arrived_at and arrived_by immediately and synchronises VIP arrival where applicable.

## Required migration

Run this migration after all previous migrations:

`supabase/migrations/028_v11_final_arrival_reporting_and_scan_sync.sql`

## Validation checklist

1. Assign one graduate seat and verify it appears immediately in Tickets > Students.
2. Assign one academic-staff seat and verify it appears in Tickets > Academic Staff.
3. Scan each QR once and verify Entered status and time on Dashboard and Reports.
4. Confirm the second scan is rejected as already used.
5. Compare Free Guest Assigned with the distinct active free-guest tickets.
6. Confirm every academic programme appears in Bookings by Program.
