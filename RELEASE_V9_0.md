# KU Graduation Platform v9.0 Final Workflow Stabilization

## Required database step
Run `supabase/migrations/020_final_workflow_permissions_and_performance.sql` once in Supabase SQL Editor after backing up the database.

## Deployment updates without losing data
Application updates and database data are separate. Replacing/redeploying the Next.js application does not delete Supabase records. Existing students, users, bookings, tickets, seats, invitations, fitting, photography and finance records remain in Supabase.

For every future update:
1. Back up Supabase or create a database snapshot.
2. Deploy the updated application files/commit.
3. Run only the new numbered migration(s) that have not been run before.
4. Never rerun destructive seed/reset scripts in production.
5. Verify the release in a staging deployment before promoting it to production.
6. Roll back the application deployment if needed; do not restore the database unless the migration itself caused data damage.

## Validation
- `npm run typecheck`: passed.
- `npm run build`: compiled successfully and passed lint/type validation; the execution environment stopped during page-data collection due to its time limit.
