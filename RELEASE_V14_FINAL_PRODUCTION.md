# Version 14 — Final Production Candidate

## Corrected
- Ticket image footer is now placed below the QR area with reserved spacing and a divider.
- QR remains compact (`KU2:<token>`), high contrast, 420 px, H-level correction and a six-module quiet zone.
- Scanner no longer mirrors the camera preview.
- Scanner detects and avoids common virtual-camera devices when choosing a default camera.
- Users can explicitly select the correct camera when multiple cameras are installed.
- Desktop and mobile scanner layouts were normalized, including portrait mobile camera framing.
- Global responsive rules were tightened for forms, cards, modals, tables, tickets and dashboard grids.

## Required deployment checks
1. Run all pending Supabase migrations through `039_v13_production_qr_real_details.sql`.
2. Configure production environment variables.
3. Run `npm ci`, `npm run typecheck`, and `npm run build`.
4. Test one ticket from generation through first scan and duplicate rejection.
5. Complete an Ottu sandbox payment before enabling live payment credentials.
