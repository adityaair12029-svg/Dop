import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { CustomAlias, DopeAction, DopePlatform } from '../src/shared/actions';

export interface CommandHistoryItem {
  id: string;
  timestamp: string;
  raw_input: string;
  wake_word_detected: boolean;
  language_hint: string;
  action: DopeAction;
  spoken_response: string;
  status: 'executed' | 'awaiting_confirmation' | 'cancelled' | 'unsupported' | 'clarification' | 'error';
  ai_source: 'gemini' | 'offline_fallback';
  error_detail?: string;
}

export interface PairedDevice {
  id: string;
  name: string;
  platform: DopePlatform;
  os_version: string;
  status: 'connected' | 'disconnected';
  remote_control_approved: boolean;
  paired_at: string;
  last_seen: string;
  capabilities: string[];
}

export interface PendingPairing {
  code: string;
  device_name: string;
  platform: DopePlatform;
  created_at: number;
  expires_at: number;
}

export interface AssistantSettings {
  theme: 'light' | 'dark';
  language: 'auto' | 'en' | 'hi' | 'hinglish';
  wake_word_enabled: boolean;
  wake_word_engine: 'openwakeword' | 'porcupine' | 'web_speech';
  wake_word_sensitivity: number;
  voice_feedback_enabled: boolean;
  store_history: boolean;
  remote_execution_requires_approval: boolean;
}

export interface DopeStoreState {
  history: CommandHistoryItem[];
  aliases: CustomAlias[];
  devices: PairedDevice[];
  pending_pairings: PendingPairing[];
  settings: AssistantSettings;
}

const DATA_DIR = path.resolve(process.cwd(), '.dope-data');
const DATA_FILE = path.join(DATA_DIR, 'state.json');

const PAIRING_SECRET =
  process.env.DOPE_PAIRING_SECRET?.trim() || crypto.randomBytes(32).toString('hex');

const DEFAULT_STATE: DopeStoreState = {
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
    theme: 'light',
    language: 'auto',
    wake_word_enabled: false,
    wake_word_engine: 'openwakeword',
    wake_word_sensitivity: 0.65,
    voice_feedback_enabled: true,
    store_history: true,
    remote_execution_requires_approval: true,
  },
};

let cachedState: DopeStoreState | null = null;

function ensureStoreLoaded(): DopeStoreState {
  if (cachedState) {
    return cachedState;
  }
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<DopeStoreState>;
      cachedState = {
        history: Array.isArray(parsed.history) ? parsed.history : [],
        aliases: Array.isArray(parsed.aliases) ? parsed.aliases : [...DEFAULT_STATE.aliases],
        devices: Array.isArray(parsed.devices) ? parsed.devices : [...DEFAULT_STATE.devices],
        pending_pairings: Array.isArray(parsed.pending_pairings) ? parsed.pending_pairings : [],
        settings: { ...DEFAULT_STATE.settings, ...(parsed.settings ?? {}) },
      };
      return cachedState;
    }
  } catch {
    // Fall back to default state if corrupted
  }
  cachedState = structuredClone(DEFAULT_STATE);
  persistStore(cachedState);
  return cachedState;
}

function persistStore(state: DopeStoreState): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tempPath = `${DATA_FILE}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(state, null, 2), 'utf-8');
  fs.renameSync(tempPath, DATA_FILE);
}

export function redactSensitiveText(text: string): string {
  return text
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED]')
    .replace(/AIza[0-9A-Za-z-_]{20,}/g, '[REDACTED_KEY]');
}

export function getStoreState(): DopeStoreState {
  const state = ensureStoreLoaded();
  const now = Date.now();
  state.pending_pairings = state.pending_pairings.filter((p) => p.expires_at > now);
  return state;
}

export function addHistoryEntry(entry: CommandHistoryItem): void {
  const state = ensureStoreLoaded();
  if (!state.settings.store_history) {
    return;
  }
  const safeEntry: CommandHistoryItem = {
    ...entry,
    raw_input: redactSensitiveText(entry.raw_input),
    spoken_response: redactSensitiveText(entry.spoken_response),
    error_detail: entry.error_detail ? redactSensitiveText(entry.error_detail) : undefined,
  };
  state.history.unshift(safeEntry);
  state.history = state.history.slice(0, 100);
  persistStore(state);
}

export function updateHistoryStatus(
  id: string,
  status: CommandHistoryItem['status'],
  spoken_response?: string
): CommandHistoryItem | null {
  const state = ensureStoreLoaded();
  const found = state.history.find((h) => h.id === id);
  if (!found) {
    return null;
  }
  found.status = status;
  if (spoken_response) {
    found.spoken_response = redactSensitiveText(spoken_response);
  }
  persistStore(state);
  return found;
}

export function clearHistory(): void {
  const state = ensureStoreLoaded();
  state.history = [];
  persistStore(state);
}

export function addCustomAlias(alias: Omit<CustomAlias, 'id' | 'created_at'>): CustomAlias {
  const state = ensureStoreLoaded();
  const created: CustomAlias = {
    ...alias,
    id: `alias-${crypto.randomUUID().slice(0, 8)}`,
    created_at: new Date().toISOString(),
  };
  state.aliases.unshift(created);
  persistStore(state);
  return created;
}

export function deleteCustomAlias(id: string): boolean {
  const state = ensureStoreLoaded();
  const before = state.aliases.length;
  state.aliases = state.aliases.filter((a) => a.id !== id);
  if (state.aliases.length !== before) {
    persistStore(state);
    return true;
  }
  return false;
}

export function createPairingSession(device_name: string, platform: DopePlatform): PendingPairing {
  const state = ensureStoreLoaded();
  const code = String(crypto.randomInt(100000, 999999));
  const now = Date.now();
  const pending: PendingPairing = {
    code,
    device_name: device_name.trim().slice(0, 60),
    platform,
    created_at: now,
    expires_at: now + 5 * 60 * 1000,
  };
  state.pending_pairings = state.pending_pairings.filter((p) => p.expires_at > now);
  state.pending_pairings.push(pending);
  persistStore(state);
  return pending;
}

export function completePairingSession(
  code: string,
  os_version?: string
): { device: PairedDevice; device_token: string } | null {
  const state = ensureStoreLoaded();
  const now = Date.now();
  const idx = state.pending_pairings.findIndex((p) => p.code === code.trim() && p.expires_at > now);
  if (idx === -1) {
    return null;
  }
  const pending = state.pending_pairings[idx];
  state.pending_pairings.splice(idx, 1);

  const id = `dev-${crypto.randomUUID().slice(0, 8)}`;
  const capabilitiesMap: Record<DopePlatform, string[]> = {
    windows: ['open_app', 'window_controls', 'pdf_uia', 'volume', 'openwakeword'],
    macos: ['open_app', 'applescript_ax', 'pdf_shortcuts', 'volume'],
    linux: ['open_app', 'x11_atspi', 'xdg_portal', 'volume'],
    android: ['foreground_mic', 'app_launch', 'media_session'],
    ios: ['app_intents', 'siri_shortcuts', 'widgets'],
    browser_extension: ['tabs', 'scroll', 'zoom', 'browser_pdf', 'native_messaging'],
    web: ['web_speech', 'pdf_testbench', 'gmail_oauth'],
  };

  const device: PairedDevice = {
    id,
    name: pending.device_name,
    platform: pending.platform,
    os_version: os_version?.trim() || `${pending.platform} companion`,
    status: 'connected',
    remote_control_approved: !state.settings.remote_execution_requires_approval,
    paired_at: new Date().toISOString(),
    last_seen: new Date().toISOString(),
    capabilities: capabilitiesMap[pending.platform] ?? [],
  };

  state.devices.push(device);
  persistStore(state);

  const device_token = crypto
    .createHmac('sha256', PAIRING_SECRET)
    .update(`${device.id}:${device.paired_at}`)
    .digest('hex');

  return { device, device_token };
}

export function updateDevice(
  id: string,
  patch: Partial<Pick<PairedDevice, 'name' | 'status' | 'remote_control_approved'>>
): PairedDevice | null {
  const state = ensureStoreLoaded();
  const dev = state.devices.find((d) => d.id === id);
  if (!dev) {
    return null;
  }
  if (typeof patch.name === 'string' && patch.name.trim()) {
    dev.name = patch.name.trim().slice(0, 60);
  }
  if (patch.status === 'connected' || patch.status === 'disconnected') {
    dev.status = patch.status;
  }
  if (typeof patch.remote_control_approved === 'boolean') {
    dev.remote_control_approved = patch.remote_control_approved;
  }
  dev.last_seen = new Date().toISOString();
  persistStore(state);
  return dev;
}

export function deleteDevice(id: string): boolean {
  const state = ensureStoreLoaded();
  if (id === 'dev-web-console') {
    return false;
  }
  const before = state.devices.length;
  state.devices = state.devices.filter((d) => d.id !== id);
  if (state.devices.length !== before) {
    persistStore(state);
    return true;
  }
  return false;
}

export function updateSettings(patch: Partial<AssistantSettings>): AssistantSettings {
  const state = ensureStoreLoaded();
  state.settings = {
    ...state.settings,
    ...patch,
    wake_word_sensitivity:
      typeof patch.wake_word_sensitivity === 'number'
        ? Math.min(1, Math.max(0.1, patch.wake_word_sensitivity))
        : state.settings.wake_word_sensitivity,
  };
  persistStore(state);
  return state.settings;
}
