"""
macOS Native Automation Adapter using NSWorkspace and AppleScript System Events.
Requires explicit macOS Accessibility and Automation permissions.
"""

from __future__ import annotations
import subprocess
import time
import webbrowser
from typing import Any

APPROVED_MAC_APPS = {
    "chrome": "Google Chrome",
    "firefox": "Firefox",
    "safari": "Safari",
    "whatsapp": "WhatsApp",
    "vscode": "Visual Studio Code",
    "code": "Visual Studio Code",
    "spotify": "Spotify",
    "discord": "Discord",
    "terminal": "Terminal",
    "preview": "Preview",
    "finder": "Finder",
    "notes": "Notes",
}


class MacOSAdapter:
    def _osascript(self, script: str) -> tuple[bool, str]:
        proc = subprocess.run(["osascript", "-e", script], capture_output=True, text=True, check=False)
        if proc.returncode != 0:
            err = proc.stderr.strip() or "AppleScript execution failed."
            if "not allowed assistive access" in err.lower():
                return False, "Grant macOS Accessibility permission to El Dorado in System Settings > Privacy & Security."
            return False, err
        return True, proc.stdout.strip()

    def get_active_window_info(self) -> dict[str, str]:
        ok, out = self._osascript(
            'tell application "System Events" to get name of first application process whose frontmost is true'
        )
        return {"title": out if ok else "Unknown", "platform": "macos"}

    def execute(self, action_payload: dict[str, Any]) -> dict[str, Any]:
        action = action_payload.get("action")
        target = action_payload.get("target", "")
        params = action_payload.get("parameters") or {}

        if action in ("open_url", "web_search"):
            if not str(target).startswith(("https://", "http://")):
                return {"ok": False, "message": "Blocked unsafe URL scheme."}
            webbrowser.open(target)
            return {"ok": True, "message": f"Opened {target}"}

        if action == "web_workflow":
            if not str(target).startswith(("https://", "http://")):
                return {"ok": False, "message": "Blocked unsafe URL scheme."}
            webbrowser.open(target)
            prompt_text = str(params.get("prompt_text") or "").strip()
            if params.get("workflow_type") == "type_prompt" and prompt_text:
                time.sleep(2.4)
                try:
                    import pyautogui

                    pyautogui.write(prompt_text, interval=0.015)
                    pyautogui.press("enter")
                    return {"ok": True, "message": f"Opened {target} and submitted prompt."}
                except Exception as exc:
                    return {"ok": True, "message": f"Opened {target} ({exc})."}
            return {"ok": True, "message": f"Opened workflow target {target}."}

        if action == "open_app":
            app_name = APPROVED_MAC_APPS.get(str(target).strip().lower())
            if not app_name:
                return {"ok": False, "message": f'App "{target}" is not in the approved macOS list.'}
            subprocess.run(["open", "-a", app_name], check=False)
            return {"ok": True, "message": f"Opened {app_name}."}

        if action in ("undo", "redo"):
            key_cmd = 'keystroke "z" using command down' if action == "undo" else 'keystroke "z" using {command down, shift down}'
            ok, msg = self._osascript(f'tell application "System Events" to {key_cmd}')
            return {"ok": ok, "message": f"Executed macOS {action}." if ok else msg}

        if action == "scroll":
            direction = params.get("direction", "down")
            try:
                import pyautogui

                pyautogui.scroll(600 if direction in ("up", "top") else -600)
                return {"ok": True, "message": f"Scrolled {direction} on macOS."}
            except Exception as exc:
                return {"ok": False, "message": f"macOS scroll failed: {exc}"}

        if action == "minimize_window":
            ok, msg = self._osascript(
                'tell application "System Events" to tell (first application process whose frontmost is true) to set value of attribute "AXMinimized" of window 1 to true'
            )
            return {"ok": ok, "message": "Minimized active window." if ok else msg}

        if action == "adjust_volume":
            delta = int(params.get("delta", 10))
            ok, msg = self._osascript(
                f"set volume output volume ((output volume of (get volume settings)) + {delta})"
            )
            return {"ok": ok, "message": "Adjusted macOS output volume." if ok else msg}

        return {"ok": False, "message": f'Action "{action}" is not handled by MacOSAdapter.'}
