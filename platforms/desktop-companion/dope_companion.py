"""
DOPE Whole-Laptop Desktop Companion Entrypoint.
Runs globally across Windows Desktop home screen, macOS, and Linux:
- Press Alt + D + T anywhere (even when Chrome is closed or minimized)
- Plays sweet harmonic bell chimes (activate, executing, success, error)
- Captures laptop microphone speech (EN-IN / Hindi / Hinglish / English)
- Answers any AI question via DOPE Gemini AI backend and speaks replies aloud
- Executes allowlisted OS actions (launch apps, open URLs, minimize/switch windows, volume, PDF)
"""

from __future__ import annotations

import math
import os
import shutil
import struct
import subprocess
import sys
import tempfile
import threading
import time
import wave
import webbrowser
from pathlib import Path
from typing import Any

import requests

from adapters.windows_adapter import WindowsAdapter
from adapters.macos_adapter import MacOSAdapter
from adapters.linux_adapter import LinuxAdapter
from adapters.pdf_adapter import PdfViewerAdapter

DEFAULT_SERVER_URL = "__DOPE_SERVER_URL__"

_SESSION_LOCK = threading.Lock()
_CHIME_DIR = Path(tempfile.gettempdir()) / "dope_chimes"


def resolve_server_url() -> str:
    env_url = os.environ.get("DOPE_SERVER_URL", "").strip()
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
    """
    Generate a warm dual-oscillator harmonic bell chime WAV using pure Python stdlib.
    Each note tuple is (freq_hz, start_sec, duration_sec, amplitude).
    """
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
        # C-maj9 airy bell chime on Alt+D+T wake
        "activate": [
            (523.25, 0.00, 0.20, 0.34),
            (659.25, 0.06, 0.22, 0.32),
            (783.99, 0.12, 0.24, 0.32),
            (1174.66, 0.18, 0.34, 0.28),
        ],
        # Gentle thinking / executing pulse
        "executing": [
            (659.25, 0.00, 0.12, 0.26),
            (880.00, 0.07, 0.16, 0.26),
        ],
        # Warm ascending confirmation cadence
        "success": [
            (783.99, 0.00, 0.16, 0.28),
            (987.77, 0.07, 0.18, 0.28),
            (1174.66, 0.14, 0.28, 0.30),
        ],
        # Soft gentle descending error tone
        "error": [
            (293.66, 0.00, 0.16, 0.28),
            (261.63, 0.12, 0.24, 0.26),
        ],
    }
    paths: dict[str, Path] = {}
    for name, notes in specs.items():
        target = _CHIME_DIR / f"dope_{name}.wav"
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
            # Built-in Windows SAPI speech synthesizer without extra pip packages
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
        print("[DOPE] SpeechRecognition package not installed; type your question/command in this window.")
        return None

    recognizer = sr.Recognizer()
    try:
        with sr.Microphone() as source:
            print("[DOPE] Listening on laptop microphone (English / Hindi / Hinglish)...")
            recognizer.adjust_for_ambient_noise(source, duration=0.35)
            audio = recognizer.listen(source, timeout=6, phrase_time_limit=12)
        text = recognizer.recognize_google(audio, language="en-IN")
        return text.strip()
    except sr.WaitTimeoutError:
        print("[DOPE] No speech detected before timeout.")
        return None
    except sr.UnknownValueError:
        print("[DOPE] Could not understand speech clearly. Try again.")
        return None
    except Exception as exc:
        print(f"[DOPE] Microphone capture unavailable ({exc}). You can type directly in this terminal.")
        return None


def send_command_to_dope_server(server_url: str, utterance: str, active_title: str) -> dict[str, Any]:
    resp = requests.post(
        f"{server_url.rstrip('/')}/api/dope/command",
        json={
            "text": utterance,
            "language": "auto",
            "context": {
                "platform": "windows" if sys.platform == "win32" else ("macos" if sys.platform == "darwin" else "linux"),
                "companion_connected": True,
                "active_window_title": active_title,
            },
        },
        timeout=20,
    )
    resp.raise_for_status()
    return resp.json()


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

    try:
        interpreted = send_command_to_dope_server(server_url, clean, title)
    except Exception as exc:
        play_chime("error")
        msg = f"Could not reach DOPE server at {server_url}: {exc}"
        print(f"[DOPE Error]: {msg}")
        speak_text("Could not reach the DOPE server.")
        return

    action = interpreted.get("action", {}) or {}
    action_name = action.get("action")
    spoken = str(interpreted.get("spoken_response") or "Done.")

    if not interpreted.get("supported", True):
        play_chime("error")
        reason = interpreted.get("unsupported_reason") or spoken
        print(f"[DOPE Notice]: {reason}")
        speak_text(reason)
        return

    if action.get("requires_confirmation"):
        print(f"[DOPE Confirm]: {spoken}")
        speak_text(f"Please confirm: {spoken}")
        if interactive_confirm:
            confirm = input(f"Confirm action ({action_name})? [y/N]: ").strip().lower()
            if confirm != "y":
                print("[DOPE]: Action cancelled.")
                return
        else:
            print("[DOPE]: Skipping confirmation-required action from background hotkey. Run in terminal to confirm.")
            return

    if action_name in ("answer_question", "clarify", "stop_listening", "list_devices"):
        play_chime("success")
        print(f"[DOPE AI]: {spoken}")
        speak_text(spoken)
        return

    if action_name in ("open_url", "web_search"):
        target = str(action.get("target") or "")
        if target.startswith(("https://", "http://")):
            webbrowser.open(target)
            play_chime("success")
            print(f"[DOPE]: {spoken} ({target})")
            speak_text(spoken)
            return

    if action_name in ("pdf_navigate_page", "pdf_fit"):
        res = pdf_adapter.execute_pdf_command(title, action)
    else:
        res = adapter.execute(action)

    if res.get("ok"):
        play_chime("success")
        print(f"[DOPE]: {spoken} | {res.get('message', '')}")
        speak_text(spoken)
    else:
        play_chime("error")
        err_msg = res.get("message") or spoken
        print(f"[DOPE]: {err_msg}")
        speak_text(err_msg)


def register_global_hotkey(callback) -> str | None:
    """
    Register Alt+D+T globally across the entire OS desktop (home screen, any app).
    Tries `keyboard` first, then falls back to `pynput`.
    """
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
    print(f"DOPE Whole-Laptop Assistant Active ({sys.platform})")
    print(f"Backend AI Server : {server_url}")
    print("Global Hotkey     : Alt + D + T (works on Desktop Home & all apps)")
    print("=" * 64)
    play_chime("activate")

    def on_global_hotkey():
        if not _SESSION_LOCK.acquire(blocking=False):
            return
        try:
            play_chime("activate")
            print("\n[DOPE Hotkey Alt+D+T triggered!]")
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
            utterance = input("DOPE> ").strip()
            if not utterance:
                continue
            if utterance.lower() in ("exit", "quit"):
                break
            handle_utterance(server_url, adapter, pdf_adapter, utterance, interactive_confirm=True)
    except (KeyboardInterrupt, EOFError):
        print("\nDOPE Desktop Assistant stopped.")


if __name__ == "__main__":
    main()
