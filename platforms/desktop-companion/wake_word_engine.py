"""
Local wake-word detector for El Dorado ("Hey El Dorado").
Processes microphone frames strictly locally on-device using openWakeWord (Apache 2.0).
Audio is NEVER streamed to cloud APIs prior to wake-word activation.
"""

from __future__ import annotations
import os
import threading
from typing import Callable, Optional

import numpy as np
import sounddevice as sd

try:
    from openwakeword.model import Model as OpenWakeWordModel
except ImportError:
    OpenWakeWordModel = None  # Handled honestly at runtime


class LocalWakeWordEngine:
    def __init__(
        self,
        threshold: float = 0.65,
        model_path: Optional[str] = None,
        on_wake: Optional[Callable[[str, float], None]] = None,
    ) -> None:
        self.threshold = threshold
        self.model_path = model_path or os.environ.get("DOPE_WAKEWORD_MODEL", "")
        self.on_wake = on_wake
        self._running = False
        self._muted = False
        self._stream: Optional[sd.InputStream] = None
        self._lock = threading.Lock()
        self._model = None

    def load(self) -> tuple[bool, str]:
        if OpenWakeWordModel is None:
            return False, "openwakeword is not installed. Run: pip install -r requirements.txt"
        models = [self.model_path] if self.model_path and os.path.exists(self.model_path) else []
        try:
            self._model = OpenWakeWordModel(wakeword_models=models) if models else OpenWakeWordModel()
            return True, "Local openWakeWord engine initialized."
        except Exception as exc:
            return False, f"Failed to load openWakeWord model: {exc}"

    def set_muted(self, muted: bool) -> None:
        with self._lock:
            self._muted = muted

    def start(self) -> tuple[bool, str]:
        if self._model is None:
            ok, msg = self.load()
            if not ok:
                return False, msg

        self._running = True

        def audio_callback(indata: np.ndarray, _frames: int, _time_info, status) -> None:
            if status or not self._running:
                return
            with self._lock:
                if self._muted:
                    return
            pcm = (indata[:, 0] * 32767).astype(np.int16)
            scores = self._model.predict(pcm)
            for label, score in scores.items():
                if float(score) >= self.threshold and self.on_wake:
                    self.on_wake(label, float(score))

        self._stream = sd.InputStream(
            samplerate=16000,
            channels=1,
            dtype="float32",
            blocksize=1280,
            callback=audio_callback,
        )
        self._stream.start()
        return True, "Wake-word listener active locally at 16kHz."

    def stop(self) -> None:
        self._running = False
        if self._stream is not None:
            self._stream.stop()
            self._stream.close()
            self._stream = None
