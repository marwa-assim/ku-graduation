# KU Graduation Platform v9.5

## Required migration
Run `supabase/migrations/024_ticket_ui_seat_constraint_photo_password_and_dedup.sql` once.

## Corrections
- Fixes `seats_section_check` during zone regeneration by using the original supported section values: stage, guest, VIP and staff.
- Normalizes all generated zone seats to one prefix-row-seat code.
- Adds profile-photo upload from Admin > Users and uses the photo in ticket rows and ticket artwork.
- Adds direct Admin password setting in addition to reset-email delivery.
- Removes duplicate ticket rendering by ticket ID and excludes cancelled tickets.
- Rebuilds the ticket register with student photo, QR, email, WhatsApp and more-action icons.
- Places Graduate, Free Guest and Paid Guest ticket summary cards below the register.
- Groups student seat booking by the actual configured Free Guest and Paid Guest zones.
- Shows live selected quantities, remaining quotas and total BHD before confirmation.
- Highlights seats already booked by the logged-in student.
- Updates the student map locally after free booking instead of reloading the whole page.

## Paid booking configuration
A payment link is created only when the payment-provider environment variables described in `.env.example` are configured. Without valid provider credentials, the API returns a clear payment-creation error and the held seat is released after the configured hold period.
