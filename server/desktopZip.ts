import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import { getActiveIconBuffer } from './extensionZip';

const DESKTOP_DIR = path.resolve(process.cwd(), 'platforms', 'desktop-companion');
const EXT_DIR = path.resolve(process.cwd(), 'platforms', 'browser-extension');

export async function buildDesktopBundleZip(serverOrigin: string): Promise<Buffer> {
  const zip = new JSZip();
  const safeOrigin = /^https?:\/\/[^\s'"]+$/i.test(serverOrigin)
    ? serverOrigin
    : 'http://localhost:3000';

  // Include Chrome Extension MV3 files at ZIP root (without any `_`-prefixed files)
  // so `Load unpacked` in chrome://extensions ALSO succeeds cleanly if selected,
  // AND running `python el_dorado_companion.py` starts the Whole-Laptop Desktop Assistant!
  const extFiles = [
    'manifest.json',
    'background.js',
    'hotkey_content.js',
    'popup.html',
    'sidepanel.html',
    'ui.css',
    'ui.js',
    'native_messaging_host.json',
  ];

  for (const file of extFiles) {
    const full = path.join(EXT_DIR, file);
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
  if (iconsFolder) {
    const whitePath = path.join(EXT_DIR, 'icons', 'logo-white.png');
    if (fs.existsSync(whitePath)) {
      iconsFolder.file('logo-white.png', fs.readFileSync(whitePath));
    }
  }

  // Include ONLY .py and .txt desktop companion files (zero .bat/.sh executables
  // and zero `_`-prefixed files like __init__.py so both Chrome Safe Browsing and
  // chrome://extensions Load unpacked accept the folder cleanly).
  const rootFiles = ['el_dorado_companion.py', 'wake_word_engine.py', 'requirements.txt'];

  for (const file of rootFiles) {
    const full = path.join(DESKTOP_DIR, file);
    if (!fs.existsSync(full)) continue;
    let content = fs.readFileSync(full, 'utf-8');
    if (file === 'el_dorado_companion.py') {
      content = content.replace('__DOPE_SERVER_URL__', safeOrigin);
    }
    zip.file(file, content);
  }

  const adaptersDir = path.join(DESKTOP_DIR, 'adapters');
  const adaptersFolder = zip.folder('adapters');
  if (fs.existsSync(adaptersDir) && adaptersFolder) {
    for (const item of fs.readdirSync(adaptersDir)) {
      if (item.endsWith('.py') && !item.startsWith('_')) {
        adaptersFolder.file(item, fs.readFileSync(path.join(adaptersDir, item), 'utf-8'));
      }
    }
  }

  const readme = `El Dorado Universal Package (Chrome Extension v1.5 + Whole-Laptop Desktop Assistant)
==============================================================================
This folder contains BOTH:
1) Chrome & Microsoft Edge Extension (manifest.json):
   - Extract All -> open chrome://extensions -> Developer mode ON -> Load unpacked -> select this folder.
   - Press Alt + D + T on any Chrome tab or say "Hey El Dorado" for voice + AI Q&A + chimes!

2) Whole-Laptop Desktop Assistant (Windows Home Screen & All Apps):
   - Open Command Prompt / Terminal inside this extracted folder and run:
       python el_dorado_companion.py
   - First run auto-installs Python packages!
   - Then press Alt + D + T ANYWHERE on your laptop (Windows Home Screen, File Explorer,
     VS Code, or when Chrome is closed) for chimes, laptop mic, AI Q&A, and OS control!

Configured El Dorado AI Backend URL: ${safeOrigin}
`;
  zip.file('INSTALL_DESKTOP.txt', readme);

  return zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
    platform: 'DOS',
  });
}
