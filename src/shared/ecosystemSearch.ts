import { ACTION_CATALOG, type CustomAlias } from './actions';

export type SearchResultKind = 'command' | 'device' | 'setting';

export interface SearchableDevice {
  id: string;
  name: string;
  platform: string;
  os_version: string;
  status: string;
  capabilities: string[];
}

export interface EcosystemSearchResult {
  id: string;
  kind: SearchResultKind;
  title: string;
  subtitle: string;
  tab: 'commands' | 'devices' | 'settings';
  filterText?: string;
  keywords: string[];
}

export interface SettingSearchItem {
  id: string;
  title: string;
  subtitle: string;
  keywords: string[];
}

export const SETTINGS_SEARCH_CATALOG: SettingSearchItem[] = [
  {
    id: 'setting-theme-light',
    title: 'Default Light Theme',
    subtitle: 'Switch interface to high-contrast light appearance (#FFFFFF)',
    keywords: ['theme', 'light', 'appearance', 'white', 'color'],
  },
  {
    id: 'setting-theme-dark',
    title: 'Default Dark Theme',
    subtitle: 'Switch interface to obsidian dark appearance (#070708)',
    keywords: ['theme', 'dark', 'appearance', 'obsidian', 'night'],
  },
  {
    id: 'setting-wake-word',
    title: 'Wake-Word Engine & Sensitivity',
    subtitle: 'Configure openWakeWord, Porcupine, or Web Speech detection threshold',
    keywords: ['wake', 'word', 'hey el dorado', 'openwakeword', 'porcupine', 'sensitivity', 'voice'],
  },
  {
    id: 'setting-history',
    title: 'Save Command History & Clear History',
    subtitle: 'Control local transcript retention and delete saved logs',
    keywords: ['history', 'privacy', 'retention', 'logs', 'clear', 'delete'],
  },
  {
    id: 'setting-approval',
    title: 'Remote Device Approval Gate',
    subtitle: 'Require explicit approval before newly paired devices execute commands',
    keywords: ['approval', 'security', 'remote', 'device', 'permission', 'gate'],
  },
  {
    id: 'setting-diagnostics',
    title: 'System Diagnostics & Microphone Readiness',
    subtitle: 'Inspect Gemini AI backend, browser microphone API, and Gmail OAuth status',
    keywords: ['diagnostics', 'microphone', 'speech', 'gemini', 'gmail', 'oauth', 'health'],
  },
];

export function searchEcosystem(
  query: string,
  devices: SearchableDevice[],
  aliases: CustomAlias[],
  limit = 12
): EcosystemSearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const terms = q.split(/\s+/).filter(Boolean);

  const candidates: EcosystemSearchResult[] = [
    ...devices.map((d) => ({
      id: `device-${d.id}`,
      kind: 'device' as const,
      title: d.name,
      subtitle: `${d.platform} · ${d.os_version} · ${d.status}`,
      tab: 'devices' as const,
      filterText: d.name,
      keywords: [d.name, d.platform, d.os_version, d.status, ...d.capabilities],
    })),
    ...aliases.map((a) => ({
      id: `alias-${a.id}`,
      kind: 'command' as const,
      title: `"${a.phrase}" (Custom Alias)`,
      subtitle: `${a.action}${a.target ? ` → ${a.target}` : ''}`,
      tab: 'commands' as const,
      filterText: a.action,
      keywords: [a.phrase, a.action, a.target ?? '', 'alias', 'custom'],
    })),
    ...ACTION_CATALOG.map((cmd) => ({
      id: `cmd-${cmd.id}`,
      kind: 'command' as const,
      title: cmd.voice_phrase,
      subtitle: `${cmd.category} · ${cmd.action}`,
      tab: 'commands' as const,
      filterText: cmd.action,
      keywords: [cmd.voice_phrase, cmd.action, cmd.category, ...cmd.supported_platforms],
    })),
    ...SETTINGS_SEARCH_CATALOG.map((s) => ({
      id: s.id,
      kind: 'setting' as const,
      title: s.title,
      subtitle: s.subtitle,
      tab: 'settings' as const,
      filterText: s.title,
      keywords: s.keywords,
    })),
  ];

  const scored: Array<{ item: EcosystemSearchResult; score: number }> = [];
  for (const item of candidates) {
    const haystack = `${item.title} ${item.subtitle} ${item.keywords.join(' ')}`.toLowerCase();
    if (!terms.every((t) => haystack.includes(t))) continue;

    let score = 1;
    if (item.title.toLowerCase().startsWith(q)) score += 6;
    else if (item.title.toLowerCase().includes(q)) score += 3;
    if (item.kind === 'device') score += 1;
    scored.push({ item, score });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.item);
}

/**
 * Compute normalized audio input level (0-100) and grouped frequency bars (0-100)
 * from Web Audio AnalyserNode byte frequency bins.
 */
export function computeAudioVisualizerMetrics(
  freqBins: Uint8Array,
  barCount = 12
): { levelPercent: number; receivingAudio: boolean; bars: number[] } {
  const safeCount = Math.max(4, barCount);
  if (!freqBins.length) {
    return { levelPercent: 0, receivingAudio: false, bars: new Array(safeCount).fill(0) };
  }

  // Focus on speech-band bins (lower ~65% of FFT spectrum)
  const usableLen = Math.max(safeCount, Math.floor(freqBins.length * 0.65));
  const step = Math.max(1, Math.floor(usableLen / safeCount));
  const bars: number[] = [];
  let sum = 0;
  let peak = 0;

  for (let b = 0; b < safeCount; b++) {
    const start = b * step;
    const end = Math.min(usableLen, start + step);
    let bucketSum = 0;
    let bucketPeak = 0;
    let count = 0;
    for (let i = start; i < end; i++) {
      const val = freqBins[i];
      bucketSum += val;
      if (val > bucketPeak) bucketPeak = val;
      count++;
    }
    const avg = count ? bucketSum / count : 0;
    const blended = avg * 0.6 + bucketPeak * 0.4;
    const pct = Math.min(100, Math.round((blended / 255) * 100));
    bars.push(pct);
    sum += avg;
    if (bucketPeak > peak) peak = bucketPeak;
  }

  const overall = (sum / safeCount) * 0.55 + peak * 0.45;
  const levelPercent = Math.min(100, Math.round((overall / 255) * 100));
  return {
    levelPercent,
    receivingAudio: levelPercent >= 5,
    bars,
  };
}
