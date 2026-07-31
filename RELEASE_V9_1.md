# KU Graduation Platform v9.1 — Event Time and Seat Accuracy

Run `supabase/migrations/021_event_time_seat_numbering_and_resilience.sql` once after deploying this version.

Key corrections:
- Dashboard Staff KPI counts academic staff only.
- Event cards and shared banner display the configured ceremony start and end times in Bahrain time.
- Booking KPI cards show graduate, free guest and paid guest seat usage against each configured total.
- Aisle settings now mean “insert an aisle after seat N”; aisles do not replace seats or consume serial numbers.
- Seating Designer displays deterministic visible codes and no database UUIDs.
- Existing UUID-style seat codes are normalized by migration 021.
- Middleware keeps the browser session during temporary Supabase DNS/connectivity failures instead of forcing logout.

After migration 021, open each changed seating zone and click regenerate once if its row/column capacity was modified after the migration.
