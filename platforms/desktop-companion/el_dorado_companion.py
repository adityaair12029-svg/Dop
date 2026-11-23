"""
El Dorado Whole-Laptop Desktop Assistant (Windows / macOS / Linux).
Self-installs required Python packages on first launch, then runs globally across
your Desktop Home Screen, File Explorer, Firefox, Chrome, VS Code, WhatsApp, and all apps:
- Press Alt + D + T (or Ctrl + Alt + D) anywhere
- Runs instant offline command parsing (<2ms) with a 2.5s timeout for cloud AI Q&A
- Plays harmonic bell chimes (activate, executing, success, error)
- Displays a sleek dark bottom-right HUD toast with the El Dorado emblem when Tk is available
- Executes allowlisted OS actions (undo/redo, scroll, open apps, URLs, workflows, windows, volume, PDF)
"""

from __future__ import annotations

import sys

sys.dont_write_bytecode = True

import importlib
import math
import os
import re
import shutil
import struct
import subprocess
import tempfile
import threading
import time
import urllib.parse
import wave
import webbrowser
from pathlib import Path
from typing import Any

_SCRIPT_DIR = str(Path(__file__).resolve().parent)
if _SCRIPT_DIR not in sys.path:
    sys.path.insert(0, _SCRIPT_DIR)

DEFAULT_SERVER_URL = "__DOPE_SERVER_URL__"


def bootstrap_dependencies() -> None:
    """Auto-install required Python packages on first run so no .bat script is needed."""
    required: list[tuple[str, str]] = [
        ("requests", "requests>=2.32.0"),
        ("keyboard", "keyboard>=0.13.5"),
        ("pynput", "pynput>=1.7.7"),
        ("pyautogui", "pyautogui>=0.9.54"),
        ("speech_recognition", "SpeechRecognition>=3.10.0"),
        ("pyttsx3", "pyttsx3>=2.90"),
    ]
    if sys.platform == "win32":
        required.extend(
            [
                ("pywinauto", "pywinauto>=0.6.8"),
                ("pycaw", "pycaw>=20240210"),
                ("comtypes", "comtypes>=1.4.0"),
            ]
        )
    elif sys.platform == "darwin":
        required.append(("AppKit", "pyobjc-framework-Cocoa>=10.3"))

    missing: list[str] = []
    for mod_name, pkg_spec in required:
        try:
            importlib.import_module(mod_name)
        except ImportError:
            missing.append(pkg_spec)

    if missing:
        print("[El Dorado] First-time setup: installing required desktop packages...")
        try:
            subprocess.check_call([sys.executable, "-m", "pip", "install", "--quiet", *missing])
            print("[El Dorado] Core packages installed.")
        except Exception as exc:
            print(f"[El Dorado Warning] Auto-install had an issue ({exc}). Continuing with available modules...")

    if sys.platform == "win32":
        try:
            importlib.import_module("pyaudio")
        except ImportError:
            try:
                subprocess.call(
                    [sys.executable, "-m", "pip", "install", "--quiet", "PyAudio>=0.2.14"],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                )
            except Exception:
                pass


bootstrap_dependencies()

import requests  # noqa: E402

from adapters.windows_adapter import WindowsAdapter  # noqa: E402
from adapters.macos_adapter import MacOSAdapter  # noqa: E402
from adapters.linux_adapter import LinuxAdapter  # noqa: E402
from adapters.pdf_adapter import PdfViewerAdapter  # noqa: E402

_SESSION_LOCK = threading.Lock()
_CHIME_DIR = Path(tempfile.gettempdir()) / "el_dorado_chimes"

KNOWN_SITES: dict[str, str] = {
    "youtube": "https://www.youtube.com",
    "yt": "https://www.youtube.com",
    "google": "https://www.google.com",
    "gmail": "https://mail.google.com",
    "github": "https://github.com",
    "wikipedia": "https://www.wikipedia.org",
    "chatgpt": "https://chatgpt.com",
    "gpt": "https://chatgpt.com",
    "openai": "https://chatgpt.com",
    "gemini": "https://gemini.google.com",
    "claude": "https://claude.ai",
    "perplexity": "https://www.perplexity.ai",
    "whatsapp": "https://web.whatsapp.com",
    "flipkart": "https://www.flipkart.com",
    "amazon": "https://www.amazon.in",
    "firebase": "https://console.firebase.google.com",
    "vercel": "https://vercel.com/dashboard",
}

DESKTOP_APPS = {
    "chrome",
    "firefox",
    "edge",
    "brave",
    "whatsapp",
    "vscode",
    "code",
    "spotify",
    "discord",
    "telegram",
    "notepad",
    "calculator",
    "explorer",
    "terminal",
    "safari",
    "finder",
    "notes",
    "preview",
}


def resolve_server_url() -> str:
    env_url = os.environ.get("EL_DORADO_SERVER_URL", "").strip() or os.environ.get("DOPE_SERVER_URL", "").strip()
    if env_url.startswith(("http://", "https://")):
        return env_url.rstrip("/")
    if DEFAULT_SERVER_URL.startswith(("http://", "https://")):
        return DEFAULT_SERVER_URL.rstrip("/")
    return "http://localhost:3000"


def get_platform_adapter():
    if sys.platform == "win32":
        return WindowsAdapter()
    if sys.platform == "darwin":
        return MacOSAdapter()
    return LinuxAdapter()


def show_desktop_hud_toast(title: str, subtitle: str, hold_ms: int = 2400) -> None:
    """Display a brief non-blocking bottom-right HUD popup using Tkinter when available."""

    def _run() -> None:
        try:
            import tkinter as tk

            root = tk.Tk()
            root.overrideredirect(True)
            root.attributes("-topmost", True)
            root.configure(bg="#070708")

            w, h = 340, 82
            sw = root.winfo_screenwidth()
            sh = root.winfo_screenheight()
            root.geometry(f"{w}x{h}+{max(0, sw - w - 24)}+{max(0, sh - h - 56)}")

            frame = tk.Frame(root, bg="#070708", highlightbackground="#2F71E3", highlightthickness=1, padx=12, pady=10)
            frame.pack(fill="both", expand=True)

            logo_path = Path(_SCRIPT_DIR) / "icons" / "logo-white.png"
            if logo_path.exists():
                try:
                    img = tk.PhotoImage(file=str(logo_path)).subsample(4, 4)
                    icon_lbl = tk.Label(frame, image=img, bg="#0B0C0F")
                    icon_lbl.image = img
                    icon_lbl.pack(side="left", padx=(0, 10))
                except Exception:
                    pass

            txt_box = tk.Frame(frame, bg="#070708")
            txt_box.pack(side="left", fill="both", expand=True)
            tk.Label(txt_box, text=title[:48], fg="#FFFFFF", bg="#070708", font=("Segoe UI", 10, "bold"), anchor="w").pack(fill="x")
            tk.Label(txt_box, text=subtitle[:68], fg="#9CA3AF", bg="#070708", font=("Segoe UI", 9), anchor="w").pack(fill="x", pady=(2, 0))

            root.after(hold_ms, root.destroy)
            root.mainloop()
        except Exception:
            pass

    threading.Thread(target=_run, daemon=True).start()


def _write_harmonic_chime_wav(filepath: Path, notes: list[tuple[float, float, float, float]]) -> None:
    """Generate a warm dual-oscillator harmonic bell chime WAV using pure Python stdlib."""
    sample_rate = 22050
    total_sec = max(start + dur for _, start, dur, _ in notes) + 0.05
    num_samples = int(sample_rate * total_sec)
    mix = [0.0] * num_samples

    for freq, start_sec, dur_sec, amp in notes:
        start_idx = int(start_sec * sample_rate)
        n_len = int(dur_sec * sample_rate)
        attack_n = max(1, int(0.016 * sample_rate))
        for i in range(n_len):
            idx = start_idx + i
            if idx >= num_samples:
                break
            t = i / sample_rate
            if i < attack_n:
                env = i / attack_n
            else:
                env = math.exp(-4.2 * (t / max(0.05, dur_sec)))
            fundamental = math.sin(2.0 * math.pi * freq * t)
            shimmer = 0.28 * math.sin(2.0 * math.pi * (freq * 2.0) * t)
            mix[idx] += amp * env * (fundamental + shimmer)

    with wave.open(str(filepath), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        frames = bytearray()
        for sample in mix:
            clamped = max(-0.95, min(0.95, sample))
            frames.extend(struct.pack("<h", int(clamped * 32767)))
        wf.writeframes(bytes(frames))


def ensure_chime_files() -> dict[str, Path]:
    _CHIME_DIR.mkdir(parents=True, exist_ok=True)
    specs: dict[str, list[tuple[float, float, float, float]]] = {
        "activate": [
            (523.25, 0.00, 0.18, 0.34),
            (659.25, 0.05, 0.20, 0.32),
            (783.99, 0.10, 0.22, 0.32),
            (1174.66, 0.15, 0.30, 0.28),
        ],
        "executing": [
            (659.25, 0.00, 0.10, 0.26),
            (880.00, 0.06, 0.14, 0.26),
        ],
        "success": [
            (783.99, 0.00, 0.14, 0.28),
            (987.77, 0.06, 0.16, 0.28),
            (1174.66, 0.12, 0.24, 0.30),
        ],
        "error": [
            (293.66, 0.00, 0.14, 0.28),
            (261.63, 0.10, 0.22, 0.26),
        ],
    }
    paths: dict[str, Path] = {}
    for name, notes in specs.items():
        target = _CHIME_DIR / f"eldorado_{name}.wav"
        try:
            _write_harmonic_chime_wav(target, notes)
            paths[name] = target
        except Exception:
            pass
    return paths


_CHIMES: dict[str, Path] = {}


def play_chime(kind: str) -> None:
    wav_path = _CHIMES.get(kind)
    if not wav_path or not wav_path.exists():
        return
    try:
        if sys.platform == "win32":
            import winsound

            winsound.PlaySound(
                str(wav_path),
                winsound.SND_FILENAME | winsound.SND_ASYNC | winsound.SND_NODEFAULT,
            )
            return
        if sys.platform == "darwin":
            subprocess.Popen(["afplay", str(wav_path)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            return
        player = shutil.which("paplay") or shutil.which("aplay")
        if player:
            subprocess.Popen([player, str(wav_path)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except Exception:
        pass


def speak_text(text: str) -> None:
    clean = (text or "").strip()
    if not clean:
        return
    try:
        import pyttsx3

        engine = pyttsx3.init()
        engine.setProperty("rate", 176)
        engine.say(clean)
        engine.runAndWait()
        return
    except Exception:
        pass

    try:
        if sys.platform == "win32":
            safe_ps = clean.replace("'", "''").replace("\n", " ")[:600]
            cmd = (
                "Add-Type -AssemblyName System.Speech; "
                "$s = New-Object System.Speech.Synthesis.SpeechSynthesizer; "
                f"$s.Speak('{safe_ps}')"
            )
            subprocess.Popen(
                ["powershell", "-NoProfile", "-WindowStyle", "Hidden", "-Command", cmd],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
        elif sys.platform == "darwin":
            subprocess.Popen(["say", clean[:600]], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        else:
            tts = shutil.which("espeak-ng") or shutil.which("espeak") or shutil.which("spd-say")
            if tts:
                subprocess.Popen([tts, clean[:600]], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except Exception:
        pass


def listen_microphone_once() -> str | None:
    try:
        import speech_recognition as sr
    except ImportError:
        print("[El Dorado] SpeechRecognition not installed; type your question/command in this window.")
        return None

    recognizer = sr.Recognizer()
    try:
        with sr.Microphone() as source:
            print("[El Dorado] Listening on laptop microphone...")
            recognizer.adjust_for_ambient_noise(source, duration=0.25)
            audio = recognizer.listen(source, timeout=5, phrase_time_limit=10)
        text = recognizer.recognize_google(audio, language="en-US")
        return text.strip()
    except sr.WaitTimeoutError:
        print("[El Dorado] No speech detected before timeout.")
        return None
    except sr.UnknownValueError:
        print("[El Dorado] Could not understand speech clearly. Try again.")
        return None
    except Exception as exc:
        print(f"[El Dorado] Microphone unavailable ({exc}). Type your command or question directly here.")
        return None


def local_offline_interpret(utterance: str) -> dict[str, Any]:
    """Instant <2ms desktop parser for OS commands, apps, scroll, undo/redo, and web workflows."""
    clean = re.sub(
        r"^\s*(?:hey|hi|ok|okay|hello)\s+(?:el\s*dorado|eldorado|el-dorado|dop|dope)\b[\s,.:!?-]*",
        "",
        utterance.strip(),
        flags=re.I,
    )
    lower = clean.lower().strip()
    plat = "windows" if sys.platform == "win32" else ("macos" if sys.platform == "darwin" else "linux")

    if re.match(r"^(?:undo(?:\s+(?:this|that|it|last))?|step\s+back)[.!?]*$", lower):
        return {
            "direct": True,
            "supported": True,
            "action": {"action": "undo", "platform": plat, "requires_confirmation": False},
            "spoken_response": "Undoing last action.",
        }
    if re.match(r"^redo(?:\s+(?:this|that|it))?[.!?]*$", lower):
        return {
            "direct": True,
            "supported": True,
            "action": {"action": "redo", "platform": plat, "requires_confirmation": False},
            "spoken_response": "Redoing action.",
        }

    if "minimize" in lower:
        return {"direct": True, "supported": True, "action": {"action": "minimize_window", "platform": plat, "requires_confirmation": False}, "spoken_response": "Minimizing window."}
    if "maximize" in lower:
        return {"direct": True, "supported": True, "action": {"action": "maximize_window", "platform": plat, "requires_confirmation": False}, "spoken_response": "Maximizing window."}
    if "restore" in lower:
        return {"direct": True, "supported": True, "action": {"action": "restore_window", "platform": plat, "requires_confirmation": False}, "spoken_response": "Restoring window."}
    if "switch" in lower and "window" in lower:
        return {"direct": True, "supported": True, "action": {"action": "switch_window", "platform": plat, "requires_confirmation": False}, "spoken_response": "Switching windows."}

    if re.search(r"\bscroll\s+(?:to\s+)?bottom\b", lower):
        return {"direct": True, "supported": True, "action": {"action": "scroll", "platform": plat, "requires_confirmation": False, "parameters": {"direction": "bottom"}}, "spoken_response": "Scrolling to bottom."}
    if re.search(r"\bscroll\s+(?:to\s+)?top\b", lower):
        return {"direct": True, "supported": True, "action": {"action": "scroll", "platform": plat, "requires_confirmation": False, "parameters": {"direction": "top"}}, "spoken_response": "Scrolling to top."}
    if re.search(r"\bscroll\s+up\b", lower):
        return {"direct": True, "supported": True, "action": {"action": "scroll", "platform": plat, "requires_confirmation": False, "parameters": {"direction": "up"}}, "spoken_response": "Scrolling up."}
    if re.match(r"^(?:scroll(?:\s+(?:down|page|this|please))?|please\s+scroll|scroll\s+the\s+page)$", lower) or re.search(r"\bscroll\s+down\b", lower):
        return {"direct": True, "supported": True, "action": {"action": "scroll", "platform": plat, "requires_confirmation": False, "parameters": {"direction": "down"}}, "spoken_response": "Scrolling down."}

    if "increase volume" in lower or "volume up" in lower:
        return {"direct": True, "supported": True, "action": {"action": "adjust_volume", "platform": plat, "requires_confirmation": False, "parameters": {"delta": 10}}, "spoken_response": "Increasing volume."}
    if "decrease volume" in lower or "volume down" in lower:
        return {"direct": True, "supported": True, "action": {"action": "adjust_volume", "platform": plat, "requires_confirmation": False, "parameters": {"delta": -10}}, "spoken_response": "Decreasing volume."}

    m_ai = re.match(
        r"^(?:open\s+)?(chat\s*gpt|gpt|openai|gemini|claude|perplexity)\s*(?:and\s+)?(?:type|write|ask|enter|submit|send)?(?:\s+a)?(?:\s+prompt)?[\s:,-]+[\"']?(.+?)[\"']?[.!?]*$",
        clean,
        flags=re.I,
    )
    if m_ai and m_ai.group(2).strip():
        site_key = re.sub(r"\s+", "", m_ai.group(1).lower())
        prompt_text = m_ai.group(2).strip()
        target_url = KNOWN_SITES.get(site_key, "https://chatgpt.com")
        return {
            "direct": True,
            "supported": True,
            "action": {
                "action": "web_workflow",
                "target": target_url,
                "platform": plat,
                "requires_confirmation": False,
                "parameters": {"workflow_type": "type_prompt", "prompt_text": prompt_text},
            },
            "spoken_response": f'Opening {m_ai.group(1).strip()} and typing "{prompt_text}".',
        }

    m_compound = re.match(
        r"^open\s+([a-z0-9 .-]+?)\s+(?:and\s+(?:go\s+to|open|click|search(?:\s+for)?|find)|go\s+to|search(?:\s+for)?)\s+(.+?)[.!?]*$",
        clean,
        flags=re.I,
    )
    if m_compound:
        site = m_compound.group(1).strip()
        sub = m_compound.group(2).strip()
        site_key = re.sub(r"\s+", "", site.lower())
        target_url = KNOWN_SITES.get(site_key, f"https://{site_key}.com")
        if site_key == "flipkart" and "order" in sub.lower():
            target_url = "https://www.flipkart.com/account/orders"
        elif site_key == "flipkart" and "cart" in sub.lower():
            target_url = "https://www.flipkart.com/viewcart"
        elif site_key == "amazon" and "order" in sub.lower():
            target_url = "https://www.amazon.in/gp/your-account/order-history"
        elif site_key == "amazon" and "cart" in sub.lower():
            target_url = "https://www.amazon.in/gp/cart/view.html"
        return {
            "direct": True,
            "supported": True,
            "action": {
                "action": "web_workflow",
                "target": target_url,
                "platform": plat,
                "requires_confirmation": False,
                "parameters": {"workflow_type": "click_target", "click_label": sub},
            },
            "spoken_response": f"Opening {site} and navigating to {sub}.",
        }

    m_open = re.match(r"^open\s+(.+)$", clean, flags=re.I)
    if m_open:
        target = m_open.group(1).strip().rstrip(".!?")
        key = re.sub(r"\s+", "", target.lower())
        if key in DESKTOP_APPS:
            return {
                "direct": True,
                "supported": True,
                "action": {"action": "open_app", "target": key, "platform": plat, "requires_confirmation": False},
                "spoken_response": f"Launching {target}.",
            }
        if key in KNOWN_SITES:
            return {
                "direct": True,
                "supported": True,
                "action": {"action": "open_url", "target": KNOWN_SITES[key], "platform": plat, "requires_confirmation": False},
                "spoken_response": f"Opening {target}.",
            }
        if re.match(r"^https?://", target, flags=re.I) or "." in target:
            url = target if re.match(r"^https?://", target, flags=re.I) else f"https://{target}"
            return {
                "direct": True,
                "supported": True,
                "action": {"action": "open_url", "target": url, "platform": plat, "requires_confirmation": False},
                "spoken_response": f"Opening {url}.",
            }
        return {
            "direct": True,
            "supported": True,
            "action": {"action": "open_app", "target": target, "platform": plat, "requires_confirmation": False},
            "spoken_response": f"Launching {target}.",
        }

    return {
        "direct": False,
        "supported": True,
        "action": {
            "action": "web_search",
            "target": f"https://www.google.com/search?q={urllib.parse.quote(clean)}",
            "platform": plat,
            "requires_confirmation": False,
        },
        "spoken_response": f"Searching Google for {clean}.",
    }


def resolve_command_fast(server_url: str, utterance: str, active_title: str) -> dict[str, Any]:
    """Run <2ms local parser first; only call cloud backend (2.5s timeout) for open AI questions."""
    local_res = local_offline_interpret(utterance)
    if local_res.get("direct"):
        return local_res

    try:
        resp = requests.post(
            f"{server_url.rstrip('/')}/api/dope/command",
            json={
                "text": utterance,
                "language": "en",
                "context": {
                    "platform": "windows" if sys.platform == "win32" else ("macos" if sys.platform == "darwin" else "linux"),
                    "companion_connected": True,
                    "active_window_title": active_title,
                },
            },
            timeout=2.5,
        )
        ctype = resp.headers.get("content-type", "")
        if resp.ok and "application/json" in ctype.lower():
            return resp.json()
    except Exception:
        pass
    return local_res


def handle_utterance(
    server_url: str,
    adapter: Any,
    pdf_adapter: PdfViewerAdapter,
    utterance: str,
    interactive_confirm: bool = True,
) -> None:
    clean = utterance.strip()
    if not clean:
        return

    play_chime("executing")
    print(f"\n[You]: {clean}")

    title = ""
    try:
        if hasattr(adapter, "get_active_window_info"):
            title = adapter.get_active_window_info().get("title", "")
    except Exception:
        title = ""

    interpreted = resolve_command_fast(server_url, clean, title)

    action = interpreted.get("action", {}) or {}
    action_name = action.get("action")
    spoken = str(interpreted.get("spoken_response") or "Done.")

    if not interpreted.get("supported", True):
        play_chime("error")
        reason = interpreted.get("unsupported_reason") or spoken
        print(f"[El Dorado Notice]: {reason}")
        show_desktop_hud_toast("El Dorado Notice", reason)
        speak_text(reason)
        return

    if action.get("requires_confirmation"):
        print(f"[El Dorado Confirm]: {spoken}")
        speak_text(f"Please confirm: {spoken}")
        if interactive_confirm:
            confirm = input(f"Confirm action ({action_name})? [y/N]: ").strip().lower()
            if confirm != "y":
                print("[El Dorado]: Action cancelled.")
                return
        else:
            print("[El Dorado]: Skipping confirmation-required action from background hotkey. Run in terminal to confirm.")
            return

    if action_name in ("answer_question", "clarify", "stop_listening", "list_devices"):
        play_chime("success")
        print(f"[El Dorado AI]: {spoken}")
        show_desktop_hud_toast("El Dorado AI Answer", spoken, 4500)
        speak_text(spoken)
        return

    if action_name in ("open_url", "web_search"):
        target = str(action.get("target") or "")
        if target.startswith(("https://", "http://")):
            webbrowser.open(target)
            play_chime("success")
            print(f"[El Dorado]: {spoken} ({target})")
            show_desktop_hud_toast("El Dorado", spoken)
            speak_text(spoken)
            return

    if action_name in ("pdf_navigate_page", "pdf_fit"):
        res = pdf_adapter.execute_pdf_command(title, action)
    else:
        res = adapter.execute(action)

    if res.get("ok"):
        play_chime("success")
        print(f"[El Dorado]: {spoken} | {res.get('message', '')}")
        show_desktop_hud_toast("El Dorado Done", spoken)
        speak_text(spoken)
    else:
        play_chime("error")
        err_msg = res.get("message") or spoken
        print(f"[El Dorado]: {err_msg}")
        show_desktop_hud_toast("El Dorado Notice", err_msg)
        speak_text(err_msg)


def register_global_hotkey(callback) -> str | None:
    """Register Alt+D+T and Ctrl+Alt+D globally across Desktop Home, Firefox, Chrome & all apps."""
    try:
        import keyboard

        keyboard.add_hotkey("alt+d+t", callback)
        keyboard.add_hotkey("ctrl+alt+d", callback)
        return "keyboard (Alt + D + T & Ctrl + Alt + D)"
    except Exception:
        pass

    try:
        from pynput import keyboard as pynput_kb

        pressed: set[str] = set()
        last_fire = [0.0]

        def norm(key) -> str:
            if key in (pynput_kb.Key.alt, pynput_kb.Key.alt_l, pynput_kb.Key.alt_r, pynput_kb.Key.alt_gr):
                return "alt"
            if key in (pynput_kb.Key.ctrl, pynput_kb.Key.ctrl_l, pynput_kb.Key.ctrl_r):
                return "ctrl"
            char = getattr(key, "char", None)
            return char.lower() if isinstance(char, str) else ""

        def on_press(key):
            k = norm(key)
            if k:
                pressed.add(k)
            is_alt_dt = "alt" in pressed and "d" in pressed and "t" in pressed
            is_ctrl_alt_d = "ctrl" in pressed and "alt" in pressed and "d" in pressed
            if is_alt_dt or is_ctrl_alt_d:
                now = time.time()
                if now - last_fire[0] > 0.5:
                    last_fire[0] = now
                    threading.Thread(target=callback, daemon=True).start()

        def on_release(key):
            k = norm(key)
            pressed.discard(k)

        listener = pynput_kb.Listener(on_press=on_press, on_release=on_release)
        listener.daemon = True
        listener.start()
        return "pynput (Alt + D + T & Ctrl + Alt + D)"
    except Exception:
        return None


def main() -> None:
    global _CHIMES
    _CHIMES = ensure_chime_files()

    server_url = resolve_server_url()
    adapter = get_platform_adapter()
    pdf_adapter = PdfViewerAdapter()

    print("=" * 64)
    print(f"El Dorado Whole-Laptop Assistant Active ({sys.platform})")
    print(f"Backend AI Server : {server_url}")
    print("Global Hotkeys    : Alt + D + T  or  Ctrl + Alt + D (works everywhere)")
    print('Wake Phrase       : "Hey El Dorado"')
    print("=" * 64)
    play_chime("activate")

    def on_global_hotkey():
        if not _SESSION_LOCK.acquire(blocking=False):
            return
        try:
            play_chime("activate")
            show_desktop_hud_toast("El Dorado Listening", "Speak a command or question now...", 5000)
            print("\n[El Dorado Hotkey triggered!]")
            utterance = listen_microphone_once()
            if utterance:
                handle_utterance(server_url, adapter, pdf_adapter, utterance, interactive_confirm=False)
            else:
                play_chime("error")
        finally:
            _SESSION_LOCK.release()

    hotkey_driver = register_global_hotkey(on_global_hotkey)
    if hotkey_driver:
        print(f"Hotkey Listener   : Active via {hotkey_driver}")
    else:
        print("Hotkey Listener   : Unavailable (install `keyboard` or `pynput` in requirements.txt)")

    print("\nType any question or command below (or press Alt+D+T anywhere to use mic). Ctrl+C to quit.")
    try:
        while True:
            utterance = input("El Dorado> ").strip()
            if not utterance:
                continue
            if utterance.lower() in ("exit", "quit"):
                break
            handle_utterance(server_url, adapter, pdf_adapter, utterance, interactive_confirm=True)
    except (KeyboardInterrupt, EOFError):
        print("\nEl Dorado Desktop Assistant stopped.")


if __name__ == "__main__":
    main()
