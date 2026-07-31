# Version 12.3 — Production Entry Scanner

- Rebuilt the gate-entry screen as a responsive camera scanner with a transparent targeting frame and animated red scan line.
- Added continuous QR recognition using ZXing for broader mobile and desktop browser support.
- Restricted entry scanning to the current system ticket categories: Graduate, Free Guest, Paid Guest and Academic Staff.
- Preserved one-time-only scanning through an atomic database function and unique accepted-scan constraint.
- Added clear green success, red duplicate and red invalid-ticket feedback.
- Corrected guest-ticket attendance logic so scanning a guest ticket does not incorrectly mark the graduate as entered.
- Successful graduate and academic staff scans update their live arrival status.
- Successful guest scans are tracked through the ticket entry-scan record.
- Seating Plan now updates from accepted scans and highlights entered seats live for authorised users.
- Kept manual/USB scanner input as a backup without changing existing roles or workflows.

Apply `supabase/migrations/036_v12_3_production_entry_scanner.sql` before production use.
