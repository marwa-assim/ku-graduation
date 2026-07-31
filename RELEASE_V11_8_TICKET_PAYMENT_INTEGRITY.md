# v11.8 — Ticket Image, Role and Payment Integrity

Run migration `supabase/migrations/034_v11_8_ticket_image_booking_payment_integrity.sql` after migration 033.

## Delivered

- One server-rendered full PNG ticket is now used for preview, download, email attachment and native file sharing.
- Ticket PNG includes holder photo when available, holder name and ID, ticket type, seat, event, date/time, venue and navy one-scan QR.
- Email sends the same PNG to the ticket holder and CCs configured/registered administrators.
- WhatsApp/email-app sharing uses the browser's native file-share sheet when supported. Desktop fallback downloads the PNG and opens the selected application so the same image can be attached.
- Registration Committee cannot add/edit/delete users or use password-reset controls. Committee-user sections remain Admin-only.
- Finance/Admin payment status updates are performed with the server admin client and validated by returning the updated row.
- Payment status can be updated directly in the Bookings/Payments student table and is displayed in Revenue.
- Expired/cancelled/failed paid holds now remove stale `booking_seats` rows before seats become available.
- New reservations clean only stale seat links and preserve active confirmed/held/paid bookings, preventing `booking_seats_seat_id_key` failures.

## Restart

After replacing the project and running migration 034:

```cmd
rmdir /s /q .next
npm run dev
```

Hard refresh the browser with Ctrl+Shift+R.
