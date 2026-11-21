# DOPE Developer Guide

## Architecture Overview
- `src/shared/actions.ts` — Single source of truth for `ALLOWLISTED_ACTIONS`, `CONSEQUENTIAL_ACTIONS`, `PLATFORM_CAPABILITIES`, and `validateDopeAction()`.
- `src/shared/wakeword.ts` — Wake-word matcher (`detectWakeWord`), Hindi/Hinglish normalizer, and deterministic offline parser (`parseOfflineCommand`).
- `server/geminiService.ts` — `@google/genai` integration (`gemini-4-hydrogen` structured JSON + `gemini-3.8-live` WebSocket bridge).
- `server/routes.ts` — Express REST endpoints with sliding-window rate limiting and confined static file serving.
- `platforms/` — Platform-native adapters (`browser-extension`, `desktop-companion`, `android`, `ios`).

## Adding a New Allowlisted Action
1. Add the action name to `ActionName` and `ALLOWLISTED_ACTIONS` in `src/shared/actions.ts`.
2. Map supported platforms in `PLATFORM_CAPABILITIES`.
3. Add a catalog entry in `ACTION_CATALOG` and (optionally) offline regex support in `src/shared/wakeword.ts`.
4. Implement execution in the relevant platform adapter (`platforms/desktop-companion/adapters/*.py` or `platforms/browser-extension/background.js`).
5. Add unit tests in `src/shared/dope.test.ts` and run `npx --yes tsx --test src/shared/dope.test.ts`.
