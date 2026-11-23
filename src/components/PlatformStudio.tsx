import React, { useEffect, useState } from 'react';
import { BookOpen, Check, Code2, Copy, Download, Laptop, Puzzle, Upload } from 'lucide-react';
import { downloadVerifiedZip, loadLocalCustomLogo, saveLocalCustomLogo } from '../lib/downloadZip';
import { BUNDLED_DOCS, BUNDLED_PLATFORM_FILES, isJsonResponse } from '../lib/vercelLocalEngine';

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
  const [docs, setDocs] = useState<DocEntry[]>(BUNDLED_DOCS);
  const [selectedDocName, setSelectedDocName] = useState<string>(BUNDLED_DOCS[0].name);
  const [platformFiles, setPlatformFiles] = useState<PlatformFile[]>(BUNDLED_PLATFORM_FILES);
  const [selectedPlatform, setSelectedPlatform] = useState<string>('browser-extension');
  const [selectedFilePath, setSelectedFilePath] = useState<string>(
    BUNDLED_PLATFORM_FILES[0].path
  );
  const [copied, setCopied] = useState(false);

  const [iconVersion, setIconVersion] = useState<number>(1);
  const [localPreviewSrc, setLocalPreviewSrc] = useState<string | null>(
    () => loadLocalCustomLogo()?.icon128 ?? null
  );
  const [iconLoadError, setIconLoadError] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [downloadingExt, setDownloadingExt] = useState(false);
  const [downloadingDesk, setDownloadingDesk] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [copiedExtPage, setCopiedExtPage] = useState(false);
  const [logoStatus, setLogoStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [desktopStatus, setDesktopStatus] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    fetch('/api/dope/docs')
      .then(async (r) => (isJsonResponse(r) ? r.json() : null))
      .then((data: { docs?: DocEntry[] } | null) => {
        if (!data?.docs?.length) return;
        setDocs(data.docs);
        if (!data.docs.some((d) => d.name === selectedDocName)) {
          setSelectedDocName(data.docs[0].name);
        }
      })
      .catch(() => {});

    fetch('/api/dope/platform-files')
      .then(async (r) => (isJsonResponse(r) ? r.json() : null))
      .then((data: { files?: PlatformFile[] } | null) => {
        if (!data?.files?.length) return;
        setPlatformFiles(data.files);
        const firstMatch = data.files.find((f) => f.platform === 'browser-extension') ?? data.files[0];
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

          saveLocalCustomLogo({ icon16, icon48, icon128 });
          setLocalPreviewSrc(icon128);
          setIconLoadError(false);
          setIconVersion((v) => v + 1);

          try {
            const res = await fetch('/api/dope/extension/logo', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ icon16, icon48, icon128 }),
            });
            if (isJsonResponse(res)) {
              const data = (await res.json()) as { ok?: boolean; error?: string };
              if (data.ok) {
                setLogoStatus({
                  ok: true,
                  text: 'Custom logo saved to extension bundle (16px, 48px, 128px PNG). Download the ZIP to apply it in Chrome.',
                });
                return;
              }
            }
          } catch {
            // Fall through to client-bundled logo status
          }

          setLogoStatus({
            ok: true,
            text: 'Custom logo saved locally in your browser (16px, 48px, 128px PNG). Click Download El Dorado Extension (.zip) to generate your custom ZIP.',
          });
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
    <div className="space-y-6 ag-animate-in">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-black/10 dark:border-white/[0.08] pb-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#0A0A0C] dark:text-white">
            El Dorado Extension Studio &amp; Platform Guides
          </h1>
          <p className="text-sm text-[#5F6368] dark:text-neutral-400 mt-0.5">
            Upload a custom El Dorado logo, download the verified Chrome Extension (.zip), and inspect all native adapters.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-full bg-[#F7F8FA] dark:bg-[#0D0D10] border border-black/10 dark:border-white/[0.08]">
          <button
            type="button"
            onClick={() => setMode('guides')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-full transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              mode === 'guides'
                ? 'bg-[#0A0A0C] text-white dark:bg-white dark:text-[#070708]'
                : 'text-[#5F6368] dark:text-neutral-400'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>User Guides</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('source')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-full transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              mode === 'source'
                ? 'bg-[#0A0A0C] text-white dark:bg-white dark:text-[#070708]'
                : 'text-[#5F6368] dark:text-neutral-400'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Native Source Code</span>
          </button>
        </div>
      </div>

      {/* Standalone Chrome/Edge Extension Builder & Custom Logo Uploader */}
      <section className="rounded-2xl border border-black/10 dark:border-white/[0.08] bg-[#F7F8FA] dark:bg-[#0D0D10] p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl border border-black/10 dark:border-white/10 bg-[#0B0C0F] flex items-center justify-center overflow-hidden shrink-0">
              {localPreviewSrc ? (
                <img
                  src={localPreviewSrc}
                  alt="El Dorado Extension Logo Preview"
                  className="w-12 h-12 object-contain"
                />
              ) : !iconLoadError ? (
                <img
                  src={`/downloads/el-dorado-icon-128.png?v=${iconVersion}`}
                  alt="El Dorado Extension Logo Preview"
                  className="w-12 h-12 object-contain"
                  onError={() => setIconLoadError(true)}
                />
              ) : (
                <Puzzle className="w-7 h-7 text-[#2F71E3]" />
              )}
            </div>
            <div>
              <h2 className="text-base font-semibold text-[#0A0A0C] dark:text-white">
                El Dorado Chrome &amp; Edge Extension (v1.5.1)
              </h2>
              <p className="text-xs text-[#5F6368] dark:text-neutral-400 mt-1 max-w-2xl leading-relaxed">
                Includes full dark &amp; light theme inside popup, side panel, and on-page{' '}
                <kbd className="font-mono px-1.5 py-0.5 rounded border border-black/10 dark:border-white/15 text-[#0A0A0C] dark:text-white">
                  Alt+D+T
                </kbd>{' '}
                floating command HUD — with radial particles, harmonic chimes, and &ldquo;Hey El Dorado&rdquo; AI Q&amp;A.
              </p>
              <ol className="mt-3 text-xs text-[#5F6368] dark:text-neutral-300 space-y-1.5 list-decimal list-inside">
                <li>Optional: upload your own PNG/JPG/SVG logo below to bundle it into the extension.</li>
                <li>
                  Click <strong>Download El Dorado Extension (.zip)</strong>, then <strong>Right-click &rarr; Extract All</strong> into a folder.
                </li>
                <li className="flex flex-wrap items-center gap-2">
                  <span>
                    Open <code className="font-mono">chrome://extensions</code>, turn ON <strong>Developer mode</strong>, click <strong>Load unpacked</strong>, and select the extracted folder.
                  </span>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText('chrome://extensions');
                        setCopiedExtPage(true);
                        setTimeout(() => setCopiedExtPage(false), 1800);
                      } catch {
                        // Ignore clipboard restrictions
                      }
                    }}
                    className="inline-flex items-center gap-1 rounded-full border border-black/15 dark:border-white/15 bg-white dark:bg-[#070708] px-2.5 py-0.5 text-[11px] font-medium cursor-pointer"
                  >
                    {copiedExtPage ? <Check className="w-3 h-3 text-[#2F71E3]" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedExtPage ? 'Copied!' : 'Copy chrome://extensions'}</span>
                  </button>
                </li>
              </ol>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <label className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-medium rounded-full border border-black/15 dark:border-white/15 bg-white dark:bg-[#070708] text-[#0A0A0C] dark:text-white hover:border-[#2F71E3] cursor-pointer whitespace-nowrap shrink-0">
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
                    text: err instanceof Error ? err.message : 'Failed to download El Dorado Extension ZIP.',
                  });
                } finally {
                  setDownloadingExt(false);
                }
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-medium rounded-full bg-[#2F75C3] dark:bg-[#2F71E3] text-white hover:opacity-90 disabled:opacity-60 transition-opacity whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>{downloadingExt ? 'Building Verified ZIP...' : 'Download El Dorado Extension (.zip)'}</span>
            </button>
          </div>
        </div>

        {logoStatus && (
          <div
            role="status"
            className={`mt-4 rounded-xl border px-3.5 py-2.5 text-xs ${
              logoStatus.ok
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                : 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300'
            }`}
          >
            {logoStatus.text}
          </div>
        )}
      </section>

      {/* Whole-Laptop Desktop Assistant Card (Home Screen + Every App) */}
      <section className="rounded-2xl border border-black/10 dark:border-white/[0.08] bg-[#F7F8FA] dark:bg-[#0D0D10] p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl border border-black/10 dark:border-white/10 bg-[#070708] flex items-center justify-center shrink-0">
              <Laptop className="w-8 h-8 text-[#2F71E3]" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[#0A0A0C] dark:text-white">
                El Dorado Universal Laptop + Chrome Bundle (Home Screen &amp; All Apps)
              </h2>
              <p className="text-xs text-[#5F6368] dark:text-neutral-400 mt-1 max-w-2xl leading-relaxed">
                Includes <strong>both</strong> the El Dorado Chrome Extension v1.5.1 (<code className="font-mono">manifest.json</code>) <strong>and</strong> the Windows/Mac/Linux Python Desktop Companion (<code className="font-mono">el_dorado_companion.py</code>). Press{' '}
                <kbd className="font-mono px-1.5 py-0.5 rounded border border-black/10 dark:border-white/15 text-[#0A0A0C] dark:text-white">
                  Alt+D+T
                </kbd>{' '}
                in Chrome tabs AND on your Windows Desktop Home Screen!
              </p>
              <ol className="mt-3 text-xs text-[#5F6368] dark:text-neutral-300 space-y-1 list-decimal list-inside">
                <li>
                  Click <strong>Download Desktop Assistant (.zip)</strong> and extract it (Right-click &rarr; <strong>Extract All</strong>).
                </li>
                <li>
                  In Chrome: <code className="font-mono">chrome://extensions</code> &rarr; <strong>Load unpacked</strong> &rarr; select the extracted folder.
                </li>
                <li>
                  For Windows Home Screen &amp; outside Chrome: run <code className="font-mono">python el_dorado_companion.py</code> in that folder and press <kbd className="font-mono px-1.5 py-0.5 rounded border border-black/10 dark:border-white/15">Alt+D+T</kbd> anywhere!
                </li>
              </ol>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText('python el_dorado_companion.py');
                  setCopiedCmd(true);
                  setTimeout(() => setCopiedCmd(false), 1800);
                } catch {
                  // Ignore clipboard restrictions
                }
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium rounded-full border border-black/15 dark:border-white/15 bg-white dark:bg-[#070708] text-[#0A0A0C] dark:text-white hover:border-[#2F71E3] whitespace-nowrap shrink-0 cursor-pointer"
            >
              {copiedCmd ? <Check className="w-3.5 h-3.5 text-[#2F71E3]" /> : <Copy className="w-3.5 h-3.5" />}
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
                    text: `Downloaded ${info.filename} (${Math.round(info.byteLength / 1024)} KB, verified ZIP). Extract All -> Load unpacked in chrome://extensions AND run python el_dorado_companion.py for Desktop Home Screen!`,
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
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-medium rounded-full bg-[#0A0A0C] text-white dark:bg-white dark:text-[#070708] hover:opacity-90 disabled:opacity-60 transition-opacity whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>{downloadingDesk ? 'Building Verified ZIP...' : 'Download Desktop Assistant (.zip)'}</span>
            </button>
          </div>
        </div>

        {desktopStatus && (
          <div
            role="status"
            className={`mt-4 rounded-xl border px-3.5 py-2.5 text-xs ${
              desktopStatus.ok
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                : 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300'
            }`}
          >
            {desktopStatus.text}
          </div>
        )}
      </section>

      {mode === 'guides' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <aside className="lg:col-span-4 rounded-2xl border border-black/10 dark:border-white/[0.08] bg-[#F7F8FA] dark:bg-[#0D0D10] p-3">
            <div className="text-xs font-semibold text-[#5F6368] dark:text-neutral-400 px-2 py-1.5">
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
                    className={`w-full text-left px-3 py-2 text-xs rounded-xl transition-colors cursor-pointer ${
                      active
                        ? 'bg-[#2F75C3]/15 dark:bg-[#2F71E3]/20 text-[#2F75C3] dark:text-[#93C5FD] font-semibold'
                        : 'text-[#5F6368] dark:text-neutral-300 hover:bg-black/5 dark:hover:bg-white/5'
                    }`}
                  >
                    {doc.title}
                  </button>
                );
              })}
            </div>
          </aside>

          <article className="lg:col-span-8 rounded-2xl border border-black/10 dark:border-white/[0.08] bg-[#F7F8FA] dark:bg-[#0D0D10] p-6">
            {currentDoc ? (
              <>
                <div className="flex items-center justify-between gap-4 pb-3 border-b border-black/10 dark:border-white/[0.08]">
                  <h2 className="text-base font-semibold text-[#0A0A0C] dark:text-white">
                    {currentDoc.name}
                  </h2>
                  <button
                    type="button"
                    onClick={() => void handleCopy(currentDoc.content)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-full border border-black/15 dark:border-white/15 text-[#0A0A0C] dark:text-white hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied' : 'Copy Markdown'}</span>
                  </button>
                </div>
                <pre className="mt-4 whitespace-pre-wrap font-sans text-sm leading-relaxed text-[#0A0A0C] dark:text-neutral-200">
                  {currentDoc.content}
                </pre>
              </>
            ) : (
              <p className="text-sm text-[#5F6368] dark:text-neutral-400">Loading guides...</p>
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
                className={`px-3.5 py-1.5 text-xs font-medium rounded-full transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  selectedPlatform === p.id
                    ? 'bg-[#0A0A0C] text-white dark:bg-white dark:text-[#070708]'
                    : 'bg-[#F7F8FA] dark:bg-[#0D0D10] border border-black/10 dark:border-white/[0.08] text-[#5F6368] dark:text-neutral-300'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <aside className="lg:col-span-4 rounded-2xl border border-black/10 dark:border-white/[0.08] bg-[#F7F8FA] dark:bg-[#0D0D10] p-3">
              <div className="text-xs font-semibold text-[#5F6368] dark:text-neutral-400 px-2 py-1.5">
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
                      className={`w-full text-left px-3 py-2 text-xs font-mono rounded-xl transition-colors truncate cursor-pointer ${
                        active
                          ? 'bg-[#2F75C3]/15 dark:bg-[#2F71E3]/20 text-[#2F75C3] dark:text-[#93C5FD] font-semibold'
                          : 'text-[#5F6368] dark:text-neutral-300 hover:bg-black/5 dark:hover:bg-white/5'
                      }`}
                    >
                      {file.path.replace(`platforms/${selectedPlatform}/`, '')}
                    </button>
                  );
                })}
              </div>
            </aside>

            <div className="lg:col-span-8 rounded-2xl border border-black/10 dark:border-white/[0.08] bg-[#F7F8FA] dark:bg-[#0D0D10] p-5">
              {currentFile ? (
                <>
                  <div className="flex items-center justify-between gap-4 pb-3 border-b border-black/10 dark:border-white/[0.08]">
                    <code className="text-xs font-mono text-[#5F6368] dark:text-neutral-300">
                      {currentFile.path}
                    </code>
                    <button
                      type="button"
                      onClick={() => void handleCopy(currentFile.content)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-full border border-black/15 dark:border-white/15 text-[#0A0A0C] dark:text-white hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
                    >
                      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? 'Copied' : 'Copy Code'}</span>
                    </button>
                  </div>
                  <pre className="mt-4 p-4 rounded-xl bg-white dark:bg-[#070708] border border-black/10 dark:border-white/[0.08] text-xs font-mono text-[#0A0A0C] dark:text-neutral-200 overflow-x-auto max-h-[540px]">
                    {currentFile.content}
                  </pre>
                </>
              ) : (
                <p className="text-sm text-[#5F6368] dark:text-neutral-400">Loading source files...</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
