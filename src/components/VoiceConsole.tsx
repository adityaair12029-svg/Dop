import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Check,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Globe,
  Laptop,
  Mail,
  Maximize2,
  Mic,
  MicOff,
  Minimize2,
  Moon,
  Puzzle,
  RefreshCw,
  Sparkles,
  Sun,
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
import { AntigravityParticles } from './AntigravityParticles';
import { AntigravityMark } from './AntigravityMark';

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
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  userName: string;
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

const STARTER_ACTIONS = [
  {
    label: 'Open YouTube or any website',
    cmd: 'Hey El Dorado, open YouTube.',
    icon: Globe,
  },
  {
    label: 'Ask any AI or math question',
    cmd: 'Hey El Dorado, what is 25 * 48?',
    icon: Sparkles,
  },
  {
    label: 'Jump to page 15 in PDF viewer',
    cmd: 'Hey El Dorado, go to page 15.',
    icon: FileText,
  },
];

const QUICK_CHIPS = [
  'Hey El Dorado, who invented Python?',
  'Hey El Dorado, scroll down.',
  'Hey El Dorado, open YouTube.',
];

export const VoiceConsole: React.FC<VoiceConsoleProps> = ({
  theme,
  onToggleTheme,
  userName,
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
  const [composerPulse, setComposerPulse] = useState(false);
  const [downloadBusy, setDownloadBusy] = useState<'extension' | 'desktop' | null>(null);
  const [downloadNote, setDownloadNote] = useState<{
    ok: boolean;
    kind: 'extension' | 'desktop';
    text: string;
  } | null>(null);
  const [copiedExtensionsUrl, setCopiedExtensionsUrl] = useState(false);
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

  const firstName = userName.trim().split(/\s+/)[0] || 'Explorer';

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

    const accent = theme === 'dark' ? '#2F71E3' : '#2F75C3';
    const idleColor = theme === 'dark' ? 'rgba(255,255,255,0.16)' : 'rgba(10,10,12,0.14)';

    const drawBaseline = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = isListening ? accent : idleColor;
      ctx.lineWidth = 1.5;
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
      ctx.strokeStyle = accent;
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
  }, [isListening, theme]);

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
        'This browser environment does not expose microphone capture (navigator.mediaDevices). Use the command bar below or run El Dorado over HTTPS/localhost.'
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
          'Microphone wave is live, but Web SpeechRecognition is unsupported in this browser. Type commands in the bar below or run the Desktop Companion.'
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
            'Microphone permission was denied. Allow Microphone access in browser site settings and try again.'
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
          'Microphone permission denied. Open your browser site settings, set Microphone to Allow, and try again.'
        );
      } else {
        setMicPermissionError(
          `Could not start microphone (${err instanceof Error ? err.message : 'device unavailable'}). You can still enter commands below.`
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
    <div className="space-y-6 ag-animate-in">
      {/* Top El Dorado Workspace Strip */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-black/10 dark:border-white/[0.08] pb-4">
        <div className="text-xs text-[#5F6368] dark:text-neutral-400 flex items-center gap-2">
          <span className="font-medium text-[#0A0A0C] dark:text-white">Wake phrase:</span>
          <span>Hey El Dorado</span>
          <span aria-hidden="true">·</span>
          <span>Shortcut:</span>
          <kbd className="font-mono text-[11px] px-1.5 py-0.5 rounded border border-black/10 dark:border-white/15 bg-[#F7F8FA] dark:bg-[#141418] text-[#0A0A0C] dark:text-white">
            Alt+D+T
          </kbd>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <label className="flex items-center gap-2 text-xs font-medium text-[#5F6368] dark:text-neutral-400">
            <span>Language</span>
            <select
              aria-label="Assistant language"
              value={language}
              onChange={(e) => onChangeLanguage(e.target.value as 'auto' | 'en' | 'hi' | 'hinglish')}
              className="rounded-full border border-black/10 dark:border-white/15 bg-[#F7F8FA] dark:bg-[#0D0D10] px-3 py-1.5 text-xs text-[#0A0A0C] dark:text-white focus:outline-none focus:border-[#2F71E3]"
            >
              <option value="auto">Auto Detect</option>
              <option value="en">English (US)</option>
            </select>
          </label>

          <label className="flex items-center gap-2 text-xs font-medium text-[#5F6368] dark:text-neutral-400">
            <span>Target Platform</span>
            <select
              aria-label="Target execution platform"
              value={targetPlatform}
              onChange={(e) => setTargetPlatform(e.target.value as DopePlatform)}
              className="rounded-full border border-black/10 dark:border-white/15 bg-[#F7F8FA] dark:bg-[#0D0D10] px-3 py-1.5 text-xs text-[#0A0A0C] dark:text-white focus:outline-none focus:border-[#2F71E3]"
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
              className="rounded-full border border-black/10 dark:border-white/15 bg-[#F7F8FA] dark:bg-[#0D0D10] px-3 py-1.5 text-xs text-[#0A0A0C] dark:text-white"
            >
              <option value="x11">Linux X11</option>
              <option value="wayland">Linux Wayland</option>
            </select>
          )}

          <button
            type="button"
            onClick={onToggleVoiceFeedback}
            aria-label={voiceFeedbackEnabled ? 'Mute spoken responses' : 'Enable spoken responses'}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border border-black/10 dark:border-white/15 bg-[#F7F8FA] dark:bg-[#0D0D10] text-[#0A0A0C] dark:text-white hover:border-[#2F71E3] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {voiceFeedbackEnabled ? <Volume2 className="w-3.5 h-3.5 text-[#2F71E3]" /> : <VolumeX className="w-3.5 h-3.5" />}
            <span>{voiceFeedbackEnabled ? 'Speech On' : 'Speech Muted'}</span>
          </button>

          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={theme === 'dark' ? 'Switch to Default Light theme' : 'Switch to Default Dark theme'}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border border-black/10 dark:border-white/15 bg-[#F7F8FA] dark:bg-[#0D0D10] text-[#0A0A0C] dark:text-white hover:border-[#2F71E3] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {theme === 'dark' ? (
              <Sun className="w-3.5 h-3.5 text-[#FBBC05]" />
            ) : (
              <Moon className="w-3.5 h-3.5 text-[#2F75C3]" />
            )}
            <span>{theme === 'dark' ? 'Dark' : 'Light'}</span>
          </button>
        </div>
      </div>

      {/* Main 2-Column El Dorado Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 7 Cols: Particle Hero Stage + Composer + Result + History */}
        <div className="lg:col-span-7 space-y-6">
          <section className="relative overflow-hidden rounded-2xl border border-black/10 dark:border-white/[0.08] bg-white dark:bg-[#070708] px-5 sm:px-8 py-8">
            <AntigravityParticles
              theme={theme}
              active={isListening || isSubmitting}
              className="absolute inset-0 w-full h-full"
            />

            <div className="relative z-10 flex flex-col items-center">
              <div className="ag-float mb-4 text-[#0A0A0C]/20 dark:text-white/25">
                <AntigravityMark variant="monochrome" className="w-12 h-12" />
              </div>

              <h1 className="text-[26px] sm:text-[32px] font-medium tracking-[-0.025em] text-center text-[#0A0A0C] dark:text-white leading-tight text-balance">
                Good to see you, {firstName}. What&apos;s next?
              </h1>

              {/* 3 Starter Actions */}
              <div className="mt-5 w-full max-w-md space-y-1">
                {STARTER_ACTIONS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.cmd}
                      type="button"
                      onClick={() => void executeCommand(item.cmd)}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left text-[13px] font-medium text-[#5F6368] dark:text-neutral-300 hover:text-[#0A0A0C] dark:hover:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.05] transition-colors cursor-pointer"
                    >
                      <Icon className="w-4 h-4 text-[#2F75C3] dark:text-[#2F71E3] shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Sleek Rounded Composer Box */}
              <div
                className={`mt-6 w-full rounded-2xl border bg-[#F7F8FA]/95 dark:bg-[#0D0D10]/95 backdrop-blur-md p-4 shadow-sm transition-all duration-200 ${
                  composerPulse || isListening || isSubmitting
                    ? 'border-[#2F71E3] ag-composer-pulse'
                    : 'border-black/10 dark:border-white/[0.11] focus-within:border-[#2F71E3]/70'
                }`}
              >
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="text-xs font-medium text-[#5F6368] dark:text-neutral-400">
                    {isListening
                      ? wakeWordMode && !sessionActive
                        ? 'Waiting for "Hey El Dorado"...'
                        : 'Listening for command...'
                      : sessionActive
                        ? 'Follow-up active — speak or type naturally'
                        : 'Ask anything, say "Hey El Dorado", or press Alt+D+T'}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      isListening && wakeWordMode ? stopAudioCapture() : void startListening(true)
                    }
                    className={`px-3 py-1 text-[11px] font-medium rounded-full border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      isListening && wakeWordMode
                        ? 'border-[#2F71E3] bg-[#2F71E3]/15 text-[#2F75C3] dark:text-[#93C5FD]'
                        : 'border-black/10 dark:border-white/12 text-[#5F6368] dark:text-neutral-300 hover:text-[#0A0A0C] dark:hover:text-white'
                    }`}
                  >
                    {isListening && wakeWordMode ? 'Stop "Hey El Dorado"' : 'Enable "Hey El Dorado" Mode'}
                  </button>
                </div>

                {/* Voice-Wave Monitor */}
                <div className="mb-2.5">
                  <canvas
                    ref={canvasRef}
                    width={640}
                    height={36}
                    aria-label="Voice waveform monitor"
                    className="w-full h-9 block"
                  />
                  {liveTranscript && (
                    <p className="mt-1 text-xs text-[#2F75C3] dark:text-[#93C5FD] font-medium">
                      Heard: &ldquo;{liveTranscript}&rdquo;
                    </p>
                  )}
                </div>

                {micPermissionError && (
                  <div
                    role="alert"
                    className="mb-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-800 dark:text-amber-200"
                  >
                    {micPermissionError}
                  </div>
                )}

                <form onSubmit={handleFormSubmit} className="space-y-3">
                  <label htmlFor="dope-command-input" className="sr-only">
                    Type or speak an El Dorado command
                  </label>
                  <input
                    id="dope-command-input"
                    type="text"
                    value={inputText}
                    onChange={(e) => {
                      setInputText(e.target.value);
                      setComposerPulse(true);
                      window.setTimeout(() => setComposerPulse(false), 320);
                    }}
                    placeholder='Ask anything ("25 * 48", "Who invented Python?") or say "Hey El Dorado, open YouTube"'
                    className="w-full bg-transparent text-sm text-[#0A0A0C] dark:text-white placeholder:text-[#5F6368] dark:placeholder:text-neutral-500 focus:outline-none"
                  />

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-black/[0.07] dark:border-white/[0.08]">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {QUICK_CHIPS.map((phrase) => (
                        <button
                          key={phrase}
                          type="button"
                          onClick={() => void executeCommand(phrase)}
                          className="px-2.5 py-1 text-[11px] rounded-full border border-black/10 dark:border-white/10 text-[#5F6368] dark:text-neutral-400 hover:border-[#2F71E3] hover:text-[#0A0A0C] dark:hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          {phrase.replace(/^Hey El Dorado,\s*/i, '')}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-2 ml-auto">
                      <button
                        type="button"
                        onClick={() => (isListening ? stopAudioCapture() : void startListening(false))}
                        aria-label={isListening ? 'Stop microphone listening' : 'Activate voice microphone'}
                        className={`w-9 h-9 rounded-full flex items-center justify-center transition-all shrink-0 cursor-pointer ${
                          isListening
                            ? 'bg-rose-600 text-white ag-orb-active'
                            : 'bg-[#2F75C3] dark:bg-[#2F71E3] text-white hover:opacity-90'
                        }`}
                      >
                        {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                      </button>

                      <button
                        type="submit"
                        disabled={isSubmitting || !inputText.trim()}
                        aria-label="Run command"
                        className="w-9 h-9 rounded-full bg-[#0A0A0C] text-white dark:bg-white dark:text-[#070708] flex items-center justify-center hover:opacity-90 disabled:opacity-35 transition-opacity shrink-0 cursor-pointer"
                      >
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </section>

          {/* Latest Command Result & Action Schema Inspector */}
          <section className="rounded-2xl border border-black/10 dark:border-white/[0.08] bg-[#F7F8FA] dark:bg-[#0D0D10] p-6">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-base font-semibold text-[#0A0A0C] dark:text-white">
                Assistant Response &amp; Action Output
              </h2>
              {lastResult && (
                <span className="text-xs text-[#5F6368] dark:text-neutral-400 tabular-nums">
                  {lastResult.status.replace(/_/g, ' ')} ·{' '}
                  {lastResult.ai_source === 'gemini' ? 'Gemini AI' : 'Offline Fallback'}
                </span>
              )}
            </div>

            {!lastResult ? (
              <p className="mt-3 text-sm text-[#5F6368] dark:text-neutral-400">
                Issue a voice or text command above to see El Dorado&apos;s spoken response, validated action
                schema, and honest execution feedback.
              </p>
            ) : (
              <div className="mt-4 space-y-4 ag-animate-in">
                {lastResult.action.action === 'answer_question' && (
                  <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#2F75C3] dark:text-[#60A5FA]">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>El Dorado AI Answer</span>
                  </div>
                )}
                <p className="text-sm text-[#0A0A0C] dark:text-white font-medium leading-relaxed">
                  {lastResult.spoken_response}
                </p>

                {lastResult.clarification_question && (
                  <p className="text-xs text-[#2F75C3] dark:text-[#60A5FA]">
                    Clarification needed: {lastResult.clarification_question}
                  </p>
                )}

                {lastResult.unsupported_reason && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
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
                        className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-full bg-[#0A0A0C] text-white dark:bg-white dark:text-[#070708] hover:opacity-90"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Open {lastResult.action.target}</span>
                      </a>
                      <p className="text-[11px] text-[#5F6368] dark:text-neutral-400">
                        Install the El Dorado Chrome Extension (.zip) to auto-open tabs, switch tabs, scroll, and control Chrome windows directly.
                      </p>
                    </div>
                  )}

                <pre className="p-3.5 rounded-xl bg-white dark:bg-[#070708] border border-black/10 dark:border-white/[0.08] text-xs font-mono text-[#0A0A0C] dark:text-neutral-200 overflow-x-auto">
                  {JSON.stringify(lastResult.action, null, 2)}
                </pre>
              </div>
            )}
          </section>

          {/* Recent Command History */}
          <section className="rounded-2xl border border-black/10 dark:border-white/[0.08] bg-[#F7F8FA] dark:bg-[#0D0D10] p-6">
            <h2 className="text-base font-semibold text-[#0A0A0C] dark:text-white">
              Recent Command History
            </h2>
            {history.length === 0 ? (
              <p className="mt-3 text-sm text-[#5F6368] dark:text-neutral-400">
                No commands executed yet in this workspace.
              </p>
            ) : (
              <div className="mt-4 divide-y divide-black/10 dark:divide-white/[0.08]">
                {history.slice(0, 8).map((item) => (
                  <div key={item.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-[#0A0A0C] dark:text-white truncate">
                        {item.raw_input}
                      </div>
                      <div className="text-xs text-[#5F6368] dark:text-neutral-400 mt-0.5 truncate">
                        {item.spoken_response}
                      </div>
                    </div>
                    <div className="text-xs text-[#5F6368] dark:text-neutral-400 shrink-0 tabular-nums font-mono">
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
          <section className="rounded-2xl border border-black/10 dark:border-white/[0.08] bg-[#F7F8FA] dark:bg-[#0D0D10] p-5">
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-black/10 dark:border-white/[0.08]">
              <div className="flex items-center gap-2 min-w-0">
                <Puzzle className="w-4 h-4 text-[#2F75C3] dark:text-[#2F71E3] shrink-0" />
                <h2 className="text-sm font-semibold text-[#0A0A0C] dark:text-white truncate">
                  El Dorado Extension &amp; Desktop Bundle
                </h2>
              </div>
              {onOpenExtensionStudio && (
                <button
                  type="button"
                  onClick={onOpenExtensionStudio}
                  className="text-xs font-medium text-[#2F75C3] dark:text-[#60A5FA] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Customize Logo
                </button>
              )}
            </div>
            <p className="mt-3 text-xs text-[#5F6368] dark:text-neutral-400 leading-relaxed">
              Chrome &amp; Edge Extension v1.5 with floating voice orb, harmonic chimes, and AI Q&amp;A. Press{' '}
              <kbd className="font-mono px-1.5 py-0.5 rounded border border-black/10 dark:border-white/15 text-[#0A0A0C] dark:text-white">
                Alt+D+T
              </kbd>{' '}
              or say <strong className="text-[#0A0A0C] dark:text-white">&ldquo;Hey El Dorado&rdquo;</strong> on any Chrome tab or Desktop Home Screen (<code className="font-mono">python el_dorado_companion.py</code>).
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
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
                      kind: 'extension',
                      text: `Downloaded ${info.filename} (${Math.round(info.byteLength / 1024)} KB). Follow the 3 instant steps below to activate in Chrome.`,
                    });
                  } catch (err) {
                    setDownloadNote({
                      ok: false,
                      kind: 'extension',
                      text: err instanceof Error ? err.message : 'Extension download failed.',
                    });
                  } finally {
                    setDownloadBusy(null);
                  }
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-full bg-[#2F75C3] dark:bg-[#2F71E3] text-white hover:opacity-90 disabled:opacity-60 transition-opacity whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{downloadBusy === 'extension' ? 'Downloading...' : 'El Dorado Extension (.zip)'}</span>
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
                      kind: 'desktop',
                      text: `Downloaded ${info.filename} (${Math.round(info.byteLength / 1024)} KB). Extract All -> Load unpacked in chrome://extensions AND run python el_dorado_companion.py for Desktop Home Screen.`,
                    });
                  } catch (err) {
                    setDownloadNote({
                      ok: false,
                      kind: 'desktop',
                      text: err instanceof Error ? err.message : 'Desktop download failed.',
                    });
                  } finally {
                    setDownloadBusy(null);
                  }
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-full bg-[#0A0A0C] text-white dark:bg-white dark:text-[#070708] hover:opacity-90 disabled:opacity-60 transition-opacity whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Laptop className="w-3.5 h-3.5" />
                <span>{downloadBusy === 'desktop' ? 'Downloading...' : 'Laptop Desktop App (.zip)'}</span>
              </button>
              {onOpenExtensionStudio && (
                <button
                  type="button"
                  onClick={onOpenExtensionStudio}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-full border border-black/15 dark:border-white/15 text-[#0A0A0C] dark:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <span>Install Steps</span>
                </button>
              )}
            </div>
            {downloadNote && (
              <div
                role="status"
                className={`mt-3 rounded-xl border px-3.5 py-2.5 text-[11px] space-y-2 ${
                  downloadNote.ok
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                    : 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300'
                }`}
              >
                <div className="font-medium">{downloadNote.text}</div>
                {downloadNote.ok && (
                  <div className="pt-2 border-t border-emerald-500/20 space-y-1.5 text-[#0A0A0C] dark:text-neutral-200">
                    <div>1. Right-click the ZIP &rarr; <strong>Extract All</strong> into a folder.</div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span>2. Open <code className="font-mono">chrome://extensions</code> &amp; enable Developer mode:</span>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText('chrome://extensions');
                            setCopiedExtensionsUrl(true);
                            setTimeout(() => setCopiedExtensionsUrl(false), 1800);
                          } catch {
                            // Ignore clipboard restriction
                          }
                        }}
                        className="inline-flex items-center gap-1 rounded-full border border-black/15 dark:border-white/20 bg-white dark:bg-[#070708] px-2.5 py-0.5 text-[10.5px] font-medium cursor-pointer"
                      >
                        {copiedExtensionsUrl ? <Check className="w-3 h-3 text-[#2F71E3]" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedExtensionsUrl ? 'Copied chrome://extensions' : 'Copy chrome://extensions'}</span>
                      </button>
                    </div>
                    <div>
                      3. Click <strong>Load unpacked</strong> and select the extracted folder{downloadNote.kind === 'desktop' ? ' (then run python el_dorado_companion.py for desktop-wide hotkeys).' : '.'}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-black/10 dark:border-white/[0.08] bg-[#F7F8FA] dark:bg-[#0D0D10] p-5">
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-black/10 dark:border-white/[0.08]">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="w-4 h-4 text-[#2F75C3] dark:text-[#2F71E3] shrink-0" />
                <h2 className="text-sm font-semibold text-[#0A0A0C] dark:text-white truncate">
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
                className="rounded-full border border-black/10 dark:border-white/15 bg-white dark:bg-[#070708] px-2.5 py-1 text-xs text-[#0A0A0C] dark:text-white shrink-0"
              >
                <option value="browser_pdf_testbench">Compatible Viewer</option>
                <option value="unsupported_viewer">Unsupported PDF</option>
              </select>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[#5F6368] dark:text-neutral-400 tabular-nums">
              <span>
                Page {pdfPage} / 25 · Zoom {pdfZoom}% · Fit: {pdfFitMode}
                {pdfReloadCount > 0 ? ` · Reloaded ${pdfReloadCount}x` : ''}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPdfReloadCount((c) => c + 1)}
                  aria-label="Reload PDF"
                  className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setPdfMinimized((m) => !m)}
                  aria-label={pdfMinimized ? 'Restore PDF window' : 'Minimize PDF window'}
                  className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"
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
              <div className="mt-3 p-4 rounded-xl border border-dashed border-black/15 dark:border-white/15 text-center text-xs text-[#5F6368] dark:text-neutral-400">
                PDF window minimized. Say &ldquo;Hey El Dorado, restore this PDF window&rdquo; or click restore.
              </div>
            ) : (
              <div
                ref={pdfScrollRef}
                data-testid="pdf-viewport"
                className="mt-3 h-64 overflow-y-auto rounded-xl border border-black/10 dark:border-white/[0.08] bg-white dark:bg-[#070708] p-4"
              >
                <div
                  style={{ transform: `scale(${pdfZoom / 100})`, transformOrigin: 'top left' }}
                  className="space-y-3 text-xs leading-relaxed text-[#5F6368] dark:text-neutral-300"
                >
                  <div className="font-semibold text-sm text-[#0A0A0C] dark:text-white">
                    El Dorado Architecture Specification — Page {pdfPage}
                  </div>
                  <p>
                    Try voice or text commands like &ldquo;Hey El Dorado, scroll down&rdquo;, &ldquo;Hey El Dorado,
                    zoom in&rdquo;, &ldquo;Hey El Dorado, go to page 15&rdquo;, &ldquo;Hey El Dorado, fit page to
                    width&rdquo;, or switch the dropdown above to Unsupported PDF to verify honest capability checks.
                  </p>
                  <p>
                    Section {pdfPage}.1 — Separation of Reasoning and Execution: The language model
                    outputs a validated schema containing only allowlisted actions. Untrusted text inside
                    documents is never interpreted as system permission.
                  </p>
                  <p>
                    Section {pdfPage}.2 — Cross-Platform PDF Adapters: Adobe Acrobat, Microsoft Edge PDF,
                    Chrome PDF, macOS Preview, and Linux Evince expose different keyboard and UIA hooks.
                    El Dorado inspects the active foreground viewer before dispatching controls.
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
          <section className="rounded-2xl border border-black/10 dark:border-white/[0.08] bg-[#F7F8FA] dark:bg-[#0D0D10] p-5">
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-black/10 dark:border-white/[0.08]">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-[#2F75C3] dark:text-[#2F71E3]" />
                <h2 className="text-sm font-semibold text-[#0A0A0C] dark:text-white">
                  Gmail Voice Integration
                </h2>
              </div>
              {hasGmailToken && (
                <button
                  type="button"
                  onClick={onFetchGmail}
                  disabled={gmailLoading}
                  className="text-xs font-medium text-[#2F75C3] dark:text-[#60A5FA] hover:underline whitespace-nowrap shrink-0"
                >
                  {gmailLoading ? 'Refreshing...' : 'Refresh Inbox'}
                </button>
              )}
            </div>

            {!hasGmailToken ? (
              <div className="mt-4 space-y-3">
                <p className="text-xs text-[#5F6368] dark:text-neutral-400">
                  Connect your Google account with permission to let El Dorado read inbox summaries by voice
                  and send emails (always requiring explicit confirmation).
                </p>
                <button
                  type="button"
                  onClick={onRequestGoogleSignIn}
                  className="px-4 py-2 text-xs font-medium rounded-full bg-[#2F75C3] dark:bg-[#2F71E3] text-white hover:opacity-90 transition-opacity cursor-pointer"
                >
                  Connect Gmail Account
                </button>
              </div>
            ) : gmailError ? (
              <p className="mt-3 text-xs text-rose-500">{gmailError}</p>
            ) : gmailMessages.length === 0 ? (
              <div className="mt-3 space-y-2">
                <p className="text-xs text-[#5F6368] dark:text-neutral-400">
                  Gmail connected. Click Refresh Inbox or say &ldquo;Hey El Dorado, check my unread emails.&rdquo;
                </p>
              </div>
            ) : (
              <div className="mt-3 divide-y divide-black/10 dark:divide-white/[0.08]">
                {gmailMessages.map((msg) => (
                  <div key={msg.id} className="py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-[#0A0A0C] dark:text-white truncate">
                        {msg.subject}
                      </span>
                      {msg.unread && (
                        <span className="text-[11px] font-medium text-[#2F75C3] dark:text-[#60A5FA] shrink-0">
                          Unread
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-[#5F6368] dark:text-neutral-400 truncate mt-0.5">
                      {msg.from}
                    </div>
                    <p className="text-xs text-[#5F6368] dark:text-neutral-300 mt-1 line-clamp-2">
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
