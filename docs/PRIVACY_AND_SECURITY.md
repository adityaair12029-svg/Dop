# DOPE Privacy & Security Architecture

1. **No Exposed API Keys**: `GEMINI_API_KEY` stays strictly on the Node.js server (`process.env.GEMINI_API_KEY`). It is never shipped to client JavaScript, Chrome extensions, Android APKs, or iOS binaries.
2. **Local Wake-Word Processing**: `platforms/desktop-companion/wake_word_engine.py` uses `openWakeWord` locally at 16kHz. Audio is NOT uploaded to the cloud before `"Hey Dop"` is detected.
3. **No Hidden Recording or Screen Capture**: Microphone listening always displays a visible indicator (UI waveform + Android foreground notification + browser mic tab icon).
4. **Separate Reasoning from Execution**: Gemini outputs only structured JSON validated against `ALLOWLISTED_ACTIONS` in `src/shared/actions.ts`. Arbitrary shell code execution is architecturally impossible.
5. **Untrusted Content Isolation**: Text inside web pages, PDFs, or emails is never treated as executable instructions.
6. **Confirmation Gate**: `send_email`, `delete_file`, `install_app`, `change_security_setting`, and `system_power` always require explicit user confirmation.
7. **Token Handling**: Google OAuth tokens for Gmail are kept strictly in React memory (`src/lib/firebaseAuth.ts`), never written to `localStorage` or `sessionStorage`, and cleared on sign-out.
8. **Data Retention & Deletion**: Users can toggle command history off or wipe stored history in one click under **Settings > Privacy & Data Retention**, and diagnostic logs automatically redact `Bearer` tokens and key strings.
