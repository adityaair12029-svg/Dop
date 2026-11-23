import React from 'react';
import { Moon, Shield, Sun, Trash2, Wrench } from 'lucide-react';

export interface AssistantSettingsState {
  theme: 'light' | 'dark';
  language: 'auto' | 'en' | 'hi' | 'hinglish';
  wake_word_enabled: boolean;
  wake_word_engine: 'openwakeword' | 'porcupine' | 'web_speech';
  wake_word_sensitivity: number;
  voice_feedback_enabled: boolean;
  store_history: boolean;
  remote_execution_requires_approval: boolean;
}

interface SettingsPanelProps {
  settings: AssistantSettingsState;
  healthInfo: {
    gemini_configured: boolean;
    connected_devices: number;
    catalog_count: number;
  } | null;
  hasGmailToken: boolean;
  onUpdateSettings: (patch: Partial<AssistantSettingsState>) => Promise<void>;
  onClearHistory: () => Promise<void>;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  settings,
  healthInfo,
  hasGmailToken,
  onUpdateSettings,
  onClearHistory,
}) => {
  const micSupported = typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);
  const speechSupported =
    typeof window !== 'undefined' &&
    Boolean(
      (window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown })
        .SpeechRecognition ||
        (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition
    );

  return (
    <div className="space-y-8 ag-animate-in">
      <div className="border-b border-black/10 dark:border-white/[0.08] pb-4">
        <h1 className="text-2xl font-semibold tracking-tight text-[#0A0A0C] dark:text-white">
          Settings, Theme &amp; Diagnostics
        </h1>
        <p className="text-sm text-[#5F6368] dark:text-neutral-400 mt-0.5">
          Antigravity Default Light &amp; Default Dark palettes, wake-word preferences, and system checks.
        </p>
      </div>

      {/* Antigravity Color Presets Matching Screenshot 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="rounded-2xl border border-black/10 dark:border-white/[0.08] bg-[#F7F8FA] dark:bg-[#0D0D10] p-6 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-base font-semibold text-[#0A0A0C] dark:text-white">
              Light Theme
            </h2>
            <button
              type="button"
              onClick={() => void onUpdateSettings({ theme: 'light' })}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-full transition-colors cursor-pointer ${
                settings.theme === 'light'
                  ? 'bg-[#0A0A0C] text-white'
                  : 'border border-black/15 dark:border-white/15 text-[#5F6368] dark:text-neutral-300 hover:text-[#0A0A0C] dark:hover:text-white'
              }`}
            >
              <Sun className="w-3.5 h-3.5" />
              <span>{settings.theme === 'light' ? 'Default Light (Active)' : 'Use Default Light'}</span>
            </button>
          </div>
          <div className="rounded-xl border border-black/10 dark:border-white/[0.08] bg-white dark:bg-[#070708] divide-y divide-black/10 dark:divide-white/[0.08] text-xs">
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-[#5F6368] dark:text-neutral-300">Background</span>
              <span className="inline-flex items-center gap-2 font-mono text-[#0A0A0C] dark:text-white">
                <span className="w-3.5 h-3.5 rounded bg-[#FFFFFF] border border-black/20" />
                #FFFFFF
              </span>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-[#5F6368] dark:text-neutral-300">Foreground</span>
              <span className="inline-flex items-center gap-2 font-mono text-[#0A0A0C] dark:text-white">
                <span className="w-3.5 h-3.5 rounded bg-[#0A0A0C] border border-white/20" />
                #0A0A0C
              </span>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-[#5F6368] dark:text-neutral-300">Accent</span>
              <span className="inline-flex items-center gap-2 font-mono text-[#0A0A0C] dark:text-white">
                <span className="w-3.5 h-3.5 rounded bg-[#2F75C3]" />
                #2F75C3
              </span>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-black/10 dark:border-white/[0.08] bg-[#F7F8FA] dark:bg-[#0D0D10] p-6 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-base font-semibold text-[#0A0A0C] dark:text-white">
              Dark Theme
            </h2>
            <button
              type="button"
              onClick={() => void onUpdateSettings({ theme: 'dark' })}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-full transition-colors cursor-pointer ${
                settings.theme === 'dark'
                  ? 'bg-white text-[#070708]'
                  : 'border border-black/15 dark:border-white/15 text-[#5F6368] dark:text-neutral-300 hover:text-[#0A0A0C] dark:hover:text-white'
              }`}
            >
              <Moon className="w-3.5 h-3.5" />
              <span>{settings.theme === 'dark' ? 'Default Dark (Active)' : 'Use Default Dark'}</span>
            </button>
          </div>
          <div className="rounded-xl border border-black/10 dark:border-white/[0.08] bg-white dark:bg-[#070708] divide-y divide-black/10 dark:divide-white/[0.08] text-xs">
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-[#5F6368] dark:text-neutral-300">Background</span>
              <span className="inline-flex items-center gap-2 font-mono text-[#0A0A0C] dark:text-white">
                <span className="w-3.5 h-3.5 rounded bg-[#070708] border border-white/20" />
                #070708
              </span>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-[#5F6368] dark:text-neutral-300">Foreground</span>
              <span className="inline-flex items-center gap-2 font-mono text-[#0A0A0C] dark:text-white">
                <span className="w-3.5 h-3.5 rounded bg-[#FFFFFF] border border-black/20" />
                #FFFFFF
              </span>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-[#5F6368] dark:text-neutral-300">Accent</span>
              <span className="inline-flex items-center gap-2 font-mono text-[#0A0A0C] dark:text-white">
                <span className="w-3.5 h-3.5 rounded bg-[#2F71E3]" />
                #2F71E3
              </span>
            </div>
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Wake Word Preferences */}
        <section className="rounded-2xl border border-black/10 dark:border-white/[0.08] bg-[#F7F8FA] dark:bg-[#0D0D10] p-6 space-y-5">
          <h2 className="text-base font-semibold text-[#0A0A0C] dark:text-white">
            Voice &amp; Wake-Word Preferences
          </h2>

          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-medium text-[#0A0A0C] dark:text-white">
                Wake-Word Engine
              </div>
              <div className="text-xs text-[#5F6368] dark:text-neutral-400">
                Desktop companion uses openWakeWord (Apache 2.0) locally before cloud speech.
              </div>
            </div>
            <select
              aria-label="Wake-word engine"
              value={settings.wake_word_engine}
              onChange={(e) =>
                void onUpdateSettings({
                  wake_word_engine: e.target.value as AssistantSettingsState['wake_word_engine'],
                })
              }
              className="rounded-full border border-black/10 dark:border-white/15 bg-white dark:bg-[#070708] px-3 py-1.5 text-xs text-[#0A0A0C] dark:text-white"
            >
              <option value="openwakeword">openWakeWord (Local Apache-2.0)</option>
              <option value="porcupine">Porcupine (Commercial License)</option>
              <option value="web_speech">Browser Web Speech (Tab-Active Only)</option>
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between text-sm font-medium text-[#0A0A0C] dark:text-white">
              <label htmlFor="wake-sensitivity">Wake-Word Detection Sensitivity</label>
              <span className="font-mono text-xs tabular-nums">
                {Math.round(settings.wake_word_sensitivity * 100)}%
              </span>
            </div>
            <input
              id="wake-sensitivity"
              type="range"
              min={0.2}
              max={0.95}
              step={0.05}
              value={settings.wake_word_sensitivity}
              onChange={(e) =>
                void onUpdateSettings({ wake_word_sensitivity: Number(e.target.value) })
              }
              className="w-full mt-2 accent-[#2F71E3]"
            />
          </div>
        </section>

        {/* Privacy & Data Retention */}
        <section className="rounded-2xl border border-black/10 dark:border-white/[0.08] bg-[#F7F8FA] dark:bg-[#0D0D10] p-6 space-y-5">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#2F75C3] dark:text-[#2F71E3]" />
            <h2 className="text-base font-semibold text-[#0A0A0C] dark:text-white">
              Permissions, Privacy &amp; Data Retention
            </h2>
          </div>

          <label className="flex items-center justify-between gap-4 cursor-pointer">
            <div>
              <div className="text-sm font-medium text-[#0A0A0C] dark:text-white">
                Save Command History Locally
              </div>
              <div className="text-xs text-[#5F6368] dark:text-neutral-400">
                Logs are redacted automatically; disable to avoid storing transcripts.
              </div>
            </div>
            <input
              type="checkbox"
              checked={settings.store_history}
              onChange={(e) => void onUpdateSettings({ store_history: e.target.checked })}
              className="w-4 h-4 accent-[#2F71E3]"
            />
          </label>

          <label className="flex items-center justify-between gap-4 cursor-pointer">
            <div>
              <div className="text-sm font-medium text-[#0A0A0C] dark:text-white">
                Require Explicit Remote Device Approval
              </div>
              <div className="text-xs text-[#5F6368] dark:text-neutral-400">
                Newly paired devices start unapproved for remote execution until verified.
              </div>
            </div>
            <input
              type="checkbox"
              checked={settings.remote_execution_requires_approval}
              onChange={(e) =>
                void onUpdateSettings({ remote_execution_requires_approval: e.target.checked })
              }
              className="w-4 h-4 accent-[#2F71E3]"
            />
          </label>

          <div className="pt-2 border-t border-black/10 dark:border-white/[0.08] flex items-center justify-between gap-4">
            <div className="text-xs text-[#5F6368] dark:text-neutral-400">
              Delete all saved voice command transcripts from the server store.
            </div>
            <button
              type="button"
              onClick={() => void onClearHistory()}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-full border border-rose-500/40 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear History</span>
            </button>
          </div>
        </section>

        {/* Troubleshooting & Diagnostics */}
        <section className="lg:col-span-2 rounded-2xl border border-black/10 dark:border-white/[0.08] bg-[#F7F8FA] dark:bg-[#0D0D10] p-6">
          <div className="flex items-center gap-2 pb-3 border-b border-black/10 dark:border-white/[0.08]">
            <Wrench className="w-4 h-4 text-[#2F75C3] dark:text-[#2F71E3]" />
            <h2 className="text-base font-semibold text-[#0A0A0C] dark:text-white">
              System Readiness &amp; Troubleshooting Checks
            </h2>
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div className="p-3.5 rounded-xl border border-black/10 dark:border-white/[0.08] bg-white dark:bg-[#070708]">
              <div className="text-[#5F6368] dark:text-neutral-400">Server Gemini AI</div>
              <div className="mt-1 font-semibold text-[#0A0A0C] dark:text-white">
                {healthInfo?.gemini_configured
                  ? 'Configured (Server-side)'
                  : 'Offline Fallback Active'}
              </div>
            </div>
            <div className="p-3.5 rounded-xl border border-black/10 dark:border-white/[0.08] bg-white dark:bg-[#070708]">
              <div className="text-[#5F6368] dark:text-neutral-400">Browser Microphone API</div>
              <div className="mt-1 font-semibold text-[#0A0A0C] dark:text-white">
                {micSupported ? 'Available' : 'Unavailable (Requires HTTPS)'}
              </div>
            </div>
            <div className="p-3.5 rounded-xl border border-black/10 dark:border-white/[0.08] bg-white dark:bg-[#070708]">
              <div className="text-[#5F6368] dark:text-neutral-400">Web Speech Recognition</div>
              <div className="mt-1 font-semibold text-[#0A0A0C] dark:text-white">
                {speechSupported ? 'Supported in this browser' : 'Use Text Bar or Desktop Companion'}
              </div>
            </div>
            <div className="p-3.5 rounded-xl border border-black/10 dark:border-white/[0.08] bg-white dark:bg-[#070708]">
              <div className="text-[#5F6368] dark:text-neutral-400">Gmail OAuth Session</div>
              <div className="mt-1 font-semibold text-[#0A0A0C] dark:text-white">
                {hasGmailToken ? 'Authorized in memory' : 'Not connected'}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
