import React, { useEffect, useState } from 'react';
import { Check, Copy, Download, Laptop, Puzzle, ShieldAlert, X } from 'lucide-react';
import { downloadVerifiedZip } from '../lib/downloadZip';
import { AntigravityMark } from './AntigravityMark';

interface ExtensionInstallModalProps {
  open: boolean;
  onClose: () => void;
  onOpenPlatformStudio?: () => void;
}

export const ExtensionInstallModal: React.FC<ExtensionInstallModalProps> = ({
  open,
  onClose,
  onOpenPlatformStudio,
}) => {
  const [copiedUrl, setCopiedUrl] = useState<'chrome' | 'edge' | 'cmd' | null>(null);
  const [busyKind, setBusyKind] = useState<'extension' | 'desktop' | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const copyText = async (value: string, kind: 'chrome' | 'edge' | 'cmd') => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedUrl(kind);
      window.setTimeout(() => setCopiedUrl(null), 1800);
    } catch {
      // Ignore clipboard restrictions
    }
  };

  const handleDownload = async (kind: 'extension' | 'desktop') => {
    setBusyKind(kind);
    setStatusMessage(null);
    try {
      const info = await downloadVerifiedZip({ kind });
      setStatusMessage({
        ok: true,
        text: `Downloaded ${info.filename} (${Math.round(info.byteLength / 1024)} KB). Extract the ZIP folder first before selecting it in Load unpacked.`,
      });
    } catch (err) {
      setStatusMessage({
        ok: false,
        text: err instanceof Error ? err.message : 'Download failed. Please retry.',
      });
    } finally {
      setBusyKind(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm ag-animate-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="install-modal-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-black/10 dark:border-white/15 bg-white dark:bg-[#0D0D10] text-[#0A0A0C] dark:text-white shadow-2xl p-6 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-black/10 dark:border-white/[0.08]">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-[#F7F8FA] dark:bg-[#141418] border border-black/10 dark:border-white/15 flex items-center justify-center shrink-0">
              <AntigravityMark variant="color" className="w-7 h-7" />
            </div>
            <div className="min-w-0">
              <h2 id="install-modal-title" className="text-lg font-semibold tracking-tight">
                Manual Extension Setup (Developer Dashboard)
              </h2>
              <p className="text-xs text-[#5F6368] dark:text-neutral-400 mt-0.5">
                Load El Dorado directly in Chrome or Edge Developer Mode to bypass store and drag-and-drop blocks.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close installation guide"
            className="p-2 rounded-full text-[#5F6368] dark:text-neutral-400 hover:bg-black/5 dark:hover:bg-white/10 hover:text-[#0A0A0C] dark:hover:text-white transition-colors shrink-0 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Browser Restriction Bypass Explanation */}
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5 leading-relaxed">
          <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
          <div>
            <strong>Why use Developer Dashboard?</strong> Chrome and Edge block dragging raw <code className="font-mono">.zip</code> archives or unlisted packages onto the Extensions page. Extracting the ZIP once and loading the unpacked folder gives immediate, unrestricted MV3 execution across all open tabs.
          </div>
        </div>

        {/* 4 Step Instructions */}
        <ol className="space-y-3 text-xs text-[#0A0A0C] dark:text-neutral-200">
          <li className="rounded-xl border border-black/10 dark:border-white/[0.08] bg-[#F7F8FA] dark:bg-[#141418] p-3.5 space-y-2">
            <div className="font-semibold text-sm text-[#0A0A0C] dark:text-white">
              1. Download &amp; Extract the Package
            </div>
            <p className="text-[#5F6368] dark:text-neutral-400 leading-relaxed">
              Download the extension ZIP below, right-click it in your Downloads folder, and choose <strong>Extract All</strong> into a normal folder (do not select the compressed <code className="font-mono">.zip</code> file itself).
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                disabled={busyKind !== null}
                onClick={() => void handleDownload('extension')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-full bg-[#2F75C3] dark:bg-[#2F71E3] text-white hover:opacity-90 disabled:opacity-60 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{busyKind === 'extension' ? 'Preparing ZIP...' : 'Download Chrome Extension (.zip)'}</span>
              </button>
              <button
                type="button"
                disabled={busyKind !== null}
                onClick={() => void handleDownload('desktop')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-full bg-[#0A0A0C] text-white dark:bg-white dark:text-[#070708] hover:opacity-90 disabled:opacity-60 cursor-pointer"
              >
                <Laptop className="w-3.5 h-3.5" />
                <span>{busyKind === 'desktop' ? 'Preparing ZIP...' : 'Download Laptop Bundle (.zip)'}</span>
              </button>
            </div>
          </li>

          <li className="rounded-xl border border-black/10 dark:border-white/[0.08] bg-[#F7F8FA] dark:bg-[#141418] p-3.5 space-y-2">
            <div className="font-semibold text-sm text-[#0A0A0C] dark:text-white">
              2. Open your Browser Extensions Developer Dashboard
            </div>
            <p className="text-[#5F6368] dark:text-neutral-400 leading-relaxed">
              Copy and paste one of the URLs below into a new browser tab address bar, then switch ON the <strong>Developer mode</strong> toggle in the top-right corner.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void copyText('chrome://extensions', 'chrome')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-black/15 dark:border-white/15 bg-white dark:bg-[#0D0D10] text-xs font-mono hover:border-[#2F71E3] cursor-pointer"
              >
                {copiedUrl === 'chrome' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedUrl === 'chrome' ? 'Copied chrome://extensions' : 'Copy chrome://extensions'}</span>
              </button>
              <button
                type="button"
                onClick={() => void copyText('edge://extensions', 'edge')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-black/15 dark:border-white/15 bg-white dark:bg-[#0D0D10] text-xs font-mono hover:border-[#2F71E3] cursor-pointer"
              >
                {copiedUrl === 'edge' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedUrl === 'edge' ? 'Copied edge://extensions' : 'Copy edge://extensions'}</span>
              </button>
            </div>
          </li>

          <li className="rounded-xl border border-black/10 dark:border-white/[0.08] bg-[#F7F8FA] dark:bg-[#141418] p-3.5 space-y-1">
            <div className="font-semibold text-sm text-[#0A0A0C] dark:text-white">
              3. Click &ldquo;Load unpacked&rdquo; &amp; Select the Extracted Folder
            </div>
            <p className="text-[#5F6368] dark:text-neutral-400 leading-relaxed">
              Pick the folder containing <code className="font-mono">manifest.json</code>. El Dorado activates immediately across open browser tabs. Press <kbd className="font-mono px-1.5 py-0.5 rounded border border-black/15 dark:border-white/15">Alt+D+T</kbd> (or <kbd className="font-mono px-1.5 py-0.5 rounded border border-black/15 dark:border-white/15">Alt+D</kbd>) anywhere to launch the floating orb HUD.
            </p>
          </li>

          <li className="rounded-xl border border-black/10 dark:border-white/[0.08] bg-[#F7F8FA] dark:bg-[#141418] p-3.5 space-y-2">
            <div className="font-semibold text-sm text-[#0A0A0C] dark:text-white">
              4. Whole-Laptop Control (Windows Desktop, Firefox &amp; Desktop Apps)
            </div>
            <p className="text-[#5F6368] dark:text-neutral-400 leading-relaxed">
              Browser security prevents any Chrome extension from controlling Firefox, File Explorer, or your Windows Desktop Home Screen. Run the included Desktop Companion inside the Laptop Bundle folder to unlock global <kbd className="font-mono px-1 py-0.5 rounded border border-black/15 dark:border-white/15">Alt+D+T</kbd> voice control everywhere:
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <code className="px-3 py-1.5 rounded-lg bg-white dark:bg-[#070708] border border-black/10 dark:border-white/10 font-mono text-[11px]">
                python el_dorado_companion.py
              </code>
              <button
                type="button"
                onClick={() => void copyText('python el_dorado_companion.py', 'cmd')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-black/15 dark:border-white/15 bg-white dark:bg-[#0D0D10] text-xs font-medium hover:border-[#2F71E3] cursor-pointer"
              >
                {copiedUrl === 'cmd' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedUrl === 'cmd' ? 'Copied' : 'Copy Command'}</span>
              </button>
            </div>
          </li>
        </ol>

        {statusMessage && (
          <div
            role="status"
            className={`rounded-xl border px-3.5 py-2.5 text-xs ${
              statusMessage.ok
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                : 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300'
            }`}
          >
            {statusMessage.text}
          </div>
        )}

        <div className="flex items-center justify-between gap-3 pt-2 border-t border-black/10 dark:border-white/[0.08]">
          {onOpenPlatformStudio ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenPlatformStudio();
              }}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#2F75C3] dark:text-[#60A5FA] hover:underline cursor-pointer"
            >
              <Puzzle className="w-3.5 h-3.5" />
              <span>Customize Extension Logo in Studio</span>
            </button>
          ) : (
            <span />
          )}

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium rounded-full bg-[#0A0A0C] text-white dark:bg-white dark:text-[#070708] hover:opacity-90 cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
