# v11.7 Runtime Root Fix

## Root cause corrected
The browser crash `Unknown encoding: base64url` came from the browser Buffer polyfill, which does not support Node's `base64url` encoding name. Ticket QR payload encoding now uses Web-standard `TextEncoder`, `btoa`, `atob`, and explicit URL-safe character conversion. This removes the crash from Bookings, Tickets, QR preview, Email and WhatsApp actions.

## Other corrections
- Finance payment-status update no longer passes an event handler from a Server Component; a Save button is used instead.
- Registration Committee no longer receives the System & Committee Users or Other Directory Records sections.
- Student menu label changed from My fitting to My gown.
- Student invitation renders the same saved invitation design, colours, background image, logo, fields and layout created in Admin > Invitations.
- Admin event settings include Show invitation to students and Student seat screen: Book and view / View only / Hidden.
- Expired paid holds are released on seating-map load and migration 033 schedules one-minute cleanup when pg_cron is available.
- Service details provide both Open email app and Open Gmail options because a mailto link depends on a configured default mail application.

## Deployment
Run migration 033, clear `.next`, reinstall/build, and restart.
