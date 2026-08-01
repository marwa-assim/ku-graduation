# Version 14.7 — Operational consistency and live refresh

- VIP export lists every invited VIP with seat, arrival status and arrival timestamp.
- VIP seating status is derived from the assigned seat; only arrival remains a quick action.
- VIP arrival is reflected live in cards, reports and the seating map.
- Quick operational updates refresh the current server view immediately after database confirmation.
- Student and academic-staff map views hide other occupants' names.
- All Microsoft Graph email sends automatically CC `ADMIN_CC_EMAILS` and the configured sender mailbox.
- Student guest booking no longer compares invalid `failed` or `refunded` values against `booking_status`.
- Photography and delivery are independent statuses with separate timestamps.
- Tailor and Photographer roles receive role-scoped report exports.
