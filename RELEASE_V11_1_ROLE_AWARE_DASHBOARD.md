# KU Graduation Platform v11.1 — Role-Aware Dashboard & Reports

This release corrects dashboard totals, metric ordering, chart grouping, dark-theme hover behaviour, and role visibility.

## Dashboard and report presentation

- Student metrics appear first, followed by Academic Staff, then VIP.
- Each metric card displays `current / applicable total`, a percentage, and a progress indicator.
- Separate operational charts are provided for Students, Academic Staff, and VIP.
- The large white Recharts hover rectangle has been removed.
- Tooltips now use a dark KU-branded panel with a gold border and readable text.

## Role-aware visibility

- Admin, Registration Committee and Land Committee: full Student, Academic Staff and VIP operational groups.
- Scanner: total and entered metrics for Student, Academic Staff and VIP, plus authorised entry exports.
- VIP Committee: VIP metrics and VIP-authorised exports only.
- Finance: Student total, registration and payment metrics only.
- Tailor: Student and Academic Staff fitting/collection metrics only.
- Photographer: Student and Academic Staff photography metrics only.
- Student and Academic Staff users: personal readiness status only.

No database migration is required for this release.
