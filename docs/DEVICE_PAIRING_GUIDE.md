# DOPE Device Pairing & Multi-Device Control Guide

## 1. Security Guarantee
- An **unpaired device can never control your computer**.
- Pairing uses short-lived 6-digit codes (5-minute expiry) and server-signed HMAC tokens.
- Remote execution requires explicit approval (`Require Remote Approval` toggle in **Devices** and **Settings**).

## 2. How to Pair a New Device
1. Open the **Devices** tab in the DOPE Web Dashboard.
2. Enter a friendly device name (e.g., `Work Laptop` or `Pixel 9`) and select its platform (`windows`, `macos`, `linux`, `android`, `ios`, or `browser_extension`).
3. Click **Generate Pairing Code & QR**.
4. On the target device, scan the QR payload or enter the 6-digit code within 5 minutes (or click **Complete Pairing Verification** in the dashboard to test).
5. Verify the device appears under **Connected Devices** and toggle **Remote Control Approved** only for devices you trust.

## 3. Revoking a Lost or Untrusted Device
- Open **Devices**, locate the device, and click **Revoke**. Its session is removed immediately and it can no longer issue commands.
