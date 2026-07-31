# Production setup

1. Install Node.js 20 LTS and Git.
2. Create a Supabase project in the closest supported region.
3. Run `001_initial.sql`, then `002_multi_tenant_roles.sql`, then `seed.sql` and `seed-multitenant.sql`.
4. Create Supabase Auth users, then insert matching `profiles` rows with the correct organization and role.
5. Copy `.env.example` to `.env.local` and enter Supabase, Microsoft Graph and payment credentials.
6. Run `npm install`, `npm run typecheck`, `npm run build`, and `npm run dev`.
7. Test every role with separate accounts.
8. Create a private GitHub repository and deploy to Vercel or Azure App Service.
9. Add the production domain to Supabase Site URL and Redirect URLs.
10. Configure Microsoft Entra `Mail.Send` application permission and Exchange application access policy.
11. Configure the payment sandbox, signed webhook, return URL and production merchant credentials.
12. Add WAF, rate limits, monitoring, backups and point-in-time recovery.

## Required role checks
- Tailor, Admin and Registration Committee can update fittings for students and both staff categories.
- Photographer, Admin and Registration Committee can update photography.
- Scanner cannot edit tickets or people.
- Finance sees payments but cannot change seating.
- Student sees only personal fitting, photography, booking and ticket records.
- Organization data never crosses tenant boundaries.

## Acceptance tests
- Concurrent seat booking collision
- Paid, failed and cancelled payment
- Duplicate QR scan
- Mobile/tablet/desktop responsiveness
- Internet interruption and retry
- Realtime update from two browsers
- RLS denial for every unauthorized role
- Staff fitting and staff photography
- Backup restore test
