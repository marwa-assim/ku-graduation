# v11.6 Root-Cause Stability Release

No new Supabase migration is required.

## Root causes corrected

1. Bookings page
   - Rebuilt the client booking table with defensive array handling.
   - Removed fragile assumptions around tickets, seats and joined records.
   - Rebuilt QR rendering and sharing controls so malformed or missing joined data cannot crash the page.

2. Tickets page actions
   - Replaced the previous nested SVG ticket renderer that could throw during modal opening and sharing.
   - Added safe date parsing, null-safe ticket/event handling, standalone QR rendering and guarded download/email actions.
   - Each action is explicitly grouped under Graduate, Free Guest, Paid Guest or Academic Staff Seat.

3. Finance page
   - Removed fragile embedded relationship joins.
   - Finance now loads students, catalogues, tickets and seats independently, then joins them in application memory.
   - Missing optional finance records no longer prevent the page from loading.
   - Payment-status editing remains available to Admin and Finance.

4. VIP totals
   - VIP totals now count unique `people_directory` records whose `person_type` is exactly `vip`.
   - VIP committee login accounts are no longer counted as invited VIP guests.
   - The same logic is used on Dashboard and Reports.

5. Vendor email
   - Vendor email continues to use a `mailto:` link, opening the user's configured email application with recipient, subject and body prefilled for review before sending.

## Validation

After replacing the project files:

1. Stop the development server.
2. Delete `.next`.
3. Start the project again.
4. Hard-refresh the browser with Ctrl+F5.

Commands:

```cmd
rmdir /s /q .next
npm run dev
```
