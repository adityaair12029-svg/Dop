# DOPE Installation Guide (Beginner Step-by-Step)

## Part A: Running and Managing DOPE in Google AI Studio

1. **Select Build Mode**: Open Google AI Studio and open the **Build** workspace for DOPE.
2. **Preview the Application**: The built-in preview panel runs the full-stack server (`server.ts`) on port `3000`. Wait for the preview pane to finish loading.
3. **Inspect Generated Code**: Open the file explorer sidebar in Google AI Studio to inspect:
   - `src/` for the web dashboard UI
   - `server/` for the Gemini AI backend
   - `platforms/` for Windows, macOS, Linux, Android, iOS, and Browser Extension source files
   - `docs/` for all user guides
4. **Configure Secrets**:
   - Open **Settings > Secrets** in Google AI Studio.
   - Ensure `GEMINI_API_KEY` is set. DOPE reads this **only on the server** (`process.env.GEMINI_API_KEY`) and never exposes it to browsers, extensions, or mobile builds.
   - Optionally set `DOPE_PAIRING_SECRET` to a random 32+ character string if you deploy to production.
5. **Connect GitHub**:
   - Click the GitHub integration icon in AI Studio to push DOPE to your private or public repository so you can clone it locally to build Windows, Android, or iOS packages.
6. **Export & Local Setup**:
   ```bash
   git clone <your-repo-url>
   cd dope-assistant
   npm install
   cp .env.example .env
   # Add your GEMINI_API_KEY in .env (never commit .env!)
   npm run dev
   ```
7. **Deploy Supported Web Components**:
   - Use **Deploy** in Google AI Studio (Cloud Run) or run `npm run build && npm start` on any Node.js 22+ host with `GEMINI_API_KEY` configured as a server environment variable.

## What Works Where

- **Web Dashboard (here in browser)**: Voice input (Web Speech API / Gemini Live), English/Hindi/Hinglish command understanding, opening websites, Google Search, PDF Testbench scrolling/zoom/page navigation, Gmail inbox reading & confirmation-gated email sending, Custom Aliases, and Device Pairing.
- **Browser Extension**: Tab switching, zooming, reloading, scrolling web pages, and talking to the Desktop Companion.
- **Desktop Companion**: Launching desktop apps, minimizing/maximizing/switching OS windows, controlling system volume, local `"Hey Dop"` wake-word detection, and desktop PDF readers.
- **Android & iOS**: Native mobile interfaces built from `platforms/android` and `platforms/ios`.
