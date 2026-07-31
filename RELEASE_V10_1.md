# v10.1 Zone-safe seat and banner correction

Run migration `027_v10_1_zone_safe_seat_engine.sql` once.

The visible seat label is exactly `<prefix>-R<row>-S<seat>`. The database code adds a hidden zone suffix so left, centre and right zones may use the same prefix without violating the event/code unique constraint. Each zone restarts at row 1, seat 1 independently.

The dashboard Staff metric counts only genuine academic-staff records whose operational role is `academic_staff`; committee login accounts are excluded.

The active-event banner now selects the latest configured event and uses a prominent animated presentation.
