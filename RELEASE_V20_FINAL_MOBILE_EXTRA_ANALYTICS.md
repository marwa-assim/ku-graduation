# Version 20 - Final Mobile Map, Responsive Records and Extra Ticket Analytics

## Included
- Viewport-aware seat tooltip anchored near the selected seat on mobile and desktop.
- Mobile venue map preserves the desktop seating order and scrolls horizontally instead of compressing or wrapping seats.
- Student map rows remain continuous and display clear seat state without exposing other participants' names.
- Operational tables automatically become expandable mobile record cards while desktop tables remain unchanged.
- Invitation preview edge and overflow constraints improved for small devices.
- Extra paid tickets are stored explicitly and shown as Extra Paid Parent Tickets.
- Extra ticket counts are included in authorized dashboards and readable CSV exports.
- Booking exports include extra seat quantity and extra revenue.

## Required migration
Run `supabase/migrations/049_v20_extra_ticket_identity_and_analytics.sql` after migration 048.
