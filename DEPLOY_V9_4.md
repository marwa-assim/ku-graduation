# KU Graduation Platform v9.4

1. Back up the production Supabase database.
2. Replace the application code with this release.
3. Run only `supabase/migrations/023_quota_atomic_booking_live_entry_and_seat_normalization.sql` in Supabase SQL Editor.
4. In Seating Designer, regenerate each zone once. The generator preserves booked/held seats while normalizing every visible seat code.
5. Confirm that every zone has a unique Seat Prefix in its settings (for example GR, VIP, STF, F, P).
6. Configure payment provider environment variables before testing paid tickets.
7. In Events, enter the live stream URL and enable the live-stream checkbox when ready.

The migration enforces free/paid quotas in the database, not only in the interface. It also uses row locks so two students cannot reserve the same seat at the same time. Expired paid holds are released automatically the next time a booking starts.
