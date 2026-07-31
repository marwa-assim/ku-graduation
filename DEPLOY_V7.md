# Deploy v7
1. Back up the current project and database.
2. Keep the existing `.env.local`.
3. Replace project files with this package.
4. Run `supabase/migrations/007_reliability_and_operational_completion.sql` in Supabase SQL Editor.
5. Run `npm install`, `npm run typecheck`, and `npm run dev`.
6. Test Settings, Users, Fitting, Invitation upload, and seating-zone creation before importing production data.
