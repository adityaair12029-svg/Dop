import JSZip from 'jszip';
import { BUNDLED_PLATFORM_FILES } from './vercelLocalEngine';

const CUSTOM_LOGO_STORAGE_KEY = 'el_dorado_custom_extension_icons_v1';

interface CustomLogoSet {
  icon16: string;
  icon48: string;
  icon128: string;
}

export function saveLocalCustomLogo(icons: CustomLogoSet): void {
  try {
    localStorage.setItem(CUSTOM_LOGO_STORAGE_KEY, JSON.stringify(icons));
  } catch {
    // Ignore storage limits
  }
}

export function loadLocalCustomLogo(): CustomLogoSet | null {
  try {
    const raw = localStorage.getItem(CUSTOM_LOGO_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CustomLogoSet>;
    if (parsed.icon16 && parsed.icon48 && parsed.icon128) {
      return parsed as CustomLogoSet;
    }
    return null;
  } catch {
    return null;
  }
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function dataUrlToBytes(dataUrl: string): Uint8Array | null {
  const match = dataUrl.match(/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return null;
  const bin = atob(match[1]);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function renderDefaultOrbIconBytes(size: number): Uint8Array | null {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#070708';
    ctx.beginPath();
    ctx.roundRect(0, 0, size, size, size * 0.22);
    ctx.fill();

    // Stylized geometric prism / gateway mark in El Dorado royal blue + white
    ctx.strokeStyle = '#2F71E3';
    ctx.lineWidth = Math.max(1.5, size * 0.11);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(size * 0.24, size * 0.78);
    ctx.lineTo(size * 0.5, size * 0.22);
    ctx.lineTo(size * 0.76, size * 0.78);
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(size * 0.5, size * 0.54, size * 0.085, 0, Math.PI * 2);
    ctx.fill();

    return dataUrlToBytes(canvas.toDataURL('image/png'));
  } catch {
    return null;
  }
}

async function resizeBlobToPngBytes(blob: Blob, size: number): Promise<Uint8Array | null> {
  try {
    const bmp = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(bmp, 0, 0, size, size);
    const pngBlob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/png')
    );
    if (!pngBlob) return null;
    return new Uint8Array(await pngBlob.arrayBuffer());
  } catch {
    return null;
  }
}

async function addExtensionFilesToZip(
  zip: JSZip,
  allFiles: Array<{ platform: string; path: string; content: string }>,
  origin: string
): Promise<void> {
  const extFiles = allFiles.filter((f) => f.path.startsWith('platforms/browser-extension/'));
  for (const file of extFiles) {
    const rel = file.path.replace(/^platforms\/browser-extension\//, '');
    if (!rel || rel.endsWith('.md') || rel.startsWith('_')) continue;
    let content = file.content;
    if (rel === 'background.js') {
      content = content.replace('__DOPE_SERVER_URL__', origin);
    }
    zip.file(rel, content);
  }

  const iconsFolder = zip.folder('icons');
  if (!iconsFolder) return;

  const localCustom = loadLocalCustomLogo();
  if (localCustom) {
    const b16 = dataUrlToBytes(localCustom.icon16);
    const b48 = dataUrlToBytes(localCustom.icon48);
    const b128 = dataUrlToBytes(localCustom.icon128);
    if (b16 && b48 && b128) {
      iconsFolder.file('icon16.png', b16);
      iconsFolder.file('icon48.png', b48);
      iconsFolder.file('icon128.png', b128);
      iconsFolder.file('logo-white.png', b128);
      return;
    }
  }

  // Always include monochrome A-chevron emblem for popup/HUD fallback
  const whiteRes = await fetch('/downloads/el-dorado-logo-white.png', { cache: 'no-store' }).catch(() => null);
  if (whiteRes && whiteRes.ok && (whiteRes.headers.get('content-type') || '').includes('image')) {
    const whiteBuf = new Uint8Array(await whiteRes.arrayBuffer());
    if (whiteBuf.length > 0) {
      iconsFolder.file('logo-white.png', whiteBuf);
    }
  }

  const iconCandidates = ['/api/dope/extension/icon.png', '/downloads/el-dorado-icon-128.png'];
  for (const candidate of iconCandidates) {
    const iconRes = await fetch(candidate, { cache: 'no-store' }).catch(() => null);
    if (iconRes && iconRes.ok && (iconRes.headers.get('content-type') || '').includes('image')) {
      const iconBlob = await iconRes.blob();
      for (const size of [16, 48, 128] as const) {
        const png = await resizeBlobToPngBytes(iconBlob, size);
        if (png) iconsFolder.file(`icon${size}.png`, png);
      }
      return;
    }
  }

  // Pure canvas PNG fallback so icon files ALWAYS exist even completely offline
  for (const size of [16, 48, 128] as const) {
    const fallbackBytes = renderDefaultOrbIconBytes(size);
    if (fallbackBytes) {
      iconsFolder.file(`icon${size}.png`, fallbackBytes);
      if (size === 128) iconsFolder.file('logo-white.png', fallbackBytes);
    }
  }
}

async function buildClientBundledZip(kind: 'extension' | 'desktop', origin: string): Promise<Blob> {
  let allFiles = BUNDLED_PLATFORM_FILES;
  try {
    const res = await fetch('/api/dope/platform-files', { cache: 'no-store' });
    if (res.ok && (res.headers.get('content-type') || '').includes('application/json')) {
      const data = (await res.json()) as {
        files?: Array<{ platform: string; path: string; content: string }>;
      };
      if (data.files && data.files.length > 0) {
        allFiles = data.files;
      }
    }
  } catch {
    // Use Vite-bundled ?raw files directly (works 100% on Vercel static hosting)
  }

  const zip = new JSZip();
  await addExtensionFilesToZip(zip, allFiles, origin);

  if (kind === 'desktop') {
    const deskFiles = allFiles.filter((f) => f.path.startsWith('platforms/desktop-companion/'));
    for (const file of deskFiles) {
      const rel = file.path.replace(/^platforms\/desktop-companion\//, '');
      if (!rel || rel.endsWith('.bat') || rel.endsWith('.sh') || rel.includes('/_')) continue;
      let content = file.content;
      if (rel === 'el_dorado_companion.py') {
        content = content.replace('__DOPE_SERVER_URL__', origin);
      }
      zip.file(rel, content);
    }
    zip.file(
      'INSTALL_DESKTOP.txt',
      `El Dorado Universal Package (Chrome Extension + Laptop Desktop Assistant)\n1. Chrome: Extract All -> chrome://extensions -> Developer mode ON -> Load unpacked -> select this folder.\n2. Whole Laptop: run python el_dorado_companion.py in this folder -> press Alt+D+T anywhere.\nBackend: ${origin}\n`
    );
  } else {
    zip.file(
      'INSTALL.txt',
      `El Dorado Chrome & Edge Extension (Manifest V3)\nExtract All -> chrome://extensions -> Developer mode ON -> Load unpacked -> select this folder.\nPress Alt+D+T (or say "Hey El Dorado") anywhere in Chrome!\nBackend: ${origin}\n`
    );
  }

  return zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
    platform: 'DOS',
  });
}

async function fetchAndVerifyZipUrl(url: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const bytes = new Uint8Array(buf);
    if (bytes.length > 200 && bytes[0] === 0x50 && bytes[1] === 0x4b) {
      await JSZip.loadAsync(buf);
      return bytes;
    }
    return null;
  } catch {
    return null;
  }
}

export async function downloadVerifiedZip(options: {
  kind: 'extension' | 'desktop';
  cacheBust?: number;
}): Promise<{ filename: string; byteLength: number; source: 'server' | 'static_cdn' | 'client_rebuild' }> {
  const filename =
    options.kind === 'extension'
      ? 'El-Dorado-Chrome-Extension.zip'
      : 'El-Dorado-Desktop-Assistant.zip';

  const hasLocalCustomLogo = Boolean(loadLocalCustomLogo());

  // Layer 1: Express dynamic ZIP endpoint (honors uploaded custom logos in live server mode)
  const apiEndpoint =
    options.kind === 'extension'
      ? `/api/dope/extension.zip${options.cacheBust ? `?v=${options.cacheBust}` : ''}`
      : '/api/dope/desktop.zip';

  const apiBytes = await fetchAndVerifyZipUrl(apiEndpoint);
  if (apiBytes) {
    const blob = new Blob([apiBytes.slice().buffer], { type: 'application/zip' });
    triggerBlobDownload(blob, filename);
    return { filename, byteLength: apiBytes.length, source: 'server' };
  }

  // Layer 2: Prebuilt static Vercel CDN ZIPs (fast instant download with zero backend needed!)
  if (!hasLocalCustomLogo) {
    const staticEndpoint =
      options.kind === 'extension'
        ? '/downloads/El-Dorado-Chrome-Extension.zip'
        : '/downloads/El-Dorado-Desktop-Assistant.zip';
    const staticBytes = await fetchAndVerifyZipUrl(staticEndpoint);
    if (staticBytes) {
      const blob = new Blob([staticBytes.slice().buffer], { type: 'application/zip' });
      triggerBlobDownload(blob, filename);
      return { filename, byteLength: staticBytes.length, source: 'static_cdn' };
    }
  }

  // Layer 3: Pure client-side JSZip bundle built directly from Vite-bundled platform files
  const origin = window.location.origin;
  const fallbackBlob = await buildClientBundledZip(options.kind, origin);
  await JSZip.loadAsync(fallbackBlob);
  triggerBlobDownload(fallbackBlob, filename);
  return { filename, byteLength: fallbackBlob.size, source: 'client_rebuild' };
}
