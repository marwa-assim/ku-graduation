# v11.5 Go-Live Emergency Integrity Release

## Required migration
Run `supabase/migrations/032_v11_5_go_live_integrity_payment_and_roles.sql` after migration 031.

## Corrected
- Fixed profile-only committee user deletion and the invalid `profile-...` UUID error.
- Admin Users cards now include VIP guests and system/committee users.
- Fixed dashboard ticket deduplication by selecting the actual ticket ID; graduate/free/paid counts now use every unique ticket.
- Student and academic-staff self-service fitting/photography pages no longer render the other population's empty sections or cards.
- Student invitation route now opens a personalised read-only invitation.
- Student stage map now includes graduate seats and highlights the logged-in student's seat.
- Academic staff map highlights the logged-in staff member's seat with a distinct enlarged gold marker.
- Ticket action groups display the ticket type beside QR/email/WhatsApp actions.
- Ticket email CC is sent as valid separate recipient addresses rather than one comma-containing address.
- Added large service details modal with image, notes, service link, vendor WhatsApp and vendor email actions.
- Corrected the PostgreSQL `FOR UPDATE is not allowed with aggregate functions` reservation failure.
- Free guest seats are confirmed immediately in a separate booking, while paid seats are held independently until payment succeeds or the configured hold expires.
- Added Ottu Checkout API support using server-side `Api-Key` authentication, BHD, short checkout URL, QR checkout URL, redirect URL and webhook URL.
- Added indexes for faster ticket and user operational queries.

## Ottu environment
```
PAYMENT_PROVIDER=ottu
OTTU_BASE_URL=https://sandbox.ottu.net
OTTU_API_KEY=<new private key>
OTTU_PG_CODES=<your Bahrain gateway code, comma separated if more than one>
NEXT_PUBLIC_APP_URL=https://your-public-domain
PAYMENT_WEBHOOK_SECRET=<configure only if your Ottu webhook signing setup supplies a matching signature>
```

Never place `OTTU_API_KEY` in `NEXT_PUBLIC_*` variables or browser code.
