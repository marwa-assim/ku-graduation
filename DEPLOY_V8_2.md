# v8.2 Runtime and Academic Schema Repair

1. Preserve `.env.local`.
2. Replace the application source with this package.
3. In Supabase SQL Editor, run `supabase/migrations/011_schema_cache_and_runtime_repair.sql` in full.
4. Confirm the final result is `Success. No rows returned`.
5. Restart the Next.js development server. Do not leave the old server process running.
6. Run:

```bash
npm install
npm run typecheck
npm run dev
```

The migration creates `degree_levels` and `academic_programs` if absent, restores RLS and grants, and reloads the PostgREST schema cache.
