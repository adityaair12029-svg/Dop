"""
macOS Native Automation Adapter using NSWorkspace and AppleScript System Events.
Requires explicit macOS Accessibility and Automation permissions.
"""

from __future__ import annotations
import subprocess
import webbrowser
from typing import Any

APPROVED_MAC_APPS = {
    "chrome": "Google Chrome",
    "safari": "Safari",
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
                return False, "Grant macOS Accessibility permission to DOPE in System Settings > Privacy & Security."
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

        if action in ("open_url", "web_search"):
            if not str(target).startswith(("https://", "http://")):
                return {"ok": False, "message": "Blocked unsafe URL scheme."}
            webbrowser.open(target)
            return {"ok": True, "message": f"Opened {target}"}

        if action == "open_app":
            app_name = APPROVED_MAC_APPS.get(str(target).strip().lower())
            if not app_name:
                return {"ok": False, "message": f'App "{target}" is not in the approved macOS list.'}
            subprocess.run(["open", "-a", app_name], check=False)
            return {"ok": True, "message": f"Opened {app_name}."}

        if action == "minimize_window":
            ok, msg = self._osascript(
                'tell application "System Events" to tell (first application process whose frontmost is true) to set value of attribute "AXMinimized" of window 1 to true'
            )
            return {"ok": ok, "message": "Minimized active window." if ok else msg}

        if action == "adjust_volume":
            delta = int((action_payload.get("parameters") or {}).get("delta", 10))
            ok, msg = self._osascript(
                f"set volume output volume ((output volume of (get volume settings)) + {delta})"
            )
            return {"ok": ok, "message": "Adjusted macOS output volume." if ok else msg}

        return {"ok": False, "message": f'Action "{action}" is not handled by MacOSAdapter.'}
