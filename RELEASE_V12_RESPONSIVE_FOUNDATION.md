# Version 12.0 — Responsive Foundation

## Scope
Presentation-layer responsiveness and navigation usability only. Existing branding, colours, routes, database schema, Supabase integration, permissions, and business workflows are unchanged.

## Implemented
- Mobile off-canvas navigation with backdrop, Escape-key close, route-change close, and body scroll lock.
- Responsive content shell using safe minimum widths and fluid page padding.
- Tablet and mobile grid collapse rules for dashboards, forms, metrics, and operational cards.
- Mobile-friendly top bar, profile menu, sign-out control, page headers, toolbars, buttons, and action groups.
- Safer responsive tables with touch scrolling.
- Responsive event ceremony banner, scanner, ticket, invitation, service-details, and seat-map containers.
- Overflow protection for long user, event, venue, and organization text.
- Reduced-motion accessibility support.

## Verification note
The source modifications were completed. Dependency installation could not finish in the isolated workspace before timeout, so the full Next.js build must be run in the normal project environment:

```bash
npm install
npm run typecheck
npm run build
```
