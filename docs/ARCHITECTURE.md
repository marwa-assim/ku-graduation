# Architecture

## Browser
- Next.js React interface
- authenticated Supabase session
- role-aware navigation
- Realtime subscriptions for seat and ticket changes
- no privileged secrets

## Application server
- Next.js route handlers
- schema validation with Zod
- Microsoft Graph token acquisition and email delivery
- payment initiation
- payment webhook signature verification
- service-role access only where a trusted server operation requires it

## Database
- PostgreSQL
- normalized event, profile, seat, booking, payment, ticket and scan tables
- database transactions implemented as stored procedures
- Row Level Security
- atomic seat reservation and ticket scanning
- Realtime publication

## Recommended deployment
- Vercel or Azure App Service for Next.js
- Supabase managed PostgreSQL/Auth/Realtime
- Cloudflare or Azure Front Door for WAF and rate limiting
- Microsoft Entra ID can replace password sign-in through Supabase Azure OAuth
- scheduled invocation of `release_expired_holds()` every minute using Supabase Cron
