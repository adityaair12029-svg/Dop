import type { ActionName, CustomAlias, DopeAction, DopePlatform } from '../shared/actions';
import { validateDopeAction } from '../shared/actions';
import { detectWakeWord, parseOfflineCommand } from '../shared/wakeword';
import type { AssistantSettingsState } from '../components/SettingsPanel';
import type { DeviceRecord, PendingPairingRecord } from '../components/DeviceManager';
import type { HistoryRecord } from '../components/VoiceConsole';

// Bundled ?raw platform source files so PlatformStudio + emergency JSZip builder work 100% on static Vercel
import extManifestRaw from '../../platforms/browser-extension/manifest.json?raw';
import extBgRaw from '../../platforms/browser-extension/background.js?raw';
import extHotkeyRaw from '../../platforms/browser-extension/hotkey_content.js?raw';
import extPopupRaw from '../../platforms/browser-extension/popup.html?raw';
import extSidepanelRaw from '../../platforms/browser-extension/sidepanel.html?raw';
import extUiCssRaw from '../../platforms/browser-extension/ui.css?raw';
import extUiJsRaw from '../../platforms/browser-extension/ui.js?raw';
import extNativeRaw from '../../platforms/browser-extension/native_messaging_host.json?raw';

import deskCompanionRaw from '../../platforms/desktop-companion/el_dorado_companion.py?raw';
import deskWakeRaw from '../../platforms/desktop-companion/wake_word_engine.py?raw';
import deskReqRaw from '../../platforms/desktop-companion/requirements.txt?raw';
import deskWinRaw from '../../platforms/desktop-companion/adapters/windows_adapter.py?raw';
import deskMacRaw from '../../platforms/desktop-companion/adapters/macos_adapter.py?raw';
import deskLinuxRaw from '../../platforms/desktop-companion/adapters/linux_adapter.py?raw';
import deskPdfRaw from '../../platforms/desktop-companion/adapters/pdf_adapter.py?raw';

const STORAGE_KEY = 'el_dorado_local_state_v1';

interface LocalWorkspaceState {
  history: HistoryRecord[];
  aliases: CustomAlias[];
  devices: DeviceRecord[];
  pending_pairings: PendingPairingRecord[];
  settings: AssistantSettingsState;
}

const DEFAULT_LOCAL_STATE: LocalWorkspaceState = {
  history: [],
  aliases: [
    {
      id: 'alias-study',
      phrase: 'study mode',
      action: 'open_url',
      target: 'https://www.wikipedia.org',
      created_at: new Date().toISOString(),
    },
    {
      id: 'alias-watch',
      phrase: 'video time',
      action: 'open_url',
      target: 'https://www.youtube.com',
      created_at: new Date().toISOString(),
    },
  ],
  devices: [
    {
      id: 'dev-web-console',
      name: 'This Browser Session',
      platform: 'web',
      os_version: 'Web Speech & PDF Testbench',
      status: 'connected',
      remote_control_approved: true,
      paired_at: new Date().toISOString(),
      last_seen: new Date().toISOString(),
      capabilities: ['open_url', 'web_search', 'pdf_testbench', 'gmail_oauth'],
    },
  ],
  pending_pairings: [],
  settings: {
    theme: 'dark',
    language: 'auto',
    wake_word_enabled: false,
    wake_word_engine: 'openwakeword',
    wake_word_sensitivity: 0.65,
    voice_feedback_enabled: true,
    store_history: true,
    remote_execution_requires_approval: true,
  },
};

export function loadLocalState(): LocalWorkspaceState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_LOCAL_STATE);
    const parsed = JSON.parse(raw) as Partial<LocalWorkspaceState>;
    return {
      history: Array.isArray(parsed.history) ? parsed.history : [],
      aliases: Array.isArray(parsed.aliases) ? parsed.aliases : structuredClone(DEFAULT_LOCAL_STATE.aliases),
      devices: Array.isArray(parsed.devices) ? parsed.devices : structuredClone(DEFAULT_LOCAL_STATE.devices),
      pending_pairings: Array.isArray(parsed.pending_pairings) ? parsed.pending_pairings : [],
      settings: { ...DEFAULT_LOCAL_STATE.settings, ...(parsed.settings ?? {}) },
    };
  } catch {
    return structuredClone(DEFAULT_LOCAL_STATE);
  }
}

function saveLocalState(state: LocalWorkspaceState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore localStorage quota restrictions
  }
}

export function isJsonResponse(res: Response): boolean {
  const ct = res.headers.get('content-type') || '';
  return res.ok && ct.toLowerCase().includes('application/json');
}

export const BUNDLED_PLATFORM_FILES: Array<{ platform: string; path: string; content: string }> = [
  { platform: 'browser-extension', path: 'platforms/browser-extension/manifest.json', content: extManifestRaw },
  { platform: 'browser-extension', path: 'platforms/browser-extension/background.js', content: extBgRaw },
  { platform: 'browser-extension', path: 'platforms/browser-extension/hotkey_content.js', content: extHotkeyRaw },
  { platform: 'browser-extension', path: 'platforms/browser-extension/popup.html', content: extPopupRaw },
  { platform: 'browser-extension', path: 'platforms/browser-extension/sidepanel.html', content: extSidepanelRaw },
  { platform: 'browser-extension', path: 'platforms/browser-extension/ui.css', content: extUiCssRaw },
  { platform: 'browser-extension', path: 'platforms/browser-extension/ui.js', content: extUiJsRaw },
  { platform: 'browser-extension', path: 'platforms/browser-extension/native_messaging_host.json', content: extNativeRaw },
  { platform: 'desktop-companion', path: 'platforms/desktop-companion/el_dorado_companion.py', content: deskCompanionRaw },
  { platform: 'desktop-companion', path: 'platforms/desktop-companion/wake_word_engine.py', content: deskWakeRaw },
  { platform: 'desktop-companion', path: 'platforms/desktop-companion/requirements.txt', content: deskReqRaw },
  { platform: 'desktop-companion', path: 'platforms/desktop-companion/adapters/windows_adapter.py', content: deskWinRaw },
  { platform: 'desktop-companion', path: 'platforms/desktop-companion/adapters/macos_adapter.py', content: deskMacRaw },
  { platform: 'desktop-companion', path: 'platforms/desktop-companion/adapters/linux_adapter.py', content: deskLinuxRaw },
  { platform: 'desktop-companion', path: 'platforms/desktop-companion/adapters/pdf_adapter.py', content: deskPdfRaw },
];

export const BUNDLED_DOCS = [
  {
    name: '01_QUICK_START.md',
    title: '01 QUICK START — El Dorado Setup Guide',
    content: `# El Dorado — Quick Start Guide

## 1. Install Chrome / Edge Extension (30 Seconds)
1. Click **El Dorado Extension (.zip)** to download \`El-Dorado-Chrome-Extension.zip\`.
2. Right-click the downloaded ZIP file and choose **Extract All...**.
3. Open Chrome and navigate to \`chrome://extensions\`.
4. Turn ON **Developer mode** in the top-right corner.
5. Click **Load unpacked** and select the extracted folder containing \`manifest.json\`.
6. Press **Alt + D + T** (or **Alt + D**) on any browser tab, or say **"Hey El Dorado"**!

## 2. Whole-Laptop Desktop Control (Optional)
1. Download **Laptop Desktop App (.zip)** (\`El-Dorado-Desktop-Assistant.zip\`).
2. Extract the ZIP into a folder.
3. Open Terminal or Command Prompt inside that folder and run:
   \`python el_dorado_companion.py\`
4. Press **Alt + D + T** anywhere on your Windows Home Screen, File Explorer, or desktop apps!`,
  },
  {
    name: '02_VOICE_COMMANDS.md',
    title: '02 VOICE COMMANDS — Wake Phrase & Actions',
    content: `# Voice Commands & AI Assistant

Use the wake phrase **"Hey El Dorado"** or press **Alt + D + T**:

- **AI Questions**: "Hey El Dorado, what is 25 * 48?", "Hey El Dorado, who invented Python?"
- **Websites & Search**: "Hey El Dorado, open YouTube.", "Hey El Dorado, search for quantum computing."
- **Chrome Tabs**: "Hey El Dorado, new tab.", "Hey El Dorado, mute tab.", "Hey El Dorado, next tab."
- **PDF Navigation**: "Hey El Dorado, go to page 15.", "Hey El Dorado, scroll down.", "Hey El Dorado, zoom in."
- **Window Controls**: "Hey El Dorado, minimize window.", "Hey El Dorado, maximize window."`,
  },
];

async function lookupWikipediaSummary(questionText: string): Promise<string | null> {
  const topic = questionText
    .replace(/^(?:what is|who is|who was|who invented|who created|tell me about|explain|define|what are|how does)\s+(?:a |an |the )?/i, '')
    .replace(/[?!.]+$/g, '')
    .trim();
  if (!topic || topic.length < 2 || topic.length > 80) return null;

  try {
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(topic)}&limit=1&namespace=0&format=json&origin=*`;
    const sRes = await fetch(searchUrl, { signal: AbortSignal.timeout(4500) });
    if (!sRes.ok) return null;
    const sData = (await sRes.json()) as [string, string[]];
    const title = sData?.[1]?.[0];
    if (!title) return null;

    const sumRes = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`,
      { signal: AbortSignal.timeout(4500) }
    );
    if (!sumRes.ok) return null;
    const sumData = (await sumRes.json()) as { extract?: string };
    if (!sumData.extract) return null;
    return sumData.extract.split(/(?<=[.!?])\s+/).slice(0, 2).join(' ');
  } catch {
    return null;
  }
}

export async function runLocalCommandFallback(params: {
  text: string;
  language: string;
  context: {
    platform: DopePlatform;
    pdf_viewer_type: 'browser_pdf_testbench' | 'unsupported_viewer';
    linux_display_server?: 'x11' | 'wayland';
  };
}) {
  const state = loadLocalState();
  const wake = detectWakeWord(params.text);
  const fullContext = {
    platform: params.context.platform,
    companion_connected: state.devices.some(
      (d) =>
        d.status === 'connected' &&
        (d.platform === 'windows' || d.platform === 'macos' || d.platform === 'linux')
    ),
    extension_connected: state.devices.some(
      (d) => d.status === 'connected' && d.platform === 'browser_extension'
    ),
    active_app: 'El Dorado Web Console',
    active_window_title: 'El Dorado PDF & Document Testbench',
    pdf_viewer_type: params.context.pdf_viewer_type,
    linux_display_server: params.context.linux_display_server,
  };

  const parsed = parseOfflineCommand(params.text, fullContext, state.aliases);
  let resultAction: DopeAction = parsed.action ?? {
    action: 'answer_question',
    platform: params.context.platform,
    requires_confirmation: false,
  };
  let spokenResponse = parsed.spoken_response;
  let supported = parsed.supported;
  let ambiguous = Boolean(parsed.ambiguous);
  let clarificationQuestion = parsed.clarification_question;

  if (!parsed.matched && !parsed.ambiguous) {
    const effective = wake.detected ? wake.command_text : params.text;
    const wikiAnswer = await lookupWikipediaSummary(effective);
    if (wikiAnswer) {
      resultAction = {
        action: 'answer_question',
        platform: params.context.platform,
        requires_confirmation: false,
        parameters: { query: effective },
      };
      spokenResponse = wikiAnswer;
      supported = true;
      ambiguous = false;
    } else {
      resultAction = {
        action: 'web_search',
        target: `https://www.google.com/search?q=${encodeURIComponent(effective)}`,
        platform: params.context.platform,
        requires_confirmation: false,
        parameters: { query: effective },
      };
      spokenResponse = `Opened web search for "${effective}". Connect a server backend with GEMINI_API_KEY for full conversational AI replies.`;
      supported = true;
      ambiguous = false;
    }
  }

  const status = !supported
    ? 'unsupported'
    : ambiguous
      ? 'clarification'
      : resultAction.requires_confirmation
        ? 'awaiting_confirmation'
        : 'executed';

  const id = `cmd-${Math.random().toString(36).slice(2, 10)}`;
  if (state.settings.store_history) {
    state.history.unshift({
      id,
      timestamp: new Date().toISOString(),
      raw_input: params.text.trim(),
      wake_word_detected: wake.detected,
      language_hint: params.language,
      action: resultAction,
      spoken_response: spokenResponse,
      status,
      ai_source: 'offline_fallback',
    });
    state.history = state.history.slice(0, 80);
    saveLocalState(state);
  }

  return {
    id,
    status,
    action: resultAction,
    spoken_response: spokenResponse,
    ambiguous,
    clarification_question: clarificationQuestion,
    supported,
    unsupported_reason: parsed.unsupported_reason,
    ai_source: 'offline_fallback' as const,
  };
}

export function localConfirmDecision(entryId: string, decision: 'confirm' | 'cancel', action?: DopeAction) {
  const state = loadLocalState();
  const entry = state.history.find((h) => h.id === entryId);
  if (decision === 'cancel') {
    if (entry) entry.status = 'cancelled';
    saveLocalState(state);
    return { status: 'cancelled', spoken_response: 'Action cancelled. Nothing was changed.' };
  }
  const msg = action ? `Confirmed "${action.action}" on ${action.platform}.` : 'Action confirmed.';
  if (entry) entry.status = 'executed';
  saveLocalState(state);
  return { status: 'executed', spoken_response: msg };
}

export function localUpdateSettings(patch: Partial<AssistantSettingsState>): AssistantSettingsState {
  const state = loadLocalState();
  state.settings = { ...state.settings, ...patch };
  saveLocalState(state);
  return state.settings;
}

export function localClearHistory(): void {
  const state = loadLocalState();
  state.history = [];
  saveLocalState(state);
}

export function localCreateAlias(alias: { phrase: string; action: ActionName; target?: string }): CustomAlias {
  const state = loadLocalState();
  const created: CustomAlias = {
    id: `alias-${Math.random().toString(36).slice(2, 10)}`,
    phrase: alias.phrase,
    action: alias.action,
    target: alias.target,
    created_at: new Date().toISOString(),
  };
  state.aliases.unshift(created);
  saveLocalState(state);
  return created;
}

export function localDeleteAlias(id: string): void {
  const state = loadLocalState();
  state.aliases = state.aliases.filter((a) => a.id !== id);
  saveLocalState(state);
}

export function localInitPairing(device_name: string, platform: DopePlatform): PendingPairingRecord {
  const state = loadLocalState();
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const pending: PendingPairingRecord = {
    code,
    device_name,
    platform,
    created_at: Date.now(),
    expires_at: Date.now() + 5 * 60 * 1000,
  };
  state.pending_pairings.push(pending);
  saveLocalState(state);
  return pending;
}

export function localCompletePairing(code: string): void {
  const state = loadLocalState();
  const idx = state.pending_pairings.findIndex((p) => p.code === code.trim());
  if (idx === -1) return;
  const pending = state.pending_pairings.splice(idx, 1)[0];
  state.devices.push({
    id: `dev-${Math.random().toString(36).slice(2, 10)}`,
    name: pending.device_name,
    platform: pending.platform,
    os_version: `${pending.platform} companion`,
    status: 'connected',
    remote_control_approved: !state.settings.remote_execution_requires_approval,
    paired_at: new Date().toISOString(),
    last_seen: new Date().toISOString(),
    capabilities: ['open_url', 'web_search', 'window_controls'],
  });
  saveLocalState(state);
}

export function localToggleApproval(id: string, approved: boolean): void {
  const state = loadLocalState();
  const dev = state.devices.find((d) => d.id === id);
  if (dev) {
    dev.remote_control_approved = approved;
    saveLocalState(state);
  }
}

export function localRevokeDevice(id: string): void {
  if (id === 'dev-web-console') return;
  const state = loadLocalState();
  state.devices = state.devices.filter((d) => d.id !== id);
  saveLocalState(state);
}

export function validateActionTarget(action: ActionName, target?: string): { valid: boolean; reason?: string } {
  return validateDopeAction(
    { action, target, platform: 'windows', requires_confirmation: false },
    {
      platform: 'windows',
      companion_connected: true,
      extension_connected: true,
      active_app: 'Alias Builder',
      active_window_title: 'Alias Builder',
    }
  );
}
