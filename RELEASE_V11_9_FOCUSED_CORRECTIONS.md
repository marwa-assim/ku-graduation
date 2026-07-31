# v11.9 Focused Corrections

- Ticket canvas increased and QR reduced/repositioned so the footer no longer sits behind the QR.
- QR now has a dedicated white/gold frame, larger quiet zone, and medium error correction for better readability.
- Payment webhook no longer attempts to store `failed` in `booking_status`; failed/expired paid holds become `expired`, seats are released, and stale booking-seat rows are removed.
- Keep-me-signed-in is now applied to auth refresh cookies for 30 days when selected.
- Student invitation wording now references the active event name.
- My Gown headings and descriptions are role-specific for student versus academic staff.
