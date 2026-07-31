# v11.11 — Seat Reconciliation and Audit Cleanup

- Repairs VIP or other seats that remain visually booked after their real assignment is deleted.
- Adds an authoritative seat reconciliation RPC based on VIP assignments, valid tickets and active booking holds.
- Runs reconciliation automatically after zone regeneration.
- Adds a manual **Repair stale seat statuses** control for Admin.
- Adds per-record audit deletion, deletion of records older than 30 days, and clear-all for Admin only.
- Adds a database trigger to keep VIP seat status and VIP seating status synchronized.

Run migration `037_v11_11_seat_reconciliation_and_audit_cleanup.sql` after migration 036.
