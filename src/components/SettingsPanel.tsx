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
    <div className="space-y-8">
      <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Settings, Privacy &amp; Diagnostics
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
          Configure appearance, wake-word processing, language preferences, data retention, and system checks.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Theme & Language */}
        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Appearance &amp; Voice Preferences
          </h2>

          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-medium text-slate-900 dark:text-slate-100">Theme</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Switch between light and dark workspace surfaces.
              </div>
            </div>
            <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => void onUpdateSettings({ theme: 'light' })}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md ${
                  settings.theme === 'light'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                <Sun className="w-3.5 h-3.5" />
                <span>Light</span>
              </button>
              <button
                type="button"
                onClick={() => void onUpdateSettings({ theme: 'dark' })}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md ${
                  settings.theme === 'dark'
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                <Moon className="w-3.5 h-3.5" />
                <span>Dark</span>
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                Wake-Word Engine
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
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
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100"
            >
              <option value="openwakeword">openWakeWord (Local Apache-2.0)</option>
              <option value="porcupine">Porcupine (Commercial License)</option>
              <option value="web_speech">Browser Web Speech (Tab-Active Only)</option>
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between text-sm font-medium text-slate-900 dark:text-slate-100">
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
              className="w-full mt-2 accent-blue-600"
            />
          </div>
        </section>

        {/* Privacy & Data Retention */}
        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-blue-600" />
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Permissions, Privacy &amp; Data Retention
            </h2>
          </div>

          <label className="flex items-center justify-between gap-4 cursor-pointer">
            <div>
              <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                Save Command History Locally
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Logs are redacted automatically; disable to avoid storing transcripts.
              </div>
            </div>
            <input
              type="checkbox"
              checked={settings.store_history}
              onChange={(e) => void onUpdateSettings({ store_history: e.target.checked })}
              className="w-4 h-4 accent-blue-600"
            />
          </label>

          <label className="flex items-center justify-between gap-4 cursor-pointer">
            <div>
              <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                Require Explicit Remote Device Approval
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Newly paired devices start unapproved for remote execution until verified.
              </div>
            </div>
            <input
              type="checkbox"
              checked={settings.remote_execution_requires_approval}
              onChange={(e) =>
                void onUpdateSettings({ remote_execution_requires_approval: e.target.checked })
              }
              className="w-4 h-4 accent-blue-600"
            />
          </label>

          <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Delete all saved voice command transcripts from the server store.
            </div>
            <button
              type="button"
              onClick={() => void onClearHistory()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 whitespace-nowrap shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear History</span>
            </button>
          </div>
        </section>

        {/* Troubleshooting & Diagnostics */}
        <section className="lg:col-span-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
            <Wrench className="w-4 h-4 text-blue-600" />
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              System Readiness &amp; Troubleshooting Checks
            </h2>
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800">
              <div className="text-slate-500 dark:text-slate-400">Server Gemini AI</div>
              <div className="mt-1 font-semibold text-slate-900 dark:text-slate-100">
                {healthInfo?.gemini_configured
                  ? 'Configured (Server-side)'
                  : 'Offline Fallback Active'}
              </div>
            </div>
            <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800">
              <div className="text-slate-500 dark:text-slate-400">Browser Microphone API</div>
              <div className="mt-1 font-semibold text-slate-900 dark:text-slate-100">
                {micSupported ? 'Available' : 'Unavailable (Requires HTTPS)'}
              </div>
            </div>
            <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800">
              <div className="text-slate-500 dark:text-slate-400">Web Speech Recognition</div>
              <div className="mt-1 font-semibold text-slate-900 dark:text-slate-100">
                {speechSupported ? 'Supported in this browser' : 'Use Text Bar or Desktop Companion'}
              </div>
            </div>
            <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800">
              <div className="text-slate-500 dark:text-slate-400">Gmail OAuth Session</div>
              <div className="mt-1 font-semibold text-slate-900 dark:text-slate-100">
                {hasGmailToken ? 'Authorized in memory' : 'Not signed in'}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
