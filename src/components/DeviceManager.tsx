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
    <div className="space-y-8">
      <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Connected Devices &amp; Secure Pairing
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
          Unpaired devices cannot control your computer. Approve or revoke any session at any time.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Pair New Device */}
        <section className="lg:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
          <div className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Pair a New Device
            </h2>
          </div>

          <form onSubmit={handleCreatePairing} className="mt-4 space-y-3">
            <div>
              <label
                htmlFor="pair-device-name"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Device Name
              </label>
              <input
                id="pair-device-name"
                type="text"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                placeholder="e.g. Home Windows 11 PC"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label
                htmlFor="pair-platform"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Platform
              </label>
              <select
                id="pair-platform"
                value={platform}
                onChange={(e) => setPlatform(e.target.value as DopePlatform)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
              >
                <option value="windows">Windows 10 / 11 Companion</option>
                <option value="macos">macOS Companion</option>
                <option value="linux">Linux Companion</option>
                <option value="browser_extension">Chrome / Edge Extension</option>
                <option value="android">Android App</option>
                <option value="ios">iPhone / iPad Companion</option>
              </select>
            </div>

            {formError && <p className="text-xs text-rose-600 dark:text-rose-400">{formError}</p>}

            <button
              type="submit"
              disabled={busy}
              className="w-full px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {busy ? 'Generating...' : 'Generate Pairing Code & QR'}
            </button>
          </form>

          {activePairing && qrMatrix && (
            <div className="mt-6 pt-5 border-t border-slate-200 dark:border-slate-800 flex flex-col items-center text-center">
              <svg
                width="132"
                height="132"
                viewBox="0 0 11 11"
                aria-label={`Pairing QR matrix for ${activePairing.device_name}`}
                className="p-2 bg-white rounded-lg border border-slate-200"
              >
                {qrMatrix.map((row, r) =>
                  row.map((cell, c) =>
                    cell ? <rect key={`${r}-${c}`} x={c} y={r} width={1} height={1} fill="#0F172A" /> : null
                  )
                )}
              </svg>
              <div className="mt-3 font-mono text-2xl font-bold tracking-widest text-slate-900 dark:text-slate-100 tabular-nums">
                {activePairing.code}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Pairing {activePairing.device_name} ({activePairing.platform}) · Expires in 5 minutes
              </p>
              <button
                type="button"
                onClick={() => void onCompletePairing(activePairing.code).then(() => setActivePairing(null))}
                className="mt-3 px-3.5 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Verify &amp; Link Device
              </button>
            </div>
          )}
        </section>

        {/* Paired Device List */}
        <section className="lg:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Authorized Devices ({devices.length})
          </h2>

          <div className="mt-4 divide-y divide-slate-200 dark:divide-slate-800">
            {devices.map((dev) => {
              const isMobile = dev.platform === 'android' || dev.platform === 'ios';
              return (
                <div key={dev.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {isMobile ? <Smartphone className="w-4 h-4" /> : <Laptop className="w-4 h-4" />}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {dev.name}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                        {dev.platform} · {dev.os_version} · {dev.status}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Capabilities: {dev.capabilities.join(', ')}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => void onToggleApproval(dev.id, !dev.remote_control_approved)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                        dev.remote_control_approved
                          ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400'
                          : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400'
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
                        className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
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
