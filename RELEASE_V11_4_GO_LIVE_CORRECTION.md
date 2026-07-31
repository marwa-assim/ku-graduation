# KU Graduation Platform v11.4 — Go-Live Correction

Run `supabase/migrations/031_v11_4_final_role_and_directory_repair.sql` after migration 030.

## Corrected in this release
- Admin Users now includes every authenticated system/committee account, including Admin, Registration Committee, Land, VIP, Scanner, Finance, Tailor and Photographer accounts.
- New login profiles are automatically synchronized into `people_directory`.
- Land and Registration Committee VIP screens are strictly read-only: no edit/delete actions and no editable seating/arrival dropdowns.
- Booking data is normalized for Supabase one-to-many relation shapes and ticket rows are deduplicated by ticket ID before all counts and per-person seat lists are calculated.
- Free and paid guest ticket counts use unique ticket records and no longer double when a person is matched by both `person_id` and `profile_id`.
- Finance student relations are normalized to prevent the server-side rendering failure caused by array-shaped joined records.
- Ticket and event joined records are normalized before rendering, fixing Preview/Email/WhatsApp modal failures caused by Supabase relation arrays.
- Admin Services restores Total, Confirmed, Planned and Cancelled cards; non-admin roles continue to see Total and Confirmed only.
- Existing v11.3 QR scanner, unique ticket payload and single-scan enforcement remain included.

## Required validation after migration
1. Sign in as Admin and verify all committee/system login users appear under **System & Committee Users**.
2. Sign in as Land and Registration Committee and verify VIP seating/arrival cells are badges, not dropdowns.
3. Open Bookings and verify assigned Free/Paid counts equal the actual unique tickets.
4. Open Finance as Admin and Finance role and update a student payment status.
5. Open Tickets and test Preview, Email and WhatsApp for Graduate, Free Guest and Paid Guest tickets.
6. Open Services as Admin and verify four cards; sign in as another role and verify only Total and Confirmed.
