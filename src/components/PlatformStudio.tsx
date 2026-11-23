import React, { useEffect, useState } from 'react';
import { BookOpen, Check, Code2, Copy, Download, Laptop, Puzzle, Upload } from 'lucide-react';
import { downloadVerifiedZip } from '../lib/downloadZip';

interface PlatformFile {
  platform: string;
  path: string;
  content: string;
}

interface DocEntry {
  name: string;
  title: string;
  content: string;
}

function resizeImageToPngDataUrl(img: HTMLImageElement, size: number): string {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable.');
  ctx.clearRect(0, 0, size, size);

  const scale = Math.min(size / img.width, size / img.height);
  const drawW = img.width * scale;
  const drawH = img.height * scale;
  const dx = (size - drawW) / 2;
  const dy = (size - drawH) / 2;
  ctx.drawImage(img, dx, dy, drawW, drawH);
  return canvas.toDataURL('image/png');
}

export const PlatformStudio: React.FC = () => {
  const [mode, setMode] = useState<'guides' | 'source'>('guides');
  const [docs, setDocs] = useState<DocEntry[]>([]);
  const [selectedDocName, setSelectedDocName] = useState<string>('README.md');
  const [platformFiles, setPlatformFiles] = useState<PlatformFile[]>([]);
  const [selectedPlatform, setSelectedPlatform] = useState<string>('browser-extension');
  const [selectedFilePath, setSelectedFilePath] = useState<string>('');
  const [copied, setCopied] = useState(false);

  const [iconVersion, setIconVersion] = useState<number>(1);
  const [iconLoadError, setIconLoadError] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [downloadingExt, setDownloadingExt] = useState(false);
  const [downloadingDesk, setDownloadingDesk] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [logoStatus, setLogoStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [desktopStatus, setDesktopStatus] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    fetch('/api/dope/docs')
      .then((r) => r.json())
      .then((data: { docs?: DocEntry[] }) => {
        const list = data.docs ?? [];
        setDocs(list);
        if (list.length > 0 && !list.some((d) => d.name === selectedDocName)) {
          setSelectedDocName(list[0].name);
        }
      })
      .catch(() => {});

    fetch('/api/dope/platform-files')
      .then((r) => r.json())
      .then((data: { files?: PlatformFile[] }) => {
        const list = data.files ?? [];
        setPlatformFiles(list);
        const firstMatch = list.find((f) => f.platform === 'browser-extension') ?? list[0];
        if (firstMatch) {
          setSelectedPlatform(firstMatch.platform);
          setSelectedFilePath(firstMatch.path);
        }
      })
      .catch(() => {});
  }, []);

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setLogoUploading(true);
    setLogoStatus(null);

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = async () => {
        try {
          const icon16 = resizeImageToPngDataUrl(img, 16);
          const icon48 = resizeImageToPngDataUrl(img, 48);
          const icon128 = resizeImageToPngDataUrl(img, 128);

          const res = await fetch('/api/dope/extension/logo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ icon16, icon48, icon128 }),
          });
          const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
          if (!res.ok || !data.ok) {
            setLogoStatus({
              ok: false,
              text: data.error || 'Could not save custom logo.',
            });
          } else {
            setIconLoadError(false);
            setIconVersion((v) => v + 1);
            setLogoStatus({
              ok: true,
              text: 'Custom logo saved to extension bundle (16px, 48px, 128px PNG). Download the ZIP again to apply it in Chrome.',
            });
          }
        } catch (err: unknown) {
          setLogoStatus({
            ok: false,
            text: err instanceof Error ? err.message : 'Failed to process image.',
          });
        } finally {
          setLogoUploading(false);
        }
      };
      img.onerror = () => {
        setLogoUploading(false);
        setLogoStatus({
          ok: false,
          text: 'Could not read that image file. Please choose a PNG, JPG, WebP, or SVG logo.',
        });
      };
      img.src = String(reader.result || '');
    };
    reader.onerror = () => {
      setLogoUploading(false);
      setLogoStatus({ ok: false, text: 'Failed to read selected file.' });
    };
    reader.readAsDataURL(file);
  };

  const currentDoc = docs.find((d) => d.name === selectedDocName) ?? docs[0];
  const filteredFiles = platformFiles.filter((f) => f.platform === selectedPlatform);
  const currentFile =
    filteredFiles.find((f) => f.path === selectedFilePath) ?? filteredFiles[0];

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard may be restricted in headless contexts
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Chrome Extension Studio &amp; Platform Guides
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
            Upload your custom DOPE logo, download the standalone Chrome &amp; Edge Extension (.zip), and inspect all native adapters.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setMode('guides')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              mode === 'guides'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>14 User Guides</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('source')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              mode === 'source'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Native Source Code</span>
          </button>
        </div>
      </div>

      {/* Standalone Chrome/Edge Extension Builder & Custom Logo Uploader */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 flex items-center justify-center overflow-hidden shrink-0">
              {!iconLoadError ? (
                <img
                  src={`/api/dope/extension/icon.png?v=${iconVersion}`}
                  alt="DOPE Extension Logo Preview"
                  className="w-14 h-14 object-contain"
                  onError={() => setIconLoadError(true)}
                />
              ) : (
                <Puzzle className="w-7 h-7 text-blue-600" />
              )}
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                DOPE Chrome &amp; Edge Extension (Pi-Style Side Panel + Voice)
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 max-w-2xl">
                Pi-style conversational voice extension for Chrome &amp; Edge tabs. Press{' '}
                <kbd className="font-mono px-1 py-0.5 rounded border border-slate-300 dark:border-slate-700">
                  Alt+D+T
                </kbd>{' '}
                (or{' '}
                <kbd className="font-mono px-1 py-0.5 rounded border border-slate-300 dark:border-slate-700">
                  Alt+D
                </kbd>
                ) on any browser tab to activate DOPE with sweet bell chimes — ask any AI question, open YouTube/sites, switch/mute/close tabs, scroll, zoom, and minimize Chrome windows.
              </p>
              <ol className="mt-3 text-xs text-slate-600 dark:text-slate-300 space-y-1 list-decimal list-inside">
                <li>Optional: upload your own PNG/JPG/SVG logo below to bundle it into the extension.</li>
                <li>
                  Click <strong>Download Chrome Extension (.zip)</strong>, then <strong>Right-click &rarr; Extract All</strong> into a folder (do NOT drag the raw <code>.zip</code> file onto Chrome — Chrome rejects unextracted <code>.zip</code> files).
                </li>
                <li>
                  Open <code className="font-mono">chrome://extensions</code>, turn ON <strong>Developer mode</strong>, click <strong>Load unpacked</strong>, and select the extracted folder containing <code className="font-mono">manifest.json</code>.
                </li>
              </ol>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <label className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer whitespace-nowrap shrink-0">
              <Upload className="w-4 h-4" />
              <span>{logoUploading ? 'Saving Logo...' : 'Upload Custom Logo'}</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                onChange={handleLogoFileChange}
                disabled={logoUploading}
                className="sr-only"
                aria-label="Upload custom extension logo"
              />
            </label>

            <button
              type="button"
              disabled={downloadingExt}
              onClick={async () => {
                setDownloadingExt(true);
                setLogoStatus(null);
                try {
                  const info = await downloadVerifiedZip({
                    kind: 'extension',
                    cacheBust: iconVersion,
                  });
                  setLogoStatus({
                    ok: true,
                    text: `Downloaded ${info.filename} (${Math.round(info.byteLength / 1024)} KB, verified ZIP). Right-click -> Extract All, then open chrome://extensions -> Developer mode ON -> Load unpacked -> select the extracted folder.`,
                  });
                } catch (err: unknown) {
                  setLogoStatus({
                    ok: false,
                    text: err instanceof Error ? err.message : 'Failed to download Chrome Extension ZIP.',
                  });
                } finally {
                  setDownloadingExt(false);
                }
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
            >
              <Download className="w-4 h-4" />
              <span>{downloadingExt ? 'Building Verified ZIP...' : 'Download Chrome Extension (.zip)'}</span>
            </button>
          </div>
        </div>

        {logoStatus && (
          <div
            role="status"
            className={`mt-4 rounded-lg border px-3.5 py-2.5 text-xs ${
              logoStatus.ok
                ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200'
                : 'border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/30 text-rose-900 dark:text-rose-200'
            }`}
          >
            {logoStatus.text}
          </div>
        )}
      </section>

      {/* Whole-Laptop Desktop Assistant Card (Home Screen + Every App) */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-900 dark:bg-slate-950 flex items-center justify-center shrink-0">
              <Laptop className="w-8 h-8 text-blue-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                DOPE Universal Laptop + Chrome Bundle (Home Screen &amp; All Apps)
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 max-w-2xl">
                Includes <strong>both</strong> the updated Chrome Extension v1.3 (<code className="font-mono">manifest.json</code>) <strong>and</strong> the Windows/Mac/Linux Python Desktop Companion (<code className="font-mono">dope_companion.py</code>). Press{' '}
                <kbd className="font-mono px-1 py-0.5 rounded border border-slate-300 dark:border-slate-700">
                  Alt+D+T
                </kbd>{' '}
                in Chrome tabs AND on your Windows Desktop Home Screen / File Explorer / VS Code!
              </p>
              <ol className="mt-3 text-xs text-slate-600 dark:text-slate-300 space-y-1 list-decimal list-inside">
                <li>
                  Click <strong>Download Desktop Assistant (.zip)</strong> and extract it (Right-click &rarr; <strong>Extract All</strong>).
                </li>
                <li>
                  In Chrome: <code className="font-mono">chrome://extensions</code> &rarr; <strong>Load unpacked</strong> &rarr; select the extracted folder.
                </li>
                <li>
                  For Windows Home Screen &amp; outside Chrome: run <code className="font-mono">python dope_companion.py</code> in that folder and press <kbd className="font-mono px-1 py-0.5 rounded border border-slate-300 dark:border-slate-700">Alt+D+T</kbd> anywhere!
                </li>
              </ol>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText('python dope_companion.py');
                  setCopiedCmd(true);
                  setTimeout(() => setCopiedCmd(false), 1800);
                } catch {
                  // Ignore clipboard restrictions
                }
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
            >
              {copiedCmd ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedCmd ? 'Copied Command' : 'Copy Run Command'}</span>
            </button>
            <button
              type="button"
              disabled={downloadingDesk}
              onClick={async () => {
                setDownloadingDesk(true);
                setDesktopStatus(null);
                try {
                  const info = await downloadVerifiedZip({ kind: 'desktop' });
                  setDesktopStatus({
                    ok: true,
                    text: `Downloaded ${info.filename} (${Math.round(info.byteLength / 1024)} KB, verified ZIP). Extract All -> Load unpacked in chrome://extensions AND run python dope_companion.py for Desktop Home Screen!`,
                  });
                } catch (err: unknown) {
                  setDesktopStatus({
                    ok: false,
                    text: err instanceof Error ? err.message : 'Failed to download Desktop Assistant ZIP.',
                  });
                } finally {
                  setDownloadingDesk(false);
                }
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:opacity-90 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
            >
              <Download className="w-4 h-4" />
              <span>{downloadingDesk ? 'Building Verified ZIP...' : 'Download Desktop Assistant (.zip)'}</span>
            </button>
          </div>
        </div>

        {desktopStatus && (
          <div
            role="status"
            className={`mt-4 rounded-lg border px-3.5 py-2.5 text-xs ${
              desktopStatus.ok
                ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200'
                : 'border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/30 text-rose-900 dark:text-rose-200'
            }`}
          >
            {desktopStatus.text}
          </div>
        )}
      </section>

      {mode === 'guides' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <aside className="lg:col-span-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 px-2 py-1.5">
              Documentation ({docs.length} files)
            </div>
            <div className="mt-1 space-y-0.5">
              {docs.map((doc) => {
                const active = doc.name === currentDoc?.name;
                return (
                  <button
                    key={doc.name}
                    type="button"
                    onClick={() => setSelectedDocName(doc.name)}
                    className={`w-full text-left px-3 py-2 text-xs rounded-lg transition-colors ${
                      active
                        ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-semibold'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {doc.title}
                  </button>
                );
              })}
            </div>
          </aside>

          <article className="lg:col-span-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
            {currentDoc ? (
              <>
                <div className="flex items-center justify-between gap-4 pb-3 border-b border-slate-200 dark:border-slate-800">
                  <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                    {currentDoc.name}
                  </h2>
                  <button
                    type="button"
                    onClick={() => void handleCopy(currentDoc.content)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied' : 'Copy Markdown'}</span>
                  </button>
                </div>
                <pre className="mt-4 whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-800 dark:text-slate-200">
                  {currentDoc.content}
                </pre>
              </>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">Loading guides...</p>
            )}
          </article>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'browser-extension', label: 'Chrome & Edge Extension (MV3)' },
              { id: 'desktop-companion', label: 'Desktop Companion (Win / Mac / Linux / PDF)' },
              { id: 'android', label: 'Android (Kotlin + Compose)' },
              { id: 'ios', label: 'iOS (SwiftUI + AppIntents)' },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setSelectedPlatform(p.id);
                  const first = platformFiles.find((f) => f.platform === p.id);
                  if (first) setSelectedFilePath(first.path);
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  selectedPlatform === p.id
                    ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                    : 'bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <aside className="lg:col-span-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 px-2 py-1.5">
                Module Files
              </div>
              <div className="mt-1 space-y-0.5">
                {filteredFiles.map((file) => {
                  const active = file.path === currentFile?.path;
                  return (
                    <button
                      key={file.path}
                      type="button"
                      onClick={() => setSelectedFilePath(file.path)}
                      className={`w-full text-left px-3 py-2 text-xs font-mono rounded-lg transition-colors truncate ${
                        active
                          ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-semibold'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      {file.path.replace(`platforms/${selectedPlatform}/`, '')}
                    </button>
                  );
                })}
              </div>
            </aside>

            <div className="lg:col-span-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
              {currentFile ? (
                <>
                  <div className="flex items-center justify-between gap-4 pb-3 border-b border-slate-200 dark:border-slate-800">
                    <code className="text-xs font-mono text-slate-700 dark:text-slate-300">
                      {currentFile.path}
                    </code>
                    <button
                      type="button"
                      onClick={() => void handleCopy(currentFile.content)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? 'Copied' : 'Copy Code'}</span>
                    </button>
                  </div>
                  <pre className="mt-4 p-4 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-800 dark:text-slate-200 overflow-x-auto max-h-[540px]">
                    {currentFile.content}
                  </pre>
                </>
              ) : (
                <p className="text-sm text-slate-500 dark:text-slate-400">Loading source files...</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
