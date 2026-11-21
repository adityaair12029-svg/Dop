# DOPE Windows 10 & Windows 11 Whole-Laptop Assistant Guide

## 1. Prerequisites
- Windows 10 (64-bit) or Windows 11
- Python 3.10+ (from `python.org` — check **"Add Python to PATH"** during install)
- Optional for building an `.exe` installer: `pyinstaller` + Inno Setup 6

## 2. 1-Click Install & Run Across Whole Laptop (`Alt + D + T`)
Because browser extensions cannot run on the Windows Desktop Home Screen or when Chrome is closed, use the **DOPE Whole-Laptop Desktop Assistant**:
1. In the DOPE web dashboard **Platforms** tab, click **Download Desktop Assistant (.zip)** (`DOPE-Desktop-Assistant.zip`).
2. Right-click the ZIP &rarr; **Extract All...**.
3. Double-click **`Run-DOPE-Desktop.bat`**.
   - It automatically creates `.venv`, installs dependencies (`requests`, `keyboard`, `pynput`, `SpeechRecognition`, `pyttsx3`, `pywinauto`, `pycaw`), and connects to your DOPE backend URL.
4. Press **`Alt + D + T`** anywhere on Windows — Desktop Home Screen, File Explorer, VS Code, or over any window!
   - Plays a sweet harmonic bell chime, opens your laptop microphone, answers any AI question out loud, opens URLs, launches apps, and controls windows & volume.

## 3. Generate a Standalone Windows Installer
1. Bundle the companion into a single executable using PyInstaller:
   ```powershell
   pip install pyinstaller
   pyinstaller --onefile --name DopeCompanion dope_companion.py
   ```
2. Package `dist\DopeCompanion.exe` and `platforms\browser-extension\native_messaging_host.json` using **Inno Setup** into `DOPE-Setup-Windows.exe`.

## 4. Permissions Required on Windows
- **Microphone Access**: Open **Windows Settings > Privacy & security > Microphone** and toggle **Let desktop apps access your microphone** to **On**.
- **UI Automation / Window Controls**: Runs under standard user permissions for normal apps. Note: Windows UIPI blocks automating elevated (Administrator) windows unless DOPE runs at matching privilege.

## 5. Enable Wake-Word Mode ("Hey Dop") & Auto-Startup
1. In `wake_word_engine.py`, `openWakeWord` runs locally on your CPU at 16kHz—no audio leaves your PC before `"Hey Dop"` triggers.
2. To launch automatically at sign-in:
   - Press `Win + R`, type `shell:startup`, and press Enter.
   - Create a shortcut to `DopeCompanion.exe` (or `pythonw.exe dope_companion.py`) inside that Startup folder.

## 6. Testing "Hey Dop" on Windows
- Say `"Hey Dop, open Chrome"` -> launches Chrome if installed.
- Say `"Hey Dop, minimize this window"` -> minimizes the foreground window.
- Say `"Hey Dop, increase the volume"` -> raises Windows master audio endpoint via `pycaw`.

## 7. Uninstall DOPE on Windows
1. Remove the shortcut from `shell:startup`.
2. If installed via Inno Setup, open **Settings > Apps > Installed apps > DOPE** and click **Uninstall**.
3. Delete the `platforms/desktop-companion/.venv` folder and registry key `HKCU\Software\Google\Chrome\NativeMessagingHosts\com.dope.assistant` if registered.
