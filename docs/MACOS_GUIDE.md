# DOPE macOS Installation Guide

## 1. Prerequisites
- macOS 13 (Ventura) or newer (Apple Silicon or Intel)
- Python 3.11+ (via Homebrew: `brew install python`)

## 2. Install the macOS Companion
```bash
cd platforms/desktop-companion
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
export DOPE_SERVER_URL="https://your-dope-backend-url"
python dope_companion.py
```

## 3. Packaging as a `.app` / `.dmg`
- Use `py2app` or `pyinstaller --windowed --name "DOPE Companion" dope_companion.py` to generate `DOPE Companion.app`.
- For distributing to friends on macOS, sign with an Apple Developer ID certificate and notarize via `xcrun notarytool` so Gatekeeper does not block launch.

## 4. Required macOS Permissions
macOS enforces strict privacy prompts on first use:
1. **Microphone**: **System Settings > Privacy & Security > Microphone** -> Enable **DOPE Companion** (or Terminal during testing).
2. **Accessibility (Window Controls)**: **System Settings > Privacy & Security > Accessibility** -> Add and enable **DOPE Companion** so `AXMinimized` and window switching work.
3. **Automation**: **System Settings > Privacy & Security > Automation** -> Allow DOPE Companion to control **System Events**.

## 5. Uninstall on macOS
1. Quit DOPE Companion from the menu bar or Terminal.
2. Move `DOPE Companion.app` from `/Applications` to Trash.
3. Revoke permissions under **Privacy & Security** and delete `~/Library/Application Support/DOPE`.
