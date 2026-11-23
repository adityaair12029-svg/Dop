import JSZip from 'jszip';

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

  const iconRes = await fetch('/api/dope/extension/icon.png', {
    credentials: 'include',
    cache: 'no-store',
  }).catch(() => null);
  if (iconRes && iconRes.ok) {
    const iconBlob = await iconRes.blob();
    const iconsFolder = zip.folder('icons');
    if (iconsFolder) {
      for (const size of [16, 48, 128] as const) {
        const png = await resizeBlobToPngBytes(iconBlob, size);
        if (png) iconsFolder.file(`icon${size}.png`, png);
      }
    }
  }
}

async function buildFallbackZipFromPlatformFiles(
  kind: 'extension' | 'desktop',
  origin: string
): Promise<Blob> {
  const res = await fetch('/api/dope/platform-files', {
    credentials: 'include',
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`Could not fetch bundle files (HTTP ${res.status}).`);
  }
  const data = (await res.json()) as {
    files?: Array<{ platform: string; path: string; content: string }>;
  };
  const allFiles = data.files ?? [];
  const zip = new JSZip();

  await addExtensionFilesToZip(zip, allFiles, origin);

  if (kind === 'desktop') {
    const deskFiles = allFiles.filter((f) => f.path.startsWith('platforms/desktop-companion/'));
    for (const file of deskFiles) {
      const rel = file.path.replace(/^platforms\/desktop-companion\//, '');
      if (!rel || rel.endsWith('.bat') || rel.endsWith('.sh') || rel.includes('/_')) continue;
      let content = file.content;
      if (rel === 'dope_companion.py') {
        content = content.replace('__DOPE_SERVER_URL__', origin);
      }
      zip.file(rel, content);
    }
    zip.file(
      'INSTALL_DESKTOP.txt',
      `DOPE Universal Package (Chrome Extension + Laptop Desktop Assistant)\n1. Chrome: Extract All -> chrome://extensions -> Load unpacked -> select this folder.\n2. Whole Laptop: run python dope_companion.py in this folder -> press Alt+D+T anywhere.\nBackend: ${origin}\n`
    );
  } else {
    zip.file(
      'INSTALL.txt',
      `DOPE Chrome & Edge Extension (Manifest V3)\nExtract All -> chrome://extensions -> Developer mode ON -> Load unpacked -> select this folder.\nBackend: ${origin}\n`
    );
  }

  return zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
    platform: 'DOS',
  });
}

export async function downloadVerifiedZip(options: {
  kind: 'extension' | 'desktop';
  cacheBust?: number;
}): Promise<{ filename: string; byteLength: number; source: 'server' | 'client_rebuild' }> {
  const filename =
    options.kind === 'extension' ? 'DOPE-Chrome-Extension.zip' : 'DOPE-Desktop-Assistant.zip';
  const endpoint =
    options.kind === 'extension'
      ? `/api/dope/extension.zip${options.cacheBust ? `?v=${options.cacheBust}` : ''}`
      : '/api/dope/desktop.zip';

  try {
    const res = await fetch(endpoint, {
      credentials: 'include',
      cache: 'no-store',
    });
    if (res.ok) {
      const buf = await res.arrayBuffer();
      const bytes = new Uint8Array(buf);
      if (bytes.length > 200 && bytes[0] === 0x50 && bytes[1] === 0x4b) {
        await JSZip.loadAsync(buf);
        const blob = new Blob([buf], { type: 'application/zip' });
        triggerBlobDownload(blob, filename);
        return { filename, byteLength: bytes.length, source: 'server' };
      }
    }
  } catch {
    // Fall through to client-side JSZip rebuild
  }

  const origin = window.location.origin;
  const fallbackBlob = await buildFallbackZipFromPlatformFiles(options.kind, origin);
  await JSZip.loadAsync(fallbackBlob);
  triggerBlobDownload(fallbackBlob, filename);
  return { filename, byteLength: fallbackBlob.size, source: 'client_rebuild' };
}
