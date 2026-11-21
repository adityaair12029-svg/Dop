function playToneSequence(notes: Array<[number, number, number, number]>): void {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    for (const [freq, delay, dur, peak] of notes) {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const g1 = ctx.createGain();
      const g2 = ctx.createGain();
      osc1.type = 'sine';
      osc2.type = 'triangle';
      osc1.frequency.setValueAtTime(freq, now + delay);
      osc2.frequency.setValueAtTime(freq * 2, now + delay);
      g1.gain.setValueAtTime(0.001, now + delay);
      g1.gain.exponentialRampToValueAtTime(peak, now + delay + 0.018);
      g1.gain.exponentialRampToValueAtTime(0.0008, now + delay + dur);
      g2.gain.setValueAtTime(0.0005, now + delay);
      g2.gain.exponentialRampToValueAtTime(peak * 0.28, now + delay + 0.015);
      g2.gain.exponentialRampToValueAtTime(0.0004, now + delay + dur * 0.75);
      osc1.connect(g1);
      osc2.connect(g2);
      g1.connect(ctx.destination);
      g2.connect(ctx.destination);
      osc1.start(now + delay);
      osc2.start(now + delay);
      osc1.stop(now + delay + dur + 0.03);
      osc2.stop(now + delay + dur + 0.03);
    }
    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 1100);
  } catch {
    // Ignore audio context autoplay restrictions
  }
}

export function playActivationChime(): void {
  playToneSequence([
    [523.25, 0, 0.18, 0.12],
    [659.25, 0.06, 0.2, 0.11],
    [783.99, 0.12, 0.22, 0.11],
    [1174.66, 0.18, 0.3, 0.09],
  ]);
}

export function playExecutingSound(): void {
  playToneSequence([
    [659.25, 0, 0.1, 0.09],
    [880.0, 0.06, 0.14, 0.09],
  ]);
}

export function playSuccessSound(): void {
  playToneSequence([
    [783.99, 0, 0.14, 0.1],
    [987.77, 0.07, 0.16, 0.1],
    [1174.66, 0.14, 0.24, 0.1],
  ]);
}

export function playErrorSound(): void {
  playToneSequence([
    [293.66, 0, 0.15, 0.09],
    [261.63, 0.11, 0.22, 0.08],
  ]);
}


export function speakText(text: string, language: string): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window) || !text.trim()) {
    return;
  }
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    if (language === 'hi') {
      utterance.lang = 'hi-IN';
    } else if (language === 'hinglish') {
      utterance.lang = 'en-IN';
    } else {
      utterance.lang = 'en-US';
    }
    utterance.rate = 1.03;
    window.speechSynthesis.speak(utterance);
  } catch {
    // Ignore TTS errors in headless environments
  }
}

export interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

export function createBrowserSpeechRecognition(language: string): SpeechRecognitionLike | null {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  const Ctor = win.SpeechRecognition || win.webkitSpeechRecognition;
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.continuous = true;
  rec.interimResults = true;
  rec.lang = language === 'hi' ? 'hi-IN' : language === 'hinglish' ? 'en-IN' : 'en-US';
  return rec;
}
