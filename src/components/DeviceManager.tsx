import React, { useState } from 'react';
import { Laptop, QrCode, ShieldCheck, Smartphone, Trash2 } from 'lucide-react';
import type { DopePlatform } from '../shared/actions';

export interface DeviceRecord {
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

export interface PendingPairingRecord {
  code: string;
  device_name: string;
  platform: DopePlatform;
  created_at: number;
  expires_at: number;
}

interface DeviceManagerProps {
  devices: DeviceRecord[];
  pendingPairings: PendingPairingRecord[];
  onInitPairing: (device_name: string, platform: DopePlatform) => Promise<PendingPairingRecord | null>;
  onCompletePairing: (code: string) => Promise<void>;
  onToggleApproval: (id: string, approved: boolean) => Promise<void>;
  onRevokeDevice: (id: string) => Promise<void>;
}

// Deterministic 11x11 QR-like visual matrix seeded from pairing code
function renderPairingMatrix(seedText: string): boolean[][] {
  const size = 11;
  const grid: boolean[][] = [];
  let hash = 2166136261;
  for (let i = 0; i < seedText.length; i++) {
    hash ^= seedText.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  for (let r = 0; r < size; r++) {
    const row: boolean[] = [];
    for (let c = 0; c < size; c++) {
      const isCorner =
        (r < 3 && c < 3) || (r < 3 && c >= size - 3) || (r >= size - 3 && c < 3);
      if (isCorner) {
        row.push(true);
      } else {
        hash = Math.imul(hash ^ (r * 31 + c), 16777619);
        row.push((hash & 1) === 1);
      }
    }
    grid.push(row);
  }
  return grid;
}

export const DeviceManager: React.FC<DeviceManagerProps> = ({
  devices,
  pendingPairings,
  onInitPairing,
  onCompletePairing,
  onToggleApproval,
  onRevokeDevice,
}) => {
  const [deviceName, setDeviceName] = useState('');
  const [platform, setPlatform] = useState<DopePlatform>('windows');
  const [activePairing, setActivePairing] = useState<PendingPairingRecord | null>(
    pendingPairings[0] ?? null
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleCreatePairing = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!deviceName.trim()) {
      setFormError('Please enter a name for the device you want to pair.');
      return;
    }
    setBusy(true);
    try {
      const pairing = await onInitPairing(deviceName.trim(), platform);
      if (pairing) {
        setActivePairing(pairing);
        setDeviceName('');
      }
    } finally {
      setBusy(false);
    }
  };

  const qrMatrix = activePairing ? renderPairingMatrix(activePairing.code) : null;

  return (
    <div className="space-y-8 ag-animate-in">
      <div className="border-b border-black/10 dark:border-white/[0.08] pb-4">
        <h1 className="text-2xl font-semibold tracking-tight text-[#0A0A0C] dark:text-white">
          Connected Devices &amp; Secure Pairing
        </h1>
        <p className="text-sm text-[#5F6368] dark:text-neutral-400 mt-0.5">
          Unpaired devices cannot control your computer. Approve or revoke any session at any time.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Pair New Device */}
        <section className="lg:col-span-5 rounded-2xl border border-black/10 dark:border-white/[0.08] bg-[#F7F8FA] dark:bg-[#0D0D10] p-6">
          <div className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-[#2F75C3] dark:text-[#2F71E3]" />
            <h2 className="text-base font-semibold text-[#0A0A0C] dark:text-white">
              Pair a New Device
            </h2>
          </div>

          <form onSubmit={handleCreatePairing} className="mt-4 space-y-3">
            <div>
              <label
                htmlFor="pair-device-name"
                className="block text-xs font-medium text-[#5F6368] dark:text-neutral-300 mb-1"
              >
                Device Name
              </label>
              <input
                id="pair-device-name"
                type="text"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                placeholder="e.g. Home Windows 11 PC"
                className="w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-[#070708] px-3.5 py-2 text-sm text-[#0A0A0C] dark:text-white focus:outline-none focus:border-[#2F71E3]"
              />
            </div>

            <div>
              <label
                htmlFor="pair-platform"
                className="block text-xs font-medium text-[#5F6368] dark:text-neutral-300 mb-1"
              >
                Platform
              </label>
              <select
                id="pair-platform"
                value={platform}
                onChange={(e) => setPlatform(e.target.value as DopePlatform)}
                className="w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-[#070708] px-3.5 py-2 text-sm text-[#0A0A0C] dark:text-white focus:outline-none focus:border-[#2F71E3]"
              >
                <option value="windows">Windows 10 / 11 Companion</option>
                <option value="macos">macOS Companion</option>
                <option value="linux">Linux Companion</option>
                <option value="browser_extension">Chrome / Edge Extension</option>
                <option value="android">Android App</option>
                <option value="ios">iPhone / iPad Companion</option>
              </select>
            </div>

            {formError && <p className="text-xs text-rose-500">{formError}</p>}

            <button
              type="submit"
              disabled={busy}
              className="w-full px-4 py-2.5 text-sm font-medium rounded-full bg-[#2F75C3] dark:bg-[#2F71E3] text-white hover:opacity-90 disabled:opacity-60 transition-opacity cursor-pointer"
            >
              {busy ? 'Generating...' : 'Generate Pairing Code & QR'}
            </button>
          </form>

          {activePairing && qrMatrix && (
            <div className="mt-6 pt-5 border-t border-black/10 dark:border-white/[0.08] flex flex-col items-center text-center">
              <svg
                width="132"
                height="132"
                viewBox="0 0 11 11"
                aria-label={`Pairing QR matrix for ${activePairing.device_name}`}
                className="p-2 bg-white rounded-xl border border-black/10"
              >
                {qrMatrix.map((row, r) =>
                  row.map((cell, c) =>
                    cell ? <rect key={`${r}-${c}`} x={c} y={r} width={1} height={1} fill="#070708" /> : null
                  )
                )}
              </svg>
              <div className="mt-3 font-mono text-2xl font-bold tracking-widest text-[#0A0A0C] dark:text-white tabular-nums">
                {activePairing.code}
              </div>
              <p className="text-xs text-[#5F6368] dark:text-neutral-400 mt-1">
                Pairing {activePairing.device_name} ({activePairing.platform}) · Expires in 5 minutes
              </p>
              <button
                type="button"
                onClick={() => void onCompletePairing(activePairing.code).then(() => setActivePairing(null))}
                className="mt-3 px-4 py-1.5 text-xs font-medium rounded-full border border-black/15 dark:border-white/15 text-[#0A0A0C] dark:text-white hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
              >
                Verify &amp; Link Device
              </button>
            </div>
          )}
        </section>

        {/* Paired Device List */}
        <section className="lg:col-span-7 rounded-2xl border border-black/10 dark:border-white/[0.08] bg-[#F7F8FA] dark:bg-[#0D0D10] p-6">
          <h2 className="text-base font-semibold text-[#0A0A0C] dark:text-white">
            Authorized Devices ({devices.length})
          </h2>

          <div className="mt-4 divide-y divide-black/10 dark:divide-white/[0.08]">
            {devices.map((dev) => {
              const isMobile = dev.platform === 'android' || dev.platform === 'ios';
              return (
                <div key={dev.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 rounded-xl bg-white dark:bg-[#141418] border border-black/10 dark:border-white/10 text-[#0A0A0C] dark:text-neutral-200">
                      {isMobile ? <Smartphone className="w-4 h-4" /> : <Laptop className="w-4 h-4" />}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-[#0A0A0C] dark:text-white">
                        {dev.name}
                      </div>
                      <div className="text-xs text-[#5F6368] dark:text-neutral-400 mt-0.5 tabular-nums">
                        {dev.platform} · {dev.os_version} · {dev.status}
                      </div>
                      <div className="text-xs text-[#5F6368] dark:text-neutral-400 mt-1">
                        Capabilities: {dev.capabilities.join(', ')}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => void onToggleApproval(dev.id, !dev.remote_control_approved)}
                      className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-full border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        dev.remote_control_approved
                          ? 'border-emerald-500/40 text-emerald-700 dark:text-emerald-400'
                          : 'border-black/15 dark:border-white/15 text-[#5F6368] dark:text-neutral-400'
                      }`}
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>{dev.remote_control_approved ? 'Remote Approved' : 'Approval Required'}</span>
                    </button>

                    {dev.id !== 'dev-web-console' && (
                      <button
                        type="button"
                        onClick={() => void onRevokeDevice(dev.id)}
                        aria-label={`Revoke ${dev.name}`}
                        className="p-1.5 rounded-lg text-[#5F6368] hover:text-rose-500 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
};
