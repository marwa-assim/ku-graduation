# v8.7 Email and Fitting Completion Test

1. Run `supabase/migrations/017_fitting_email_audit_completion.sql` in Supabase SQL Editor.
2. Restart the application after installing the new dependencies.
3. Fitting: verify only `pending` and `fitted` are available. Existing `measured` and `ready` values are migrated to `fitted`.
4. Invitations: save an email subject/body, select a student, send, and confirm:
   - personalized PNG invitation is attached;
   - delivery row changes to `sent` immediately;
   - `invitations.status` and `people_directory.invitation_status` are `sent`.
5. Booking email: complete a free booking and a sandbox paid booking. Confirm receipt of event/venue/GPS/login details and one inline QR image per ticket.
6. Audit: verify each authenticated role can open the read-only audit trail for its organization.
