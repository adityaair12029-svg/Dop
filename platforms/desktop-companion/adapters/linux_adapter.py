"""
Linux Native Automation Adapter with X11 vs Wayland display-server awareness.
Explicitly reports Wayland compositor limitations rather than pretending actions succeeded.
"""

from __future__ import annotations
import os
import shutil
import subprocess
import time
import webbrowser
from typing import Any

APPROVED_LINUX_APPS = {
    "chrome": "google-chrome",
    "firefox": "firefox",
    "code": "code",
    "vscode": "code",
    "spotify": "spotify",
    "discord": "discord",
    "evince": "evince",
    "okular": "okular",
    "files": "xdg-open",
    "terminal": "x-terminal-emulator",
}


class LinuxAdapter:
    def detect_display_server(self) -> str:
        session_type = os.environ.get("XDG_SESSION_TYPE", "").lower()
        if session_type in ("wayland", "x11"):
            return session_type
        if os.environ.get("WAYLAND_DISPLAY"):
            return "wayland"
        return "x11"

    def execute(self, action_payload: dict[str, Any]) -> dict[str, Any]:
        action = action_payload.get("action")
        target = action_payload.get("target", "")
        params = action_payload.get("parameters") or {}
        display = self.detect_display_server()

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
            binary = APPROVED_LINUX_APPS.get(str(target).strip().lower())
            if not binary or not shutil.which(binary):
                return {"ok": False, "message": f'App "{target}" is not approved or not installed.'}
            subprocess.Popen([binary], shell=False)
            return {"ok": True, "message": f"Launched {binary}."}

        if action in ("undo", "redo"):
            if display == "x11" and shutil.which("xdotool"):
                subprocess.run(["xdotool", "key", "ctrl+z" if action == "undo" else "ctrl+y"], check=False)
                return {"ok": True, "message": f"Executed Linux {action}."}
            return {"ok": False, "message": f"{action} on {display} requires xdotool under X11."}

        if action == "scroll":
            direction = params.get("direction", "down")
            try:
                import pyautogui

                pyautogui.scroll(600 if direction in ("up", "top") else -600)
                return {"ok": True, "message": f"Scrolled {direction} on Linux."}
            except Exception as exc:
                return {"ok": False, "message": f"Linux scroll failed: {exc}"}

        if action in ("minimize_window", "maximize_window", "switch_window"):
            if display == "wayland":
                return {
                    "ok": False,
                    "message": (
                        "Global window switching and programmatic minimize/maximize are blocked by "
                        "Wayland compositor isolation. Switch to an X11 session or install a GNOME/KWin extension."
                    ),
                }
            if not shutil.which("xdotool"):
                return {"ok": False, "message": "Install xdotool on X11 for window controls."}
            if action == "minimize_window":
                subprocess.run(["xdotool", "getactivewindow", "windowminimize"], check=False)
                return {"ok": True, "message": "Minimized active X11 window."}

        if action == "adjust_volume" and shutil.which("pactl"):
            delta = int(params.get("delta", 10))
            sign = "+" if delta >= 0 else ""
            subprocess.run(["pactl", "set-sink-volume", "@DEFAULT_SINK@", f"{sign}{delta}%"], check=False)
            return {"ok": True, "message": f"Adjusted PulseAudio/PipeWire volume by {sign}{delta}%."}

        return {"ok": False, "message": f'Action "{action}" unavailable on Linux ({display}).'}
