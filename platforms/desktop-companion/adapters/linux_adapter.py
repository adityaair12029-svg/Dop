"""
Linux Native Automation Adapter with X11 vs Wayland display-server awareness.
Explicitly reports Wayland compositor limitations rather than pretending actions succeeded.
"""

from __future__ import annotations
import os
import shutil
import subprocess
import webbrowser
from typing import Any

APPROVED_LINUX_APPS = {
    "chrome": "google-chrome",
    "firefox": "firefox",
    "evince": "evince",
    "okular": "okular",
    "files": "xdg-open",
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
        display = self.detect_display_server()

        if action in ("open_url", "web_search"):
            if not str(target).startswith(("https://", "http://")):
                return {"ok": False, "message": "Blocked unsafe URL scheme."}
            webbrowser.open(target)
            return {"ok": True, "message": f"Opened {target}"}

        if action == "open_app":
            binary = APPROVED_LINUX_APPS.get(str(target).strip().lower())
            if not binary or not shutil.which(binary):
                return {"ok": False, "message": f'App "{target}" is not approved or not installed.'}
            subprocess.Popen([binary], shell=False)
            return {"ok": True, "message": f"Launched {binary}."}

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
            delta = int((action_payload.get("parameters") or {}).get("delta", 10))
            sign = "+" if delta >= 0 else ""
            subprocess.run(["pactl", "set-sink-volume", "@DEFAULT_SINK@", f"{sign}{delta}%"], check=False)
            return {"ok": True, "message": f"Adjusted PulseAudio/PipeWire volume by {sign}{delta}%."}

        return {"ok": False, "message": f'Action "{action}" unavailable on Linux ({display}).'}
