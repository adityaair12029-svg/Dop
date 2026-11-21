import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';

const DESKTOP_DIR = path.resolve(process.cwd(), 'platforms', 'desktop-companion');

export async function buildDesktopBundleZip(serverOrigin: string): Promise<Buffer> {
  const zip = new JSZip();
  const safeOrigin = /^https?:\/\/[^\s'"]+$/i.test(serverOrigin)
    ? serverOrigin
    : 'http://localhost:3000';

  const rootFiles = [
    'dope_companion.py',
    'wake_word_engine.py',
    'requirements.txt',
    'Run-DOPE-Desktop.bat',
    'run_dope_desktop.sh',
  ];

  for (const file of rootFiles) {
    const full = path.join(DESKTOP_DIR, file);
    if (!fs.existsSync(full)) continue;
    let content = fs.readFileSync(full, 'utf-8');
    if (file === 'dope_companion.py') {
      content = content.replace('__DOPE_SERVER_URL__', safeOrigin);
    }
    zip.file(file, content);
  }

  const adaptersDir = path.join(DESKTOP_DIR, 'adapters');
  const adaptersFolder = zip.folder('adapters');
  if (fs.existsSync(adaptersDir) && adaptersFolder) {
    const initFile = path.join(adaptersDir, '__init__.py');
    if (!fs.existsSync(initFile)) {
      adaptersFolder.file('__init__.py', '');
    }
    for (const item of fs.readdirSync(adaptersDir)) {
      if (item.endsWith('.py')) {
        adaptersFolder.file(item, fs.readFileSync(path.join(adaptersDir, item), 'utf-8'));
      }
    }
  }

  const readme = `DOPE Whole-Laptop Desktop Assistant (Windows / macOS / Linux)
==================================================================
Why this Desktop App?
Browser extensions (Chrome/Edge) are sandboxed inside browser tabs by Windows/macOS.
To use Alt + D + T on your Laptop Home Screen, File Explorer, VS Code, or when Chrome
is closed, run this lightweight DOPE Desktop Assistant.

Quick Start (Windows 10 / 11):
1. Extract this ZIP completely (Right-click -> Extract All...).
2. Double-click "Run-DOPE-Desktop.bat".
   (First launch installs Python dependencies automatically in a local .venv folder.)
3. Press Alt + D + T anywhere on your laptop — you'll hear a sweet activation chime,
   and DOPE listens on your laptop mic to answer any AI question or control apps/windows!

Quick Start (macOS / Linux):
1. Extract this ZIP.
2. Run: chmod +x run_dope_desktop.sh && ./run_dope_desktop.sh

Configured DOPE AI Backend URL: ${safeOrigin}
(You can override it anytime via DOPE_SERVER_URL environment variable.)
`;
  zip.file('INSTALL_DESKTOP.txt', readme);

  return zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
    platform: 'DOS',
  });
}
