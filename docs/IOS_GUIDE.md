# DOPE iPhone & iPad (iOS) Guide

## 1. Honest iOS Platform Boundaries
Apple **does not allow** third-party apps to run continuous, always-on background custom wake-word detection (`"Hey Dop"`) when the app is closed or locked—that capability is reserved exclusively for Siri.

Instead, `platforms/ios/` implements DOPE using Apple's officially supported technologies:
- **App Intents & Siri Shortcuts** (`DopeIntents.swift`): Say `"Hey Siri, ask DOPE to open YouTube"` or `"Run DOPE command"` hands-free.
- **Interactive App Microphone Button** (`DopeApp.swift`): Tap once inside DOPE for direct voice conversation.
- **Lock Screen / Home Screen Widgets & iPhone Action Button**: Instant one-tap launch into listening mode.

## 2. Requirements & Xcode Build Process
1. Mac running macOS 14+ with **Xcode 15+**
2. Apple Developer account (free personal team works for 7-day local testing on your own iPhone; paid $99/yr Apple Developer Program required for TestFlight or App Store distribution).
3. Open Xcode -> Create an iOS App project -> Add `DopeApp.swift` and `DopeIntents.swift` -> Enable **Siri** capability and `NSMicrophoneUsageDescription` + `NSSpeechRecognitionUsageDescription` in `Info.plist`.
4. Connect your iPhone via USB, select your Signing Team, and press **Run (`Cmd + R`)**.

## 3. Using Handoff & Remote Pairing
- Pair your iPhone via QR code in the DOPE **Devices** tab to send approved commands to your Windows/macOS computer (subject to remote approval settings).

## 4. Uninstall on iOS
- Long-press **DOPE** on your Home Screen -> **Remove App > Delete App**.
