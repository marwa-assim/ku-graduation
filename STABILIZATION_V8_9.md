# v8.9 Production Stabilization

Run `supabase/migrations/019_production_stabilization.sql` once after deploying this source.

Key corrections:
- Compatible audit logging for both legacy (`entity_type/action`) and current (`table_name/operation`) schemas.
- Status updates no longer fail because of legacy audit NOT NULL columns.
- Compact dashboard KPI cards restored.
- Separate charts for Registered, Paid, Fitted, Collected, Photographed, Invitations and Graduate bookings, each by College, Degree and Program.
- Reports screen mirrors the same complete analytics and retains CSV exports.
- VIP invited people can be created without login and are visible in Users.
- Existing Auth accounts can be safely linked instead of always returning a false duplicate-email message.
- Student and staff booking sections remain separate.
- Graduate seat filtering accepts college-specific seats and unassigned shared graduate seats.
- Latest ceremony is used by the booking page.
- User-facing seat labels are clean; internal collision-safe codes remain hidden.
- Invitation status update is verified after successful email delivery.
- Organization identity saving verifies that the organization row was actually updated.
