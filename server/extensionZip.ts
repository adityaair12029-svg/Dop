import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const CUSTOM_ICON_DIR = path.resolve(process.cwd(), '.dope-data', 'custom-icons');
const DEFAULT_EXT_DIR = path.resolve(process.cwd(), 'platforms', 'browser-extension');

export function saveCustomExtensionIcons(icons: {
  icon16: string;
  icon48: string;
  icon128: string;
}): boolean {
  const map: Array<[string, string]> = [
    ['icon16.png', icons.icon16],
    ['icon48.png', icons.icon48],
    ['icon128.png', icons.icon128],
  ];

  const buffers: Array<[string, Buffer]> = [];
  for (const [filename, dataUrl] of map) {
    const match = String(dataUrl).match(/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/);
    if (!match) return false;
    const buf = Buffer.from(match[1], 'base64');
    if (buf.length < 24 || buf.length > 512 * 1024 || !buf.subarray(0, 8).equals(PNG_MAGIC)) {
      return false;
    }
    buffers.push([filename, buf]);
  }

  fs.mkdirSync(CUSTOM_ICON_DIR, { recursive: true });
  for (const [filename, buf] of buffers) {
    fs.writeFileSync(path.join(CUSTOM_ICON_DIR, filename), buf);
  }
  return true;
}

export function getActiveIconBuffer(size: 16 | 48 | 128): Buffer | null {
  const filename = `icon${size}.png`;
  const customPath = path.join(CUSTOM_ICON_DIR, filename);
  if (fs.existsSync(customPath)) {
    return fs.readFileSync(customPath);
  }
  const defaultPath = path.join(DEFAULT_EXT_DIR, 'icons', filename);
  if (fs.existsSync(defaultPath)) {
    return fs.readFileSync(defaultPath);
  }
  return null;
}

export async function buildExtensionBundleZip(serverOrigin: string): Promise<Buffer> {
  const zip = new JSZip();
  const safeOrigin = /^https?:\/\/[^\s'"]+$/i.test(serverOrigin)
    ? serverOrigin
    : 'http://localhost:3000';

  const textFiles = [
    'manifest.json',
    'background.js',
    'hotkey_content.js',
    'popup.html',
    'sidepanel.html',
    'ui.css',
    'ui.js',
    'native_messaging_host.json',
  ];

  // Place manifest.json and all extension files at the ZIP root so
  // Windows "Extract All..." and macOS Archive Utility produce a single
  // folder directly containing manifest.json (no double-nested folder error).
  for (const file of textFiles) {
    const full = path.join(DEFAULT_EXT_DIR, file);
    if (!fs.existsSync(full)) continue;
    let content = fs.readFileSync(full, 'utf-8');
    if (file === 'background.js') {
      content = content.replace('__DOPE_SERVER_URL__', safeOrigin);
    }
    zip.file(file, content);
  }

  const iconsFolder = zip.folder('icons');
  for (const size of [16, 48, 128] as const) {
    const buf = getActiveIconBuffer(size);
    if (buf && iconsFolder) {
      iconsFolder.file(`icon${size}.png`, buf);
    }
  }

  const readme = `El Dorado Chrome & Microsoft Edge Extension (Manifest V3)
====================================================
IMPORTANT: Do NOT drag this .zip file directly onto chrome://extensions.
Chrome treats unextracted .zip files as invalid CRX packages.

How to install in 30 seconds:
1. Extract this ZIP file completely (Windows: Right-click -> Extract All...).
2. Open chrome://extensions (or edge://extensions).
3. Turn ON "Developer mode" (top-right toggle).
4. Click "Load unpacked" and select the extracted folder containing manifest.json.
5. Pin "El Dorado Assistant" to your toolbar or press Alt+D+T (or Alt+D) on any Chrome tab to activate voice + chimes!
6. Want Alt+D+T on your Laptop Home Screen / outside Chrome too? Download El-Dorado-Desktop-Assistant.zip from the Platforms tab!

Default El Dorado Backend URL: ${safeOrigin}
`;
  zip.file('INSTALL.txt', readme);

  return zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
    platform: 'DOS',
  });
}
