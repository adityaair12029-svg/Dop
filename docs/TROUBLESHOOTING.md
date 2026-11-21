# DOPE Troubleshooting Guide

## 1. "Microphone permission denied" or mic won't start
- **Browser**: Click the lock/tune icon next to the URL bar -> set **Microphone** to **Allow**, then reload. Note: browsers require `https://` or `localhost` for microphone access.
- **Windows**: Settings > Privacy & security > Microphone > Enable for desktop apps and browsers.
- **macOS**: System Settings > Privacy & Security > Microphone > Enable your browser/DOPE Companion.
- **Android**: Settings > Apps > DOPE > Permissions > Microphone > Allow while using the app.

## 2. "Hey Dop" wake word isn't triggering in the browser
- Browsers only allow Web Speech API while the tab is open and microphone listening is active (and some headless/sandboxed browsers like Chromium without speech keys disable `SpeechRecognition`). Use the **Text Command Bar** or **Desktop Companion (`openWakeWord`)** for reliable always-on local wake-word detection.

## 3. "Gemini AI service unavailable"
- Check **Settings > Secrets** in Google AI Studio to verify `GEMINI_API_KEY` is configured.
- While Gemini is offline, DOPE automatically switches to its **Offline Deterministic Parser**, so core commands (`open YouTube`, `scroll down`, `zoom in`, `go to page 15`, `stop listening`) continue working without pretending AI is online.

## 4. Window minimize or "open Chrome" says "Desktop Companion not connected"
- A web dashboard or browser extension **cannot** control OS windows directly for security reasons.
- Install and run `platforms/desktop-companion/dope_companion.py` on your Windows/macOS/Linux PC and pair it in the **Devices** tab.

## 5. PDF "go to page 15" says unsupported
- Some standalone PDF readers or scanned-image PDFs do not expose page-jump shortcuts. Test inside DOPE's built-in PDF Testbench or use Adobe Acrobat / Microsoft Edge PDF with the Desktop Companion.
