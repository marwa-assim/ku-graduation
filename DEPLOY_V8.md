# V8 consolidated acceptance release

1. Keep your existing `.env.local`.
2. Replace the source files with this package.
3. Run `supabase/migrations/009_operational_acceptance_fix.sql` in Supabase SQL Editor.
4. Run `npm install`, `npm run typecheck`, then `npm run dev`.

Key corrections: UUID-safe seating edits, stage left/centre/right zones, clickable user profile details, database-driven bookings/QR display, fitting and photography master lists, VIP available-seat assignment, service visibility and pricing, global searchable tables, and working report CSV exports.
