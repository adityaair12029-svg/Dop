# DOPE — Universal AI Voice Assistant & Cross-Platform Device Automation

**Wake Phrase:** `"HEY DOP!"`

DOPE is a modular, privacy-first cross-platform AI voice assistant ecosystem inspired by the everyday convenience of Siri, built with its own architecture, voice interface, safety guardrails, and native platform adapters.

## Core Architecture

DOPE separates **reasoning** from **execution**:
1. **Local Wake-Word Engine (`openWakeWord`)** — Listens on-device on desktop/Android so pre-activation microphone audio is never streamed to cloud servers.
2. **Server-Side AI Brain (`Gemini 4 Hydrogen` & `Gemini 3.8 Live`)** — Translates English, Hindi, and Hinglish commands into strict, allowlisted, typed action schemas.
3. **Platform Automation Adapters** — Native execution layers for Windows 10/11, macOS, Linux (X11/Wayland-aware), Chrome/Edge Manifest V3 Extension, Android (Kotlin/Jetpack Compose), and iOS (AppIntents/Siri Shortcuts).
4. **Safety & Confirmation Gate** — Consequential actions (sending Gmail emails, deleting files, shutdown/restart, installing software, security changes) always pause for explicit user confirmation.

## Project Structure

- `server.ts` & `server/` — Express + WebSocket backend, Gemini AI interpreter, Gmail OAuth proxy, pairing & persistence store.
- `src/` — React + Tailwind CSS Web Dashboard, Voice Console, PDF Testbench, Command Library, Device Manager, and Guides Viewer.
- `src/shared/` — Allowlisted action registry, wake-word detector, Hindi/Hinglish normalizer, and deterministic `node:test` suite.
- `platforms/browser-extension/` — Chrome & Microsoft Edge Manifest V3 extension (`DOPE Assistant`).
- `platforms/desktop-companion/` — Python desktop companion + Windows UIA, macOS Accessibility, Linux X11/Wayland, and PDF viewer adapters.
- `platforms/android/` — Native Kotlin + Jetpack Compose Android app with Foreground Microphone Service.
- `platforms/ios/` — SwiftUI + Apple `AppIntents` + Siri Shortcuts companion.
- `docs/` — Complete beginner-friendly installation, sharing, security, and developer manuals.

## Documentation Index

1. [README.md](README.md)
2. [Installation Guide](docs/INSTALLATION_GUIDE.md)
3. [Windows Guide](docs/WINDOWS_GUIDE.md)
4. [macOS Guide](docs/MACOS_GUIDE.md)
5. [Linux Guide](docs/LINUX_GUIDE.md)
6. [Android Guide](docs/ANDROID_GUIDE.md)
7. [iOS Guide](docs/IOS_GUIDE.md)
8. [Browser Extension Guide](docs/BROWSER_EXTENSION_GUIDE.md)
9. [Device Pairing Guide](docs/DEVICE_PAIRING_GUIDE.md)
10. [Friends & Sharing Guide](docs/FRIENDS_AND_SHARING_GUIDE.md)
11. [Troubleshooting](docs/TROUBLESHOOTING.md)
12. [Privacy & Security](docs/PRIVACY_AND_SECURITY.md)
13. [Developer Guide](docs/DEVELOPER_GUIDE.md)
14. [Testing Guide](docs/TESTING_GUIDE.md)
