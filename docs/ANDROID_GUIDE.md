# DOPE Android Installation Guide

## 1. Architecture & Permissions
The Android companion (`platforms/android/`) uses **Kotlin + Jetpack Compose** and strictly follows Android 13/14/15 privacy rules:
- `RECORD_AUDIO`: Requested cleanly at runtime before listening.
- `FOREGROUND_SERVICE_MICROPHONE`: Required whenever optional `"Hey Dop"` listening is active; Android always shows a persistent notification with a **Stop Listening** action button. DOPE never hides this notification.

## 2. Building an APK or Android App Bundle (`.aab`)
1. Install **Android Studio** (Ladybug or newer) with Android SDK 34+.
2. Create a new Compose project or open the `platforms/android` module in Android Studio.
3. Configure your backend URL in `BuildConfig` (never embed a private `GEMINI_API_KEY` inside the APK!).
4. Build a debug/release APK:
   - **Android Studio**: **Build > Build Bundle(s) / APK(s) > Build APK(s)**
   - **Command line**: `./gradlew assembleRelease` (APK) or `./gradlew bundleRelease` (Play Store `.aab`)

## 3. Installing on Your Phone
1. Transfer `app-release.apk` to your Android phone.
2. Tap the APK and allow **Install unknown apps** for your file manager when prompted.
3. Open **DOPE** -> Tap **Allow Microphone Access** -> Choose **Tap to Speak** or **Enable Hey Dop Mode**.

## 4. Battery & Background Operation
- Continuous microphone listening consumes battery; toggle **Enable Hey Dop Mode** off when not needed, or tap **Stop Listening** directly in the persistent Android notification shade.

## 5. Uninstall on Android
- Long-press the **DOPE** icon -> **App info > Uninstall**.
