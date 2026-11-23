"""
El Dorado Whole-Laptop Desktop Assistant (Windows / macOS / Linux).
Self-installs required Python packages on first launch, then runs globally across
your Windows Desktop Home Screen, File Explorer, VS Code, and all apps:
- Press Alt + D + T anywhere (even when Chrome is closed or minimized)
- Plays harmonic bell chimes (activate, executing, success, error)
- Captures laptop microphone speech and answers any AI question aloud
- Executes allowlisted OS actions (launch apps, open URLs, minimize/switch windows, volume, PDF)
"""

from __future__ import annotations

import sys

sys.dont_write_bytecode = True

import importlib
import math
import os
import shutil
import struct
import subprocess
import tempfile
import threading
import time
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
            (523.25, 0.00, 0.20, 0.34),
            (659.25, 0.06, 0.22, 0.32),
            (783.99, 0.12, 0.24, 0.32),
            (1174.66, 0.18, 0.34, 0.28),
        ],
        "executing": [
            (659.25, 0.00, 0.12, 0.26),
            (880.00, 0.07, 0.16, 0.26),
        ],
        "success": [
            (783.99, 0.00, 0.16, 0.28),
            (987.77, 0.07, 0.18, 0.28),
            (1174.66, 0.14, 0.28, 0.30),
        ],
        "error": [
            (293.66, 0.00, 0.16, 0.28),
            (261.63, 0.12, 0.24, 0.26),
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
        engine.setProperty("rate", 172)
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
            recognizer.adjust_for_ambient_noise(source, duration=0.35)
            audio = recognizer.listen(source, timeout=6, phrase_time_limit=12)
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
    """Built-in desktop fallback when backend API is unreachable (e.g. static hosting)."""
    import re
    clean = re.sub(r"^\s*(?:hey|hi|ok|okay|hello)\s+(?:el\s*dorado|eldorado|el-dorado)\b[\s,.:!?-]*", "", utterance.strip(), flags=re.I)
    lower = clean.lower().strip()
    plat = "windows" if sys.platform == "win32" else ("macos" if sys.platform == "darwin" else "linux")

    sites = {
        "youtube": "https://www.youtube.com",
        "google": "https://www.google.com",
        "gmail": "https://mail.google.com",
        "github": "https://github.com",
        "wikipedia": "https://www.wikipedia.org",
    }
    if "minimize" in lower:
        return {"supported": True, "action": {"action": "minimize_window", "platform": plat, "requires_confirmation": False}, "spoken_response": "Minimizing window."}
    if "maximize" in lower:
        return {"supported": True, "action": {"action": "maximize_window", "platform": plat, "requires_confirmation": False}, "spoken_response": "Maximizing window."}
    if "restore" in lower:
        return {"supported": True, "action": {"action": "restore_window", "platform": plat, "requires_confirmation": False}, "spoken_response": "Restoring window."}
    if "scroll down" in lower:
        return {"supported": True, "action": {"action": "scroll", "platform": plat, "requires_confirmation": False, "parameters": {"direction": "down"}}, "spoken_response": "Scrolling down."}
    if "scroll up" in lower:
        return {"supported": True, "action": {"action": "scroll", "platform": plat, "requires_confirmation": False, "parameters": {"direction": "up"}}, "spoken_response": "Scrolling up."}
    if "increase volume" in lower or "volume up" in lower:
        return {"supported": True, "action": {"action": "adjust_volume", "platform": plat, "requires_confirmation": False, "parameters": {"delta": 10}}, "spoken_response": "Increasing volume."}
    if "decrease volume" in lower or "volume down" in lower:
        return {"supported": True, "action": {"action": "adjust_volume", "platform": plat, "requires_confirmation": False, "parameters": {"delta": -10}}, "spoken_response": "Decreasing volume."}
    m_open = re.match(r"^open\s+(.+)$", clean, flags=re.I)
    if m_open:
        target = m_open.group(1).strip().rstrip(".!?")
        key = target.lower().replace(" ", "")
        if key in sites:
            return {"supported": True, "action": {"action": "open_url", "target": sites[key], "platform": plat, "requires_confirmation": False}, "spoken_response": f"Opening {target}."}
        return {"supported": True, "action": {"action": "open_app", "target": target, "platform": plat, "requires_confirmation": False}, "spoken_response": f"Launching {target}."}
    return {
        "supported": True,
        "action": {"action": "web_search", "target": f"https://www.google.com/search?q={requests.utils.quote(clean)}", "platform": plat, "requires_confirmation": False},
        "spoken_response": f"Searching Google for {clean}.",
    }


def send_command_to_server(server_url: str, utterance: str, active_title: str) -> dict[str, Any]:
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
            timeout=10,
        )
        ctype = resp.headers.get("content-type", "")
        if resp.ok and "application/json" in ctype.lower():
            return resp.json()
    except Exception:
        pass
    return local_offline_interpret(utterance)


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

    interpreted = send_command_to_server(server_url, clean, title)

    action = interpreted.get("action", {}) or {}
    action_name = action.get("action")
    spoken = str(interpreted.get("spoken_response") or "Done.")

    if not interpreted.get("supported", True):
        play_chime("error")
        reason = interpreted.get("unsupported_reason") or spoken
        print(f"[El Dorado Notice]: {reason}")
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
        speak_text(spoken)
        return

    if action_name in ("open_url", "web_search"):
        target = str(action.get("target") or "")
        if target.startswith(("https://", "http://")):
            webbrowser.open(target)
            play_chime("success")
            print(f"[El Dorado]: {spoken} ({target})")
            speak_text(spoken)
            return

    if action_name in ("pdf_navigate_page", "pdf_fit"):
        res = pdf_adapter.execute_pdf_command(title, action)
    else:
        res = adapter.execute(action)

    if res.get("ok"):
        play_chime("success")
        print(f"[El Dorado]: {spoken} | {res.get('message', '')}")
        speak_text(spoken)
    else:
        play_chime("error")
        err_msg = res.get("message") or spoken
        print(f"[El Dorado]: {err_msg}")
        speak_text(err_msg)


def register_global_hotkey(callback) -> str | None:
    """Register Alt+D+T globally across the entire OS desktop (home screen, any app)."""
    try:
        import keyboard

        keyboard.add_hotkey("alt+d+t", callback)
        return "keyboard (Alt + D + T)"
    except Exception:
        pass

    try:
        from pynput import keyboard as pynput_kb

        pressed: set[str] = set()
        last_fire = [0.0]

        def norm(key) -> str:
            if key in (pynput_kb.Key.alt, pynput_kb.Key.alt_l, pynput_kb.Key.alt_r, pynput_kb.Key.alt_gr):
                return "alt"
            char = getattr(key, "char", None)
            return char.lower() if isinstance(char, str) else ""

        def on_press(key):
            k = norm(key)
            if k:
                pressed.add(k)
            if "alt" in pressed and "d" in pressed and "t" in pressed:
                now = time.time()
                if now - last_fire[0] > 0.7:
                    last_fire[0] = now
                    threading.Thread(target=callback, daemon=True).start()

        def on_release(key):
            k = norm(key)
            pressed.discard(k)

        listener = pynput_kb.Listener(on_press=on_press, on_release=on_release)
        listener.daemon = True
        listener.start()
        return "pynput (Alt + D + T)"
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
    print("Global Hotkey     : Alt + D + T (works on Desktop Home & all apps)")
    print('Wake Phrase       : "Hey El Dorado"')
    print("=" * 64)
    play_chime("activate")

    def on_global_hotkey():
        if not _SESSION_LOCK.acquire(blocking=False):
            return
        try:
            play_chime("activate")
            print("\n[El Dorado Hotkey Alt+D+T triggered!]")
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
