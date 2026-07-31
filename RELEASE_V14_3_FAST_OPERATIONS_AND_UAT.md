# Version 14.3 — Fast Operational Updates and UAT Package

## Performance correction
Operational status changes such as Fitted, Collected, Photography, VIP arrival and service status now use a lightweight authenticated PATCH endpoint with optimistic user-interface feedback. The screen no longer waits for a full server redirect and complete page reload before showing the selected value.

- The selected status appears immediately.
- A small spinner is shown while Supabase confirms the update.
- A check mark confirms success.
- The previous value is restored if the database rejects the change.
- Supabase Realtime continues to propagate the confirmed value to other open roles and screens.

## Deployment
1. Back up the current Render environment variables and Supabase database.
2. Run all migrations through `041_v14_2_role_data_consistency.sql`.
3. Extract this release and run `npm ci`, `npm run typecheck`, and `npm run build`.
4. Push to the production Git branch or upload to the Node-capable hosting platform.
5. Confirm the production environment variables.
6. Redeploy and run smoke tests before opening access to users.

## WordPress hosting
This application is a Next.js Node.js application and cannot normally be copied into a conventional PHP-only WordPress shared-hosting directory. It can share the same domain using a subdomain or reverse proxy when the host supports Node.js applications. Recommended deployment: keep WordPress on the main domain and deploy the event platform to a Node-capable service such as Render, then use a subdomain such as `events.example.edu`.
