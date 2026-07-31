# v8.5 verification

1. Run `supabase/migrations/015_finance_roles_booking_and_ui_repair.sql` in Supabase SQL Editor.
2. Restart the app.
3. Organizations: top-right Add organization opens the form.
4. Settings: Add college/degree/program buttons are located inside their own section; edit/delete remain on each record.
5. Bookings: admin can assign a college-matched graduate seat, set free/paid guest quantities, and remove issued seats. Administrative allocations have zero payment.
6. Academic staff: create the account with role `academic_staff`; verify view-only ceremony, services, seating, own fitting and tickets.
7. Seating: verify column 100 is formatted as `100`, not `10`, after migration; seats remain visually separated.
8. Finance: add/edit/delete expenses; verify registration and ticket revenue cards and net revenue.
9. Events: configure paid-ticket and extra-ticket sales periods and prices.
10. Contact: update contact fields in Settings and verify Contact us for each role.
