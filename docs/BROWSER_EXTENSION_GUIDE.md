# DOPE Browser Extension Guide (Chrome & Microsoft Edge)

## 1. Standalone Pi-Style Extension (Browser Tabs)
DOPE ships as a Manifest V3 Chrome & Edge Extension with a **Pi-style Voice Orb & Side Panel**, **Toolbar Popup**, **Wake-Word Listening ("Hey Dop")**, **Sweet Harmonic Bell Chimes (Activate, Executing, Success, Error)**, **AI Question-Answering (`Gemini AI` + Offline Q&A)**, and **`Alt + D + T`** (plus **`Alt + D`**) instant voice activation on any Chrome/Edge tab.

- **Works out of the box (standalone in Chrome/Edge tabs)**:
  - **Ask any AI question**: `"Hey Dop, what is 25 * 48?"`, `"Who invented Python?"`, `"What is the capital of India?"` (in English, Hindi, or Hinglish)
  - Open websites (`"Hey Dop, open YouTube"`, `"Hey Dop, open Instagram"`, `"Hey Dop, open ChatGPT"`, `"Hey Dop, YouTube kholo"`)
  - Play/search directly on YouTube (`"YouTube pe lofi music chalao"`, `"play coding music on YouTube"`)
  - Open new tabs, switch tabs, duplicate, mute/unmute, go back/forward, reload, or close tabs
  - Scroll up/down/top/bottom, zoom in/out/reset, and minimize/maximize/restore Chrome windows
- **Whole-Laptop / Windows Desktop Home Screen (`DOPE-Desktop-Assistant.zip`)**:
  - Browser extensions are OS-sandboxed to Chrome/Edge tabs and cannot listen to hotkeys or launch OS microphones when Chrome is minimized or you are on the Windows Desktop home screen. Download **`DOPE-Desktop-Assistant.zip`** from the **Platforms** tab, extract it, and run `python dope_companion.py` to use **`Alt + D + T` everywhere on your laptop**!

## 2. Customize Your Logo & Download (.zip)
1. Open the DOPE web dashboard and go to the **Platforms** tab.
2. Under **DOPE Chrome & Edge Extension**, click **Upload Custom Logo** and select your PNG, JPG, WebP, or SVG logo. DOPE automatically generates `16x16`, `48x48`, and `128x128` PNG icons inside your bundle.
3. Click **Download Chrome Extension (.zip)** (`DOPE-Chrome-Extension.zip`).

## 3. Load Locally in Developer Mode (Chrome & Edge)
> **Important:** Do NOT drag `DOPE-Chrome-Extension.zip` directly onto `chrome://extensions`. Chrome rejects unextracted `.zip` files as `"Package is invalid: CRX_HEADER_INVALID"`. Always extract the ZIP first!

1. **Extract** `DOPE-Chrome-Extension.zip` (on Windows: Right-click -> **Extract All...**; on macOS: double-click the `.zip`).
2. Open `chrome://extensions` (Chrome) or `edge://extensions` (Microsoft Edge).
3. Enable the **Developer mode** toggle in the top-right corner.
4. Click **Load unpacked** and select the extracted **`DOPE-Chrome-Extension`** folder (the folder directly containing `manifest.json`).
5. Press **`Alt + D + T`** (or **`Alt + D`**) anywhere on a Chrome tab (or pin **DOPE Assistant** to your toolbar) — DOPE plays a sweet bell activation chime and starts listening immediately! (Chrome MV3 manifest shortcut uses `Alt+D`, while DOPE's tab overlay listens to both `Alt+D+T` and `Alt+D`).

## 4. Optional: Connect to the Desktop Companion (Native Messaging)
1. Open `native_messaging_host.json` inside the extension folder.
2. Replace `REPLACE_WITH_YOUR_EXTENSION_ID` with your actual Extension ID and set `path` to your local `dope_native_host.bat` (Windows) or `dope_native_host.sh` (macOS/Linux).
3. Register the JSON manifest path:
   - **Windows Registry**: `HKCU\Software\Google\Chrome\NativeMessagingHosts\com.dope.assistant` (and `Software\Microsoft\Edge\NativeMessagingHosts\com.dope.assistant`) with default string value pointing to `native_messaging_host.json`.
   - **macOS**: Copy to `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.dope.assistant.json`.
   - **Linux**: Copy to `~/.config/google-chrome/NativeMessagingHosts/com.dope.assistant.json`.
4. Open the extension and verify the status indicator reads `Desktop Companion: Connected`.

## 5. Publishing a Store Version
- Because `manifest.json` is already at the root of `DOPE-Chrome-Extension.zip`, you can submit the `.zip` directly to the **Chrome Web Store Developer Dashboard** ($5 one-time fee) and **Microsoft Edge Add-ons** (free developer registration).
