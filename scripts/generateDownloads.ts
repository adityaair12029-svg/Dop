import fs from 'node:fs';
import path from 'node:path';
import { buildExtensionBundleZip, getActiveIconBuffer } from '../server/extensionZip';
import { buildDesktopBundleZip } from '../server/desktopZip';

const DEFAULT_PUBLIC_ORIGIN =
  process.env.APP_URL?.trim().replace(/\/+$/, '') || 'https://dopextention.vercel.app';

async function main() {
  const outDir = path.resolve(process.cwd(), 'public', 'downloads');
  fs.mkdirSync(outDir, { recursive: true });

  const [extZip, deskZip] = await Promise.all([
    buildExtensionBundleZip(DEFAULT_PUBLIC_ORIGIN),
    buildDesktopBundleZip(DEFAULT_PUBLIC_ORIGIN),
  ]);

  const extPath = path.join(outDir, 'El-Dorado-Chrome-Extension.zip');
  const deskPath = path.join(outDir, 'El-Dorado-Desktop-Assistant.zip');
  fs.writeFileSync(extPath, extZip);
  fs.writeFileSync(deskPath, deskZip);

  const icon128 = getActiveIconBuffer(128);
  if (icon128) {
    fs.writeFileSync(path.join(outDir, 'el-dorado-icon-128.png'), icon128);
  }

  console.log(
    `[El Dorado] Built static Vercel downloads: ${path.basename(extPath)} (${extZip.length} B), ${path.basename(deskPath)} (${deskZip.length} B)`
  );
}

main().catch((err) => {
  console.error('[El Dorado] Failed generating static downloads:', err);
  process.exit(1);
});
