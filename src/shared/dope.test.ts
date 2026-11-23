import test from 'node:test';
import assert from 'node:assert/strict';
import { validateDopeAction, type ActiveViewerContext } from './actions';
import { detectWakeWord, parseOfflineCommand } from './wakeword';

const webContext: ActiveViewerContext = {
  platform: 'web',
  companion_connected: false,
  extension_connected: false,
  active_app: 'DOPE Web Console',
  active_window_title: 'DOPE PDF Testbench',
  pdf_viewer_type: 'browser_pdf_testbench',
};

const windowsConnectedContext: ActiveViewerContext = {
  platform: 'windows',
  companion_connected: true,
  extension_connected: true,
  active_app: 'Adobe Acrobat',
  active_window_title: 'Architecture.pdf',
  pdf_viewer_type: 'adobe_acrobat',
};

test('TEST 1: Wake word detection & open YouTube', () => {
  const wake = detectWakeWord('Hey Dop, open YouTube.');
  assert.equal(wake.detected, true);
  assert.equal(wake.command_text, 'open YouTube.');

  const parsed = parseOfflineCommand('Hey Dop, open YouTube.', webContext);
  assert.equal(parsed.matched, true);
  assert.equal(parsed.supported, true);
  assert.equal(parsed.action?.action, 'open_url');
  assert.equal(parsed.action?.target, 'https://www.youtube.com');
  assert.equal(parsed.action?.requires_confirmation, false);
});

test('TEST 2 & 3 & 4: PDF scroll down, zoom in, and go to page 15', () => {
  const scroll = parseOfflineCommand('Hey Dop, scroll down.', webContext);
  assert.equal(scroll.action?.action, 'scroll');
  assert.equal(scroll.action?.parameters?.direction, 'down');
  assert.equal(scroll.supported, true);

  const zoom = parseOfflineCommand('Hey Dop, zoom in.', webContext);
  assert.equal(zoom.action?.action, 'zoom');
  assert.equal(zoom.action?.parameters?.direction, 'in');
  assert.equal(zoom.supported, true);

  const page15 = parseOfflineCommand('Hey Dop, go to page 15.', webContext);
  assert.equal(page15.action?.action, 'pdf_navigate_page');
  assert.equal(page15.action?.parameters?.page, 15);
  assert.equal(page15.supported, true);
});

test('TEST 4b: Unsupported PDF viewer honestly rejects page navigation', () => {
  const unsupportedCtx: ActiveViewerContext = {
    ...webContext,
    pdf_viewer_type: 'unsupported_viewer',
  };
  const page15 = parseOfflineCommand('Hey Dop, go to page 15.', unsupportedCtx);
  assert.equal(page15.supported, false);
  assert.match(page15.unsupported_reason ?? '', /does not expose page-jump controls/i);
});

test('TEST 5 & 6: Desktop window minimize & Chrome launch require connected Desktop Companion', () => {
  const minOffline = parseOfflineCommand('Hey Dop, minimize this window.', {
    ...windowsConnectedContext,
    companion_connected: false,
  });
  assert.equal(minOffline.supported, false);
  assert.match(minOffline.unsupported_reason ?? '', /Desktop Companion is not connected/i);

  const minOnline = parseOfflineCommand('Hey Dop, minimize this window.', windowsConnectedContext);
  assert.equal(minOnline.supported, true);
  assert.equal(minOnline.action?.action, 'minimize_window');

  const chromeOnline = parseOfflineCommand('Hey Dop, open Chrome.', windowsConnectedContext);
  assert.equal(chromeOnline.supported, true);
  assert.equal(chromeOnline.action?.action, 'open_app');
  assert.equal(chromeOnline.action?.target, 'Chrome');
});

test('TEST 7: Stop listening command works cleanly', () => {
  const stop = parseOfflineCommand('Hey Dop, stop listening.', webContext);
  assert.equal(stop.matched, true);
  assert.equal(stop.action?.action, 'stop_listening');
  assert.equal(stop.supported, true);
});

test('TEST 9: Ambiguous command triggers clarification request', () => {
  const ambiguous = parseOfflineCommand('Hey Dop, open', webContext);
  assert.equal(ambiguous.ambiguous, true);
  assert.equal(ambiguous.action?.action, 'clarify');
  assert.ok(ambiguous.clarification_question);
});

test('TEST 10: Consequential actions always enforce confirmation', () => {
  const email = parseOfflineCommand(
    'Hey Dop, send an email to alex@example.com saying Hello',
    webContext
  );
  assert.equal(email.action?.action, 'send_email');
  assert.equal(email.action?.requires_confirmation, true);

  const forcedConfirm = validateDopeAction(
    {
      action: 'delete_file',
      target: 'report.pdf',
      platform: 'windows',
      requires_confirmation: false,
    },
    windowsConnectedContext
  );
  assert.equal(forcedConfirm.action.requires_confirmation, true);
});

test('TEST 12: Platform limitations (iOS window minimize & Linux Wayland) are reported honestly', () => {
  const iosCheck = validateDopeAction(
    { action: 'minimize_window', platform: 'ios', requires_confirmation: false },
    { ...webContext, platform: 'ios' }
  );
  assert.equal(iosCheck.supported, false);
  assert.match(iosCheck.reason ?? '', /not supported on ios/i);

  const waylandCheck = validateDopeAction(
    { action: 'switch_window', platform: 'linux', requires_confirmation: false },
    { ...windowsConnectedContext, platform: 'linux', linux_display_server: 'wayland' }
  );
  assert.equal(waylandCheck.supported, false);
  assert.match(waylandCheck.reason ?? '', /Wayland/i);
});

test('Security: Blocks unsafe URL schemes and unlisted actions', () => {
  const xssUrl = validateDopeAction(
    { action: 'open_url', target: 'javascript:alert(1)', platform: 'web', requires_confirmation: false },
    webContext
  );
  assert.equal(xssUrl.valid, false);
  assert.equal(xssUrl.supported, false);

  const arbitraryShell = validateDopeAction(
    { action: 'exec_shell' as never, target: 'rm -rf /', platform: 'windows', requires_confirmation: false },
    windowsConnectedContext
  );
  assert.equal(arbitraryShell.valid, false);
});

test('Multilingual Hinglish & Custom Alias support', () => {
  const hinglish = parseOfflineCommand('Hey Dop, YouTube chalao', webContext);
  assert.equal(hinglish.action?.action, 'open_url');
  assert.equal(hinglish.action?.target, 'https://www.youtube.com');

  const customAlias = parseOfflineCommand('Hey Dop, study mode', webContext, [
    {
      id: 'a1',
      phrase: 'study mode',
      action: 'open_url',
      target: 'https://www.wikipedia.org',
      created_at: new Date().toISOString(),
    },
  ]);
  assert.equal(customAlias.action?.action, 'open_url');
  assert.equal(customAlias.action?.target, 'https://www.wikipedia.org');
});

test('Chrome Extension ZIP bundle, Alt+D shortcut & new Chrome commands', async () => {
  const { buildExtensionBundleZip, saveCustomExtensionIcons } = await import(
    '../../server/extensionZip'
  );
  const { default: JSZip } = await import('jszip');
  const zipBuf = await buildExtensionBundleZip('https://example.dope.local');
  assert.equal(zipBuf.subarray(0, 4).toString('hex'), '504b0304'); // PK\x03\x04

  const parsedZip = await JSZip.loadAsync(zipBuf);
  assert.ok(parsedZip.file('manifest.json'), 'manifest.json must be at ZIP root');
  assert.ok(parsedZip.file('sidepanel.html'), 'sidepanel.html must be at ZIP root');
  assert.ok(parsedZip.file('hotkey_content.js'), 'hotkey_content.js must be bundled');
  assert.ok(parsedZip.file('icons/icon128.png'), 'icons/icon128.png must exist');
  const manifestJson = JSON.parse(await parsedZip.file('manifest.json')!.async('string'));
  assert.equal(manifestJson.manifest_version, 3);
  assert.equal(manifestJson.commands['activate-dope'].suggested_key.default, 'Alt+D');
  const bgJs = await parsedZip.file('background.js')!.async('string');
  assert.ok(bgJs.includes('https://example.dope.local'));

  const newTabCmd = parseOfflineCommand('Hey Dop, naya tab kholo', {
    ...webContext,
    platform: 'browser_extension',
    extension_connected: true,
  });
  assert.equal(newTabCmd.action?.action, 'new_tab');
  assert.equal(newTabCmd.supported, true);

  const ytSearch = parseOfflineCommand('Hey Dop, YouTube pe lofi music chalao', {
    ...webContext,
    platform: 'browser_extension',
    extension_connected: true,
  });
  assert.equal(ytSearch.action?.action, 'open_url');
  assert.match(ytSearch.action?.target ?? '', /youtube\.com\/results\?search_query=lofi/);

  const rejected = saveCustomExtensionIcons({
    icon16: 'data:text/plain;base64,SGVsbG8=',
    icon48: 'data:image/png;base64,AAAA',
    icon128: 'invalid',
  });
  assert.equal(rejected, false);
});

test('AI Q&A offline fallback (math, time, date, identity) & Desktop Assistant ZIP bundle', async () => {
  const mathCmd = parseOfflineCommand('Hey Dop, what is 25 * 48?', webContext);
  assert.equal(mathCmd.matched, true);
  assert.equal(mathCmd.supported, true);
  assert.equal(mathCmd.action?.action, 'answer_question');
  assert.match(mathCmd.spoken_response, /1200/);

  const hinglishMath = parseOfflineCommand('Hey Dop, 100 + 250 kitna hota hai?', webContext);
  assert.equal(hinglishMath.matched, true);
  assert.equal(hinglishMath.action?.action, 'answer_question');
  assert.match(hinglishMath.spoken_response, /350/);

  const timeCmd = parseOfflineCommand('Hey Dop, time kya hua hai?', webContext);
  assert.equal(timeCmd.matched, true);
  assert.equal(timeCmd.action?.action, 'answer_question');
  assert.ok(timeCmd.spoken_response.length > 5);

  const identityCmd = parseOfflineCommand('Hey Dop, who are you?', webContext);
  assert.equal(identityCmd.matched, true);
  assert.equal(identityCmd.action?.action, 'answer_question');
  assert.match(identityCmd.spoken_response, /DOPE/);

  const { buildDesktopBundleZip } = await import('../../server/desktopZip');
  const { default: JSZip } = await import('jszip');
  const desktopBuf = await buildDesktopBundleZip('https://example.dope.local');
  assert.equal(desktopBuf.subarray(0, 4).toString('hex'), '504b0304');

  const parsedDesktop = await JSZip.loadAsync(desktopBuf);
  assert.ok(parsedDesktop.file('manifest.json'), 'manifest.json must be in Desktop ZIP so Chrome Load unpacked also succeeds');
  assert.ok(parsedDesktop.file('icons/icon128.png'), 'icons/icon128.png must be in Desktop ZIP');
  assert.ok(parsedDesktop.file('dope_companion.py'), 'dope_companion.py must be in desktop ZIP');
  assert.ok(parsedDesktop.file('INSTALL_DESKTOP.txt'), 'INSTALL_DESKTOP.txt must be in desktop ZIP');
  assert.equal(parsedDesktop.file('Run-DOPE-Desktop.bat'), null, 'No .bat scripts inside ZIP so Chrome Safe Browsing does not block download');
  assert.equal(parsedDesktop.file('adapters/__init__.py'), null, 'No _-prefixed files so Chrome Load unpacked accepts the folder');
  assert.ok(parsedDesktop.file('adapters/windows_adapter.py'), 'windows_adapter.py must be in desktop ZIP');
  const pyCode = await parsedDesktop.file('dope_companion.py')!.async('string');
  assert.ok(pyCode.includes('https://example.dope.local'));
  assert.ok(pyCode.includes('alt+d+t'));
  assert.ok(pyCode.includes('bootstrap_dependencies'));
  assert.ok(pyCode.includes('dont_write_bytecode'));
});

