# KU Graduation Platform v11.3

## Required migration
Run `supabase/migrations/030_v11_3_ticket_scanner_accuracy_performance.sql` after migration 029.

## Corrections in this release
- Deduplicates ticket joins before dashboard guest-seat counts are calculated.
- Uses one structured QR payload for preview, download, email and booking-page QR actions.
- QR payload contains ticket ID, secure token, person ID/reference, ticket type and seat.
- Scanner accepts both new structured QR payloads and legacy token-only QR codes.
- Adds live camera QR scanning through the browser BarcodeDetector API with manual/scanner fallback.
- Makes accepted, invalid and already-used scanner results visually distinct.
- Enforces one accepted entry scan per ticket at database level.
- Ticket QR is navy and the ticket header remains within the gold border.
- Removes the broken external logo reference from downloaded SVG tickets.
- Ticket email automatically CCs configured and database admin addresses.
- Booking-page QR actions send the branded ticket image by email and use file sharing where supported.
- Fixes finance revenue calculation when Supabase returns nested seat relations as arrays.
- Adds administrator service editing and simplifies non-admin service totals to Total and Confirmed.
- Student guest-booking page now includes a view-only graduate-stage map with the student's seat highlighted.
- Student and academic-staff ticket screens no longer render the other person's section.
- Registration Committee no longer receives the seat-assignment navigation entry and booking assignment controls are Admin-only.
- Adds query indexes for tickets, bookings, seats and person/profile resolution.

## Validation
The modified source was structurally inspected. Full TypeScript validation requires running `npm install` locally because dependencies are not bundled in this release archive.
