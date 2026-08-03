# Version 18.2 - High-accuracy QR scanner

- Uses the browser's native BarcodeDetector on supported Android/Chrome devices for Samsung-like fast recognition.
- Falls back to ZXing on devices without native QR detection.
- Requests the rear/environment camera on mobile and high-resolution 30fps video.
- Applies continuous focus, exposure, white-balance and supported optical zoom constraints.
- Draws a green lock-on frame around the recognized QR code before validation.
- Removes the dark/shadow overlay from the live camera preview.
- Keeps automatic validation, duplicate prevention, sound/vibration feedback and scan history.
