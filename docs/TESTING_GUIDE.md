# DOPE Testing Guide & Acceptance Matrix

## Automated Unit Tests
Run the core logic, wake-word, safety, and platform-limitation test suite:
```bash
npx --yes tsx --test src/shared/dope.test.ts
```

## Acceptance Test Scenarios (TEST 1 – TEST 12)
1. **TEST 1 (`"Hey Dop, open YouTube."`)** -> Parses `open_url` `https://www.youtube.com`, opens safely.
2. **TEST 2 (`"Hey Dop, scroll down."`)** -> Scrolls active PDF Testbench or browser page down.
3. **TEST 3 (`"Hey Dop, zoom in."`)** -> Increases zoom level on PDF Testbench or browser tab.
4. **TEST 4 (`"Hey Dop, go to page 15."`)** -> Jumps PDF Testbench to page 15 (or honestly rejects if viewer lacks page-jump support).
5. **TEST 5 (`"Hey Dop, minimize this window."`)** -> Minimizes window when Desktop Companion is connected; otherwise explains limitation honestly.
6. **TEST 6 (`"Hey Dop, open Chrome."`)** -> Launches Chrome via Desktop Companion; reports missing companion if web-only.
7. **TEST 7 (`"Hey Dop, stop listening."`)** -> Immediately stops active microphone & wake-word capture.
8. **TEST 8 (Microphone permission denied)** -> Shows clear instructions to re-enable permission; never fakes listening.
9. **TEST 9 (Ambiguous command e.g. `"Hey Dop, open"`)** -> Prompts user with clarification question.
10. **TEST 10 (Consequential command e.g. `send_email`, `system_power`)** -> Opens explicit confirmation modal before execution.
11. **TEST 11 (Gemini unavailable)** -> Displays honest notice and runs core commands via deterministic offline parser.
12. **TEST 12 (Unsupported platform operation e.g. iOS minimize or Linux Wayland)** -> Explains OS limitation accurately.
