import React, { useEffect, useRef, useState } from 'react';
import {
  Download,
  ExternalLink,
  FileText,
  Laptop,
  Mail,
  Maximize2,
  Mic,
  MicOff,
  Minimize2,
  Puzzle,
  RefreshCw,
  Send,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { DopeAction, DopePlatform } from '../shared/actions';
import { detectWakeWord } from '../shared/wakeword';
import {
  createBrowserSpeechRecognition,
  playActivationChime,
  playErrorSound,
  playExecutingSound,
  playSuccessSound,
  speakText,
  type SpeechRecognitionLike,
} from '../lib/speech';
import { downloadVerifiedZip } from '../lib/downloadZip';

export interface HistoryRecord {
  id: string;
  timestamp: string;
  raw_input: string;
  wake_word_detected: boolean;
  language_hint: string;
  action: DopeAction;
  spoken_response: string;
  status: string;
  ai_source: 'gemini' | 'offline_fallback';
  error_detail?: string;
}

export interface GmailMessageItem {
  id: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
  unread: boolean;
}

interface VoiceConsoleProps {
  language: 'auto' | 'en' | 'hi' | 'hinglish';
  onChangeLanguage: (lang: 'auto' | 'en' | 'hi' | 'hinglish') => void;
  voiceFeedbackEnabled: boolean;
  onToggleVoiceFeedback: () => void;
  history: HistoryRecord[];
  hasGmailToken: boolean;
  gmailMessages: GmailMessageItem[];
  gmailLoading: boolean;
  gmailError: string | null;
  onFetchGmail: () => void;
  onRequestGoogleSignIn: () => void;
  onSubmitCommand: (
    text: string,
    context: {
      platform: DopePlatform;
      pdf_viewer_type: 'browser_pdf_testbench' | 'unsupported_viewer';
      linux_display_server?: 'x11' | 'wayland';
    }
  ) => Promise<{
    id: string;
    status: string;
    action: DopeAction;
    spoken_response: string;
    ambiguous?: boolean;
    clarification_question?: string;
    supported: boolean;
    unsupported_reason?: string;
    ai_source: 'gemini' | 'offline_fallback';
    error_detail?: string;
  } | null>;
  onActionResultApplied?: (msg: string) => void;
  onOpenExtensionStudio?: () => void;
}

const SAMPLE_PROMPTS = [
  'Hey Dop, open YouTube.',
  'Hey Dop, what is 25 * 48?',
  'Hey Dop, who invented Python?',
  'Hey Dop, scroll down.',
  'Hey Dop, go to page 15.',
  'Hey Dop, YouTube chalao',
];

export const VoiceConsole: React.FC<VoiceConsoleProps> = ({
  language,
  onChangeLanguage,
  voiceFeedbackEnabled,
  onToggleVoiceFeedback,
  history,
  hasGmailToken,
  gmailMessages,
  gmailLoading,
  gmailError,
  onFetchGmail,
  onRequestGoogleSignIn,
  onSubmitCommand,
  onOpenExtensionStudio,
}) => {
  const [inputText, setInputText] = useState('');
  const [targetPlatform, setTargetPlatform] = useState<DopePlatform>('web');
  const [linuxDisplay, setLinuxDisplay] = useState<'x11' | 'wayland'>('x11');
  const [pdfViewerType, setPdfViewerType] = useState<'browser_pdf_testbench' | 'unsupported_viewer'>(
    'browser_pdf_testbench'
  );
  const [wakeWordMode, setWakeWordMode] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [sessionActive, setSessionActive] = useState(false);
  const [micPermissionError, setMicPermissionError] = useState<string | null>(null);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [downloadBusy, setDownloadBusy] = useState<'extension' | 'desktop' | null>(null);
  const [downloadNote, setDownloadNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [lastResult, setLastResult] = useState<{
    spoken_response: string;
    action: DopeAction;
    status: string;
    ai_source: 'gemini' | 'offline_fallback';
    clarification_question?: string;
    unsupported_reason?: string;
    error_detail?: string;
  } | null>(null);

  // Interactive Browser PDF / Document Testbench State
  const [pdfPage, setPdfPage] = useState(1);
  const [pdfZoom, setPdfZoom] = useState(100);
  const [pdfFitMode, setPdfFitMode] = useState<'custom' | 'screen' | 'width'>('custom');
  const [pdfMinimized, setPdfMinimized] = useState(false);
  const [pdfReloadCount, setPdfReloadCount] = useState(0);
  const pdfScrollRef = useRef<HTMLDivElement | null>(null);

  // Web Audio FFT Wave Canvas Refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);

  const stopAudioCapture = () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    try {
      recognitionRef.current?.stop();
    } catch {
      // Ignore stop errors
    }
    recognitionRef.current = null;
    audioStreamRef.current?.getTracks().forEach((t) => t.stop());
    audioStreamRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    analyserRef.current = null;
    setIsListening(false);
  };

  // Draw baseline or live FFT waveform cleanly
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const drawBaseline = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = isListening ? '#2563EB' : '#94A3B8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.stroke();
    };

    if (!isListening || !analyserRef.current) {
      drawBaseline();
      return;
    }

    const analyser = analyserRef.current;
    const bufferLen = analyser.frequencyBinCount;
    const data = new Uint8Array(bufferLen);

    const render = () => {
      analyser.getByteTimeDomainData(data);
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = '#2563EB';
      ctx.lineWidth = 2;
      ctx.beginPath();
      const slice = w / bufferLen;
      for (let i = 0; i < bufferLen; i++) {
        const v = data[i] / 128.0;
        const y = (v * h) / 2;
        if (i === 0) ctx.moveTo(0, y);
        else ctx.lineTo(i * slice, y);
      }
      ctx.stroke();
      rafRef.current = requestAnimationFrame(render);
    };

    rafRef.current = requestAnimationFrame(render);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [isListening]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAudioCapture();
    };
  }, []);

  // Global keyboard shortcut Alt+D+T (plus Alt+D and Ctrl+Shift+D fallback)
  useEffect(() => {
    const pressed = new Set<string>();
    let lastChordAt = 0;

    const triggerVoiceToggle = () => {
      if (isListening) {
        stopAudioCapture();
      } else {
        void startListening(false);
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      pressed.add(k);
      const isAltDT = e.altKey && pressed.has('d') && pressed.has('t');
      const isAltDOnly = e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && k === 'd';
      const isCtrlShiftD = (e.ctrlKey || e.metaKey) && e.shiftKey && k === 'd';

      if (isAltDT || isCtrlShiftD) {
        e.preventDefault();
        lastChordAt = Date.now();
        triggerVoiceToggle();
      } else if (isAltDOnly && Date.now() - lastChordAt > 500) {
        e.preventDefault();
        setTimeout(() => {
          if (!pressed.has('t') && Date.now() - lastChordAt > 250) {
            triggerVoiceToggle();
          }
        }, 160);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      pressed.delete(e.key.toLowerCase());
    };
    const onBlur = () => pressed.clear();

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  });

  const applyLocalBrowserAction = (action: DopeAction) => {
    if (action.action === 'stop_listening') {
      stopAudioCapture();
      setWakeWordMode(false);
      setSessionActive(false);
      return;
    }

    if (action.action === 'scroll' && pdfScrollRef.current) {
      const dy = action.parameters?.direction === 'up' ? -220 : 220;
      pdfScrollRef.current.scrollBy({ top: dy, behavior: 'smooth' });
    } else if (action.action === 'zoom') {
      const dir = action.parameters?.direction;
      setPdfFitMode('custom');
      setPdfZoom((prev) => {
        if (dir === 'in') return Math.min(200, prev + 20);
        if (dir === 'out') return Math.max(60, prev - 20);
        return 100;
      });
    } else if (action.action === 'pdf_navigate_page') {
      const p = action.parameters?.page;
      const dir = action.parameters?.direction;
      setPdfPage((prev) => {
        if (typeof p === 'number') return Math.min(25, Math.max(1, p));
        if (dir === 'next') return Math.min(25, prev + 1);
        if (dir === 'previous') return Math.max(1, prev - 1);
        return prev;
      });
    } else if (action.action === 'pdf_fit') {
      setPdfFitMode(action.parameters?.fit_mode === 'width' ? 'width' : 'screen');
      setPdfZoom(action.parameters?.fit_mode === 'width' ? 120 : 95);
    } else if (action.action === 'reload_tab') {
      setPdfReloadCount((c) => c + 1);
    } else if (action.action === 'minimize_window' && targetPlatform === 'web') {
      setPdfMinimized(true);
    } else if (action.action === 'maximize_window' || action.action === 'restore_window') {
      setPdfMinimized(false);
    } else if (action.action === 'read_emails') {
      if (hasGmailToken) {
        onFetchGmail();
      }
    }
  };

  const executeCommand = async (rawText: string) => {
    const trimmed = rawText.trim();
    if (!trimmed) return;
    setIsSubmitting(true);
    playExecutingSound();
    try {
      const res = await onSubmitCommand(trimmed, {
        platform: targetPlatform,
        pdf_viewer_type: pdfViewerType,
        linux_display_server: targetPlatform === 'linux' ? linuxDisplay : undefined,
      });
      if (!res) return;

      setLastResult({
        spoken_response: res.spoken_response,
        action: res.action,
        status: res.status,
        ai_source: res.ai_source,
        clarification_question: res.clarification_question,
        unsupported_reason: res.unsupported_reason,
        error_detail: res.error_detail,
      });

      if (res.status === 'executed') {
        playSuccessSound();
        applyLocalBrowserAction(res.action);
      } else if (res.action.action === 'stop_listening') {
        playSuccessSound();
        applyLocalBrowserAction(res.action);
      } else if (!res.supported || res.status === 'unsupported') {
        playErrorSound();
      } else {
        playSuccessSound();
      }

      if (voiceFeedbackEnabled) {
        speakText(res.spoken_response, language);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const startListening = async (enableWakeWord: boolean) => {
    setMicPermissionError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setMicPermissionError(
        'This browser environment does not expose microphone capture (navigator.mediaDevices). Use the text command bar below or run DOPE over HTTPS/localhost.'
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;

      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        const audioCtx = new AudioCtx();
        const src = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 1024;
        src.connect(analyser);
        audioCtxRef.current = audioCtx;
        analyserRef.current = analyser;
      }

      setIsListening(true);
      setWakeWordMode(enableWakeWord);
      if (!enableWakeWord) {
        playActivationChime();
        setSessionActive(true);
      }

      const rec = createBrowserSpeechRecognition(language);
      if (!rec) {
        setMicPermissionError(
          'Microphone audio wave is live, but Web SpeechRecognition is unsupported in this browser. Type commands in the bar below or use the Desktop Companion.'
        );
        return;
      }

      rec.onresult = (event) => {
        let finalTranscript = '';
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const piece = event.results[i][0]?.transcript ?? '';
          if (event.results[i].isFinal) finalTranscript += piece;
          else interim += piece;
        }
        setLiveTranscript((finalTranscript || interim).trim());

        if (finalTranscript.trim()) {
          const wake = detectWakeWord(finalTranscript);
          if (enableWakeWord && !sessionActive) {
            if (wake.detected) {
              playActivationChime();
              setSessionActive(true);
              if (wake.command_text) {
                void executeCommand(finalTranscript);
              }
            }
          } else {
            void executeCommand(finalTranscript);
          }
        }
      };

      rec.onerror = (ev) => {
        if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') {
          setMicPermissionError(
            'Microphone permission was denied. Click the lock icon in your browser address bar, allow Microphone access, and try again.'
          );
          stopAudioCapture();
        }
      };

      rec.onend = () => {
        if (audioStreamRef.current && wakeWordMode) {
          try {
            rec.start();
          } catch {
            // Ignore restart race
          }
        } else {
          setIsListening(false);
        }
      };

      recognitionRef.current = rec;
      rec.start();
    } catch (err: unknown) {
      const name = err instanceof Error ? err.name : '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setMicPermissionError(
          'Microphone permission denied. Open your browser site settings, set Microphone to Allow, and click Activate Voice again.'
        );
      } else {
        setMicPermissionError(
          `Could not start microphone (${err instanceof Error ? err.message : 'device unavailable'}). You can still enter commands in the text bar below.`
        );
      }
      stopAudioCapture();
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isSubmitting) return;
    const cmd = inputText;
    setInputText('');
    void executeCommand(cmd);
  };

  return (
    <div className="space-y-6">
      {/* Top Workspace Controls Row */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Voice Command Console
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
            Wake phrase: <span className="font-semibold text-slate-900 dark:text-slate-200">Hey Dop</span>
            <span aria-hidden="true"> · </span>
            Shortcut:{' '}
            <kbd className="font-mono text-xs px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-700">
              Alt+D+T
            </kbd>{' '}
            <span className="text-xs text-slate-500">(or Alt+D)</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-400">
            <span>Language</span>
            <select
              aria-label="Assistant language"
              value={language}
              onChange={(e) => onChangeLanguage(e.target.value as 'auto' | 'en' | 'hi' | 'hinglish')}
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100"
            >
              <option value="auto">Auto (EN / HI / Hinglish)</option>
              <option value="en">English</option>
              <option value="hi">Hindi</option>
              <option value="hinglish">Hinglish</option>
            </select>
          </label>

          <label className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-400">
            <span>Target Platform</span>
            <select
              aria-label="Target execution platform"
              value={targetPlatform}
              onChange={(e) => setTargetPlatform(e.target.value as DopePlatform)}
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100"
            >
              <option value="web">Web Browser (Active)</option>
              <option value="browser_extension">Chrome / Edge Extension</option>
              <option value="windows">Windows 11 Companion</option>
              <option value="macos">macOS Companion</option>
              <option value="linux">Linux Companion</option>
              <option value="android">Android App</option>
              <option value="ios">iOS App</option>
            </select>
          </label>

          {targetPlatform === 'linux' && (
            <select
              aria-label="Linux display server"
              value={linuxDisplay}
              onChange={(e) => setLinuxDisplay(e.target.value as 'x11' | 'wayland')}
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100"
            >
              <option value="x11">Linux X11</option>
              <option value="wayland">Linux Wayland</option>
            </select>
          )}

          <button
            type="button"
            onClick={onToggleVoiceFeedback}
            aria-label={voiceFeedbackEnabled ? 'Mute spoken responses' : 'Enable spoken responses'}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
          >
            {voiceFeedbackEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            <span>{voiceFeedbackEnabled ? 'Speech On' : 'Speech Muted'}</span>
          </button>
        </div>
      </div>

      {/* Main 2-Column Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 7 Cols: Voice Orb + Waveform + Command Input + Result */}
        <div className="lg:col-span-7 space-y-6">
          <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => (isListening ? stopAudioCapture() : void startListening(false))}
                  aria-label={isListening ? 'Stop microphone listening' : 'Activate voice microphone'}
                  className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
                    isListening
                      ? 'bg-rose-600 hover:bg-rose-700 text-white'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  {isListening ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                </button>
                <div>
                  <div className="text-base font-semibold text-slate-900 dark:text-slate-100">
                    {isListening
                      ? wakeWordMode && !sessionActive
                        ? 'Waiting for "Hey Dop"...'
                        : 'Listening for command'
                      : 'Microphone idle'}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {sessionActive
                      ? 'Follow-up session active — speak naturally without repeating "Hey Dop"'
                      : 'Tap to speak or enable Wake-Word Mode'}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    isListening && wakeWordMode ? stopAudioCapture() : void startListening(true)
                  }
                  className={`px-3.5 py-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                    isListening && wakeWordMode
                      ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                      : 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {isListening && wakeWordMode ? 'Stop Wake-Word' : 'Enable "Hey Dop" Mode'}
                </button>
              </div>
            </div>

            {/* Voice-Wave Canvas */}
            <div className="mt-5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3">
              <canvas
                ref={canvasRef}
                width={640}
                height={56}
                aria-label="Voice waveform monitor"
                className="w-full h-14 block"
              />
              {liveTranscript && (
                <p className="mt-2 text-xs text-slate-700 dark:text-slate-300 font-medium">
                  Heard: &ldquo;{liveTranscript}&rdquo;
                </p>
              )}
            </div>

            {micPermissionError && (
              <div
                role="alert"
                className="mt-4 rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-3 text-xs text-amber-900 dark:text-amber-200"
              >
                {micPermissionError}
              </div>
            )}

            {/* Text / Voice Command Input */}
            <form onSubmit={handleFormSubmit} className="mt-5 flex gap-2">
              <label htmlFor="dope-command-input" className="sr-only">
                Type or speak a DOPE command
              </label>
              <input
                id="dope-command-input"
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder='Ask any AI question ("25 * 48", "Who is Ada Lovelace?") or say "YouTube kholo"'
                className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              <button
                type="submit"
                disabled={isSubmitting || !inputText.trim()}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                <Send className="w-4 h-4" />
                <span>{isSubmitting ? 'Thinking...' : 'Run'}</span>
              </button>
            </form>

            {/* Quick Example Commands */}
            <div className="mt-4 flex flex-wrap gap-2">
              {SAMPLE_PROMPTS.map((phrase) => (
                <button
                  key={phrase}
                  type="button"
                  onClick={() => void executeCommand(phrase)}
                  className="px-2.5 py-1 text-xs rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 hover:border-blue-500 hover:text-blue-700 dark:hover:text-blue-400 transition-colors whitespace-nowrap shrink-0 max-w-full truncate"
                >
                  {phrase}
                </button>
              ))}
            </div>
          </section>

          {/* Latest Command Result & Action Schema Inspector */}
          <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Assistant Response & Action Output
              </h2>
              {lastResult && (
                <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                  {lastResult.status.replace(/_/g, ' ')} ·{' '}
                  {lastResult.ai_source === 'gemini' ? 'Gemini AI' : 'Offline Fallback'}
                </span>
              )}
            </div>

            {!lastResult ? (
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                Issue a voice or text command above to see DOPE&apos;s spoken response, validated action
                schema, and honest execution feedback.
              </p>
            ) : (
              <div className="mt-4 space-y-4">
                {lastResult.action.action === 'answer_question' && (
                  <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>DOPE AI Answer</span>
                  </div>
                )}
                <p className="text-sm text-slate-900 dark:text-slate-100 font-medium leading-relaxed">
                  {lastResult.spoken_response}
                </p>

                {lastResult.clarification_question && (
                  <p className="text-xs text-blue-700 dark:text-blue-400">
                    Clarification needed: {lastResult.clarification_question}
                  </p>
                )}

                {lastResult.unsupported_reason && (
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    Platform limitation: {lastResult.unsupported_reason}
                  </p>
                )}

                {(lastResult.action.action === 'open_url' ||
                  lastResult.action.action === 'web_search') &&
                  lastResult.action.target &&
                  lastResult.status === 'executed' && (
                    <div className="space-y-1.5">
                      <a
                        href={lastResult.action.target}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:opacity-90"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Open {lastResult.action.target}</span>
                      </a>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Browser security blocks websites from opening tabs automatically without a click. Install the DOPE Chrome Extension (.zip) to auto-open tabs, switch tabs, scroll, and minimize Chrome windows directly.
                      </p>
                    </div>
                  )}

                <pre className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-800 dark:text-slate-200 overflow-x-auto">
                  {JSON.stringify(lastResult.action, null, 2)}
                </pre>
              </div>
            )}
          </section>

          {/* Recent Command History */}
          <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Recent Command History
            </h2>
            {history.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                No commands executed yet in this workspace.
              </p>
            ) : (
              <div className="mt-4 divide-y divide-slate-200 dark:divide-slate-800">
                {history.slice(0, 8).map((item) => (
                  <div key={item.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                        {item.raw_input}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                        {item.spoken_response}
                      </div>
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 shrink-0 tabular-nums font-mono">
                      {item.action.action} · {item.status} ·{' '}
                      {new Date(item.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Right 5 Cols: Chrome Extension Quick Card + PDF Testbench + Connected Gmail Inbox */}
        <div className="lg:col-span-5 space-y-6">
          <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2 min-w-0">
                <Puzzle className="w-4 h-4 text-blue-600 shrink-0" />
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                  Chrome &amp; Edge Extension (Pi-Style)
                </h2>
              </div>
              {onOpenExtensionStudio && (
                <button
                  type="button"
                  onClick={onOpenExtensionStudio}
                  className="text-xs font-medium text-blue-600 hover:underline whitespace-nowrap shrink-0"
                >
                  Upload Custom Logo
                </button>
              )}
            </div>
            <p className="mt-3 text-xs text-slate-600 dark:text-slate-400">
              Press{' '}
              <kbd className="font-mono px-1 py-0.5 rounded border border-slate-300 dark:border-slate-700">
                Alt+D+T
              </kbd>{' '}
              on any Chrome tab for voice + sweet chimes &amp; AI Q&amp;A. Download <strong>Laptop Desktop App (.zip)</strong> to get <strong>both</strong> Chrome Extension v1.3 (<code className="font-mono">chrome://extensions</code> &rarr; Load unpacked) <strong>and</strong> <code className="font-mono">python dope_companion.py</code> for Windows Desktop Home Screen.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={downloadBusy !== null}
                onClick={async () => {
                  setDownloadBusy('extension');
                  setDownloadNote(null);
                  try {
                    const info = await downloadVerifiedZip({ kind: 'extension' });
                    setDownloadNote({
                      ok: true,
                      text: `Downloaded ${info.filename} (${Math.round(info.byteLength / 1024)} KB). Extract All -> chrome://extensions -> Load unpacked.`,
                    });
                  } catch (err) {
                    setDownloadNote({
                      ok: false,
                      text: err instanceof Error ? err.message : 'Extension download failed.',
                    });
                  } finally {
                    setDownloadBusy(null);
                  }
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 whitespace-nowrap shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{downloadBusy === 'extension' ? 'Downloading...' : 'Chrome Extension (.zip)'}</span>
              </button>
              <button
                type="button"
                disabled={downloadBusy !== null}
                onClick={async () => {
                  setDownloadBusy('desktop');
                  setDownloadNote(null);
                  try {
                    const info = await downloadVerifiedZip({ kind: 'desktop' });
                    setDownloadNote({
                      ok: true,
                      text: `Downloaded ${info.filename} (${Math.round(info.byteLength / 1024)} KB). Extract All -> Load unpacked in chrome://extensions AND run python dope_companion.py for Desktop Home Screen.`,
                    });
                  } catch (err) {
                    setDownloadNote({
                      ok: false,
                      text: err instanceof Error ? err.message : 'Desktop download failed.',
                    });
                  } finally {
                    setDownloadBusy(null);
                  }
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:opacity-90 disabled:opacity-60 whitespace-nowrap shrink-0"
              >
                <Laptop className="w-3.5 h-3.5" />
                <span>{downloadBusy === 'desktop' ? 'Downloading...' : 'Laptop Desktop App (.zip)'}</span>
              </button>
              {onOpenExtensionStudio && (
                <button
                  type="button"
                  onClick={onOpenExtensionStudio}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
                >
                  <span>Customize Logo &amp; Install Steps</span>
                </button>
              )}
            </div>
            {downloadNote && (
              <div
                role="status"
                className={`mt-2.5 rounded-lg border px-3 py-2 text-[11px] ${
                  downloadNote.ok
                    ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200'
                    : 'border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/30 text-rose-900 dark:text-rose-200'
                }`}
              >
                {downloadNote.text}
              </div>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                  PDF &amp; Document Testbench
                </h2>
              </div>
              <select
                aria-label="Simulated PDF viewer capability"
                value={pdfViewerType}
                onChange={(e) =>
                  setPdfViewerType(
                    e.target.value as 'browser_pdf_testbench' | 'unsupported_viewer'
                  )
                }
                className="rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1 text-xs text-slate-800 dark:text-slate-200 shrink-0"
              >
                <option value="browser_pdf_testbench">Compatible Viewer</option>
                <option value="unsupported_viewer">Unsupported PDF</option>
              </select>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-400 tabular-nums">
              <span>
                Page {pdfPage} / 25 · Zoom {pdfZoom}% · Fit: {pdfFitMode}
                {pdfReloadCount > 0 ? ` · Reloaded ${pdfReloadCount}x` : ''}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPdfReloadCount((c) => c + 1)}
                  aria-label="Reload PDF"
                  className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setPdfMinimized((m) => !m)}
                  aria-label={pdfMinimized ? 'Restore PDF window' : 'Minimize PDF window'}
                  className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  {pdfMinimized ? (
                    <Maximize2 className="w-3.5 h-3.5" />
                  ) : (
                    <Minimize2 className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>

            {pdfMinimized ? (
              <div className="mt-3 p-4 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 text-center text-xs text-slate-500 dark:text-slate-400">
                PDF window minimized. Say &ldquo;Hey Dop, restore this PDF window&rdquo; or click restore.
              </div>
            ) : (
              <div
                ref={pdfScrollRef}
                data-testid="pdf-viewport"
                className="mt-3 h-64 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4"
              >
                <div
                  style={{ transform: `scale(${pdfZoom / 100})`, transformOrigin: 'top left' }}
                  className="space-y-3 text-xs leading-relaxed text-slate-700 dark:text-slate-300"
                >
                  <div className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                    DOPE Architecture Specification — Page {pdfPage}
                  </div>
                  <p>
                    Try voice or text commands like &ldquo;Hey Dop, scroll down&rdquo;, &ldquo;Hey Dop,
                    zoom in&rdquo;, &ldquo;Hey Dop, go to page 15&rdquo;, &ldquo;Hey Dop, fit page to
                    width&rdquo;, or switch the dropdown above to Unsupported Scanned PDF to verify
                    honest capability checks.
                  </p>
                  <p>
                    Section {pdfPage}.1 — Separation of Reasoning and Execution: The language model
                    outputs a validated schema containing only allowlisted actions. Untrusted text inside
                    documents is never interpreted as system permission.
                  </p>
                  <p>
                    Section {pdfPage}.2 — Cross-Platform PDF Adapters: Adobe Acrobat, Microsoft Edge PDF,
                    Chrome PDF, macOS Preview, and Linux Evince expose different keyboard and UIA hooks.
                    DOPE inspects the active foreground viewer before dispatching controls.
                  </p>
                  <p>
                    Section {pdfPage}.3 — End of simulated page {pdfPage} content block for scroll
                    verification.
                  </p>
                </div>
              </div>
            )}
          </section>

          {/* Gmail Workspace Integration Card */}
          <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-blue-600" />
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Gmail Voice Integration
                </h2>
              </div>
              {hasGmailToken && (
                <button
                  type="button"
                  onClick={onFetchGmail}
                  disabled={gmailLoading}
                  className="text-xs font-medium text-blue-600 hover:underline whitespace-nowrap shrink-0"
                >
                  {gmailLoading ? 'Refreshing...' : 'Refresh Inbox'}
                </button>
              )}
            </div>

            {!hasGmailToken ? (
              <div className="mt-4 space-y-3">
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Connect your Google account with permission to let DOPE read inbox summaries by voice
                  and send emails (always requiring explicit confirmation).
                </p>
                <button
                  type="button"
                  onClick={onRequestGoogleSignIn}
                  className="px-3.5 py-2 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                >
                  Connect Gmail Account
                </button>
              </div>
            ) : gmailError ? (
              <p className="mt-3 text-xs text-rose-600 dark:text-rose-400">{gmailError}</p>
            ) : gmailMessages.length === 0 ? (
              <div className="mt-3 space-y-2">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Gmail connected. Click Refresh Inbox or say &ldquo;Hey Dop, check my unread emails.&rdquo;
                </p>
              </div>
            ) : (
              <div className="mt-3 divide-y divide-slate-200 dark:divide-slate-800">
                {gmailMessages.map((msg) => (
                  <div key={msg.id} className="py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {msg.subject}
                      </span>
                      {msg.unread && (
                        <span className="text-[11px] font-medium text-blue-600 dark:text-blue-400 shrink-0">
                          Unread
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {msg.from}
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 line-clamp-2">
                      {msg.snippet}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
