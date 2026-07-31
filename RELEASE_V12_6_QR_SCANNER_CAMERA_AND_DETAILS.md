# Version 12.6 — QR Scanner Camera and Participant Details

- Corrected the browser Permissions-Policy so the current origin may use the camera.
- Kept camera access restricted to the application origin; microphone and geolocation remain disabled.
- Added continuous automatic QR recognition with duplicate-read suppression.
- Added clear participant, ticket, seat, reference, college, programme and scan-time details.
- Added recent scan history, success/error sound, and supported-device vibration feedback.
- Improved camera error messages for denied permission, unavailable camera and camera-in-use conditions.
- Preserved USB/Bluetooth scanner and manual-entry fallback.
- Added migration 038 to return the participant details required by the scanner UI.
