# KU Graduation Platform v10.0 Production Stabilization

## Database migrations
Run in order after the previously applied migrations:

1. `supabase/migrations/025_v10_production_seat_password_arrival.sql`
2. `supabase/migrations/026_v10_live_service.sql`

## Main changes
- Replaced seat regeneration with a deterministic, collision-safe generator.
- Every physical seat is coded as `<PREFIX>-R<ROW>-S<SEAT>`.
- Aisles are display gaps and never consume seat numbers.
- Existing booked/held seats are preserved during regeneration.
- Added dedicated Admin password administration in Settings with user search, direct password setting and reset-email action.
- Added student arrival status (`pending` / `entered`) and timestamp support.
- Removed registration/payment columns from academic-staff booking, fitting and photography tables.
- Added live-streaming as a service type; a confirmed live-stream service is used by the embedded Services player.
- Improved modal positioning so editing opens in a centered overlay rather than at the top of a long page.

## Important configuration
Direct password setting requires `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` on the server. Never expose this key to the browser.

## Seat repair procedure
After migration 025:
1. Open Seating Designer.
2. Confirm a unique prefix for every zone.
3. Regenerate each zone once.
4. Verify row 1 ends exactly at the configured seats-per-row count.

## Safe deployment
Application redeployment does not remove Supabase records. Never run reset or seed scripts against production. Back up the database before migrations.
