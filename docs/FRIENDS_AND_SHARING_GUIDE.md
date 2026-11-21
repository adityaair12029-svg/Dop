# Sharing DOPE With Your Friends (Safe Multi-User Guide)

## Golden Rule: NEVER Share Your Private `GEMINI_API_KEY`
Never embed your personal `GEMINI_API_KEY` inside a Windows `.exe`, Android `.apk`, iOS app, or Chrome extension that you send to friends! If you do, anyone can extract that key and drain your Google Cloud billing quota.

## Safe Ways to Share DOPE

### Option 1: Friends Bring Their Own AI Studio Deployment (Zero Cost to You)
1. Push your DOPE code to GitHub.
2. Share the GitHub repository link with your friends.
3. Each friend opens it in their own Google AI Studio account (or deploys their own Cloud Run service) and adds their **own** `GEMINI_API_KEY` in **Settings > Secrets**.
4. Each friend signs in with their **own** Google account for Gmail and pairs their **own** devices.

### Option 2: Hosted Shared Backend (You Host & Pay/Rate-Limit)
1. Deploy the DOPE Node.js server (`server.ts`) to Cloud Run (`APP_URL`), keeping `GEMINI_API_KEY` strictly in server environment variables.
2. Share the **Shared App URL** with friends, along with the **Windows installer** (`DOPE-Setup-Windows.exe`), **Android `.apk`**, or **Chrome Web Store link** configured to call your backend `/api/dope/command` endpoint (which already includes rate limiting).
3. **Operational Cost Warning**: Every voice command parsed on a shared backend uses your server's Gemini token quota (`gemini-4-hydrogen` / `gemini-3.8-live`). Start on free/low-cost rate-limited tiers and monitor billing alerts in Google Cloud Console before sharing widely.

## How Friends Install Each Component
- **Web Dashboard**: Open the shared DOPE URL, click **Sign in with Google** (to authorize their own Gmail), and use voice or text commands immediately.
- **Windows**: Download `DOPE-Setup-Windows.exe` (code-signed if possible so Windows SmartScreen warns less), install, grant Microphone permission, and pair via **Devices**.
- **Android**: Install your signed `.apk` (or Play Store link), grant Microphone permission, and enable foreground listening if desired.
- **Browser Extension**: Install from Chrome Web Store / Edge Add-ons (or load `platforms/browser-extension` in Developer mode during beta testing).

## Accounts Needed for Official Store Distribution
- **Chrome Web Store**: Google Developer account ($5 one-time fee).
- **Microsoft Edge Add-ons**: Microsoft Partner Center (free).
- **Google Play Store (Android)**: Google Play Console ($25 one-time fee + app signing key).
- **Apple App Store / TestFlight (iOS) & macOS Notarization**: Apple Developer Program ($99/year).
- **Windows SmartScreen Trust**: EV or standard Code Signing Certificate (optional for friends during testing; recommended for public downloads).
