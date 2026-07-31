# v11.10 Booking, VIP, Photo and Permission Integrity

- Cleans stale booking-seat links before administrator assignments.
- Prevents duplicate `booking_seats_seat_id_key` failures for seats that are actually available.
- Persists uploaded profile photos to both `people_directory.photo_url` and `profiles.photo_url`.
- Derives VIP seating status from seat assignment: assigned = seated; unassigned = pending.
- Shows VIP identity in authorised seat-map hover details.
- Enforces student view-only seat mode in both UI and booking API.
- Uses role-specific Student/Staff Photography wording.
