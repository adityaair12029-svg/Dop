"""
Windows 10/11 Native Automation Adapter using Win32 + Windows UI Automation (pywinauto) + pycaw.
Only allowlisted, structured actions are permitted; arbitrary shell commands are rejected.
"""

from __future__ import annotations
import ctypes
import os
import subprocess
import webbrowser
from typing import Any

APPROVED_APPS = {
    "chrome": [
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    ],
    "edge": [
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    ],
    "notepad": ["notepad.exe"],
    "calculator": ["calc.exe"],
    "explorer": ["explorer.exe"],
}


class WindowsAdapter:
    def get_active_window_info(self) -> dict[str, str]:
        user32 = ctypes.windll.user32
        hwnd = user32.GetForegroundWindow()
        length = user32.GetWindowTextLengthW(hwnd)
        buf = ctypes.create_unicode_buffer(length + 1)
        user32.GetWindowTextW(hwnd, buf, length + 1)
        return {"title": buf.value or "Unknown Window", "platform": "windows"}

    def execute(self, action_payload: dict[str, Any]) -> dict[str, Any]:
        action = action_payload.get("action")
        target = action_payload.get("target", "")
        params = action_payload.get("parameters") or {}

        if action in ("open_url", "web_search"):
            if not str(target).startswith(("https://", "http://")):
                return {"ok": False, "message": "Blocked unsafe URL scheme."}
            webbrowser.open(target)
            return {"ok": True, "message": f"Opened {target}"}

        if action == "open_app":
            key = str(target).strip().lower()
            candidates = APPROVED_APPS.get(key)
            if not candidates:
                return {
                    "ok": False,
                    "message": f'Application "{target}" is not in the approved Windows app registry.',
                }
            for exe in candidates:
                if exe.endswith(".exe") and (not os.path.isabs(exe) or os.path.exists(exe)):
                    subprocess.Popen([exe], shell=False)
                    return {"ok": True, "message": f"Launched {target}."}
            return {"ok": False, "message": f"{target} does not appear to be installed."}

        if action in ("minimize_window", "maximize_window", "restore_window", "close_window"):
            user32 = ctypes.windll.user32
            hwnd = user32.GetForegroundWindow()
            if not hwnd:
                return {"ok": False, "message": "No active foreground window."}
            if action == "minimize_window":
                user32.ShowWindow(hwnd, 6)  # SW_MINIMIZE
            elif action == "maximize_window":
                user32.ShowWindow(hwnd, 3)  # SW_MAXIMIZE
            elif action == "restore_window":
                user32.ShowWindow(hwnd, 9)  # SW_RESTORE
            elif action == "close_window":
                user32.PostMessageW(hwnd, 0x0010, 0, 0)  # WM_CLOSE
            return {"ok": True, "message": f"Executed {action} on active window."}

        if action == "switch_window":
            import keyboard
            keyboard.press_and_release("alt+tab")
            return {"ok": True, "message": "Switched to previous window."}

        if action == "adjust_volume":
            try:
                from comtypes import CLSCTX_ALL
                from ctypes import cast, POINTER
                from pycaw.pycaw import AudioUtilities, IAudioEndpointVolume

                devices = AudioUtilities.GetSpeakers()
                interface = devices.Activate(IAudioEndpointVolume._iid_, CLSCTX_ALL, None)
                volume = cast(interface, POINTER(IAudioEndpointVolume))
                current = volume.GetMasterVolumeLevelScalar()
                delta = float(params.get("delta", 10)) / 100.0
                next_level = max(0.0, min(1.0, current + delta))
                volume.SetMasterVolumeLevelScalar(next_level, None)
                return {"ok": True, "message": f"Volume set to {int(next_level * 100)}%."}
            except Exception as exc:
                return {"ok": False, "message": f"Windows volume adjustment failed: {exc}"}

        return {"ok": False, "message": f'Action "{action}" is not handled by WindowsAdapter.'}
