# v8.6 Acceptance Test

1. Run `supabase/migrations/016_operational_master_audit_and_seat_repair.sql` in Supabase SQL Editor.
2. Restart the application.
3. Regenerate each seating zone once so continuous serials and aisle gaps are applied.
4. Create an academic staff login using role `academic_staff`.
5. Verify Fitting edit opens in a full modal, not inside the table.
6. Verify Users can update registration/payment status directly.
7. Verify Bookings allows exact available seat selection and cancellation.
8. Verify Tickets lists every student/staff record, including pending users.
9. Verify Invitation Select All and Send buttons return a visible result.
10. Verify Dashboard master CSV and Audit Trail.
