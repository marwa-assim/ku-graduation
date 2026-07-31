# Version 13 — Production QR, Scanner and Mobile Alignment

## Completed
- One compact QR format (`KU2:<secure-ticket-token>`) across ticket preview, downloadable ticket image, booking email and operational ticket views.
- Backward-compatible scanner support for legacy structured QR codes and raw historical tokens.
- High-contrast QR generation at 420 px, six-module quiet zone and high error correction.
- Automatic continuous scanning with faster frame attempts, rear-camera preference, duplicate suppression, audio/vibration feedback and real participant details.
- Scanner result data comes from Supabase, not from untrusted QR text.
- Catalogue UUIDs are replaced with real College and Programme names by migration 039.
- Mobile viewport/PWA metadata and additional responsive layout rules for phones and tablets.

## Required deployment steps
1. Run `supabase/migrations/039_v13_production_qr_real_details.sql` in Supabase SQL Editor.
2. Set the production `NEXT_PUBLIC_APP_URL` to the final HTTPS Render URL.
3. Confirm `Permissions-Policy: camera=(self)` is present after deployment.
4. Configure the Ottu production environment variables before enabling paid booking:
   - `OTTU_BASE_URL`
   - `OTTU_API_KEY`
   - `OTTU_PG_CODES`
   - `PAYMENT_WEBHOOK_SECRET` (when supplied/configured by the gateway)
5. Configure the Ottu dashboard redirect and webhook URLs to the production HTTPS domain.
6. Deploy, clear the browser cache/site permissions, allow camera access and test with a newly generated ticket.

## Acceptance test
- Open a newly generated ticket on one phone.
- Open `/dashboard/scanner` on another phone/laptop as scanner/admin/regcom.
- Scan once: real name, reference, ticket type and seat must appear and attendance must update.
- Scan the same ticket again: it must be rejected as already scanned.
- Test Graduate, Academic Staff, Free Guest and Paid Guest tickets.
- Complete one gateway sandbox payment and verify successful webhook confirmation, ticket issuance and email delivery before switching to live credentials.
