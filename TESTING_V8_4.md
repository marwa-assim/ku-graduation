# v8.4 full-cycle testing

## Required database step
Run `supabase/migrations/013_realtime_and_performance.sql` in the same Supabase project referenced by `.env.local`.

## Performance
Use `npm run build && npm run start` for realistic performance. `npm run dev` recompiles routes and is intentionally slower. The release adds composite indexes and enables Supabase Realtime for the operational tables. For production, deploy the Next.js app and Supabase in geographically close regions.

## Microsoft Graph email test
Configure `MS_TENANT_ID`, `MS_CLIENT_ID`, `MS_CLIENT_SECRET`, and `MS_SENDER_EMAIL`. The Entra application requires Microsoft Graph application permission `Mail.Send` with admin consent. Test from the Email screen or POST to `/api/email/send` while logged in as admin.

## Payment test
A real payment test requires the provider's sandbox endpoint and credentials in `PAYMENT_API_URL`, `PAYMENT_MERCHANT_ID`, `PAYMENT_API_KEY`, and `PAYMENT_WEBHOOK_SECRET`. The generic connector cannot invent Credimax request fields; align `lib/payment.ts` with the sandbox API specification supplied by the bank/provider before end-to-end testing.

## Multi-role synchronization
Open two separate browsers or an incognito window, sign in with different roles, and update a seat/status. Operational pages subscribed through `RealtimeRefresh` should refresh automatically. Verify each role against `tests/role-matrix.md`.
