# v9.3 – Seat integrity and role-view stabilization

Run `supabase/migrations/022_final_seat_integrity_and_operational_repair.sql` once.

Implemented:
- Deterministic visible seat labels: `<zone prefix>-R<row>-S<seat>`.
- Aisles are visual gaps and never reduce seat capacity or consume serials.
- Existing seats are repaired without using a nonexistent `created_at` column.
- Booked/held seats are preserved while zones are regenerated.
- Seat labels are hidden on the dense map and shown on hover with occupant/status details.
- Land and committee seating access is view-only; zone editing is admin-only.
- Registration committee can assign/cancel graduate and academic-staff seats but cannot assign free/paid guest seats.
- Staff booking list is academic staff only.
- Tailor and photographer queues include students and academic staff.
- Audit navigation removed from all non-admin roles.
- Users navigation removed from land; committee users page is labelled for student registration.
- Services added across operational roles.
- VIP and land/reg committee can view VIP operations; only admin/VIP committee can edit.
- Organization logo defaults to the supplied KU logo and still supports organization logo_url.
- Raw QR token text removed from booking popovers.

Validation: `npm run typecheck` passed.
