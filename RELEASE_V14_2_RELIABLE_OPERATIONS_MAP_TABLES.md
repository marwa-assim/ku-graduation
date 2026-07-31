# Version 14.2 — Reliable Operations, Scanner Map and Table Readability

- Added the live seating map to the scanner navigation.
- Scanner reports now show the complete authorized operational lifecycle: registered, paid, assigned, entered, fitted, collected, photographed and invited.
- Dashboard and reports subscribe to the same live operational tables.
- Added organization-scoped read policies so authorized roles receive the same source records as admin without widening write permissions.
- Enabled Supabase Realtime for operational source tables.
- Reworked all professional tables to prevent words and letters from breaking incorrectly, preserve clear column alignment, improve spacing, and provide controlled horizontal scrolling on smaller screens.
- The authoritative sources remain:
  - Registration/payment: `people_directory`
  - Tickets/seat assignment: `tickets` + `seats`
  - Entry: accepted `entry_scans`
  - Fitting/collection: `fittings`
  - Photography: `photo_sessions`
  - Invitations: `invitations`
  - VIP seating/arrival: `vip_assignments`

Run migration `041_v14_2_role_data_consistency.sql` after migrations 039 and 040.
