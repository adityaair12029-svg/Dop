import test from 'node:test';
import assert from 'node:assert/strict';
import { validateDopeAction, type ActiveViewerContext } from './actions';
import { detectWakeWord, parseOfflineCommand } from './wakeword';

const webContext: ActiveViewerContext = {
  platform: 'web',
  companion_connected: false,
  extension_connected: false,
  active_app: 'El Dorado Web Console',
  active_window_title: 'El Dorado PDF Testbench',
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

test('TEST 1: Wake word detection ("Hey El Dorado") & open YouTube', () => {
  const wake = detectWakeWord('Hey El Dorado, open YouTube.');
  assert.equal(wake.detected, true);
  assert.equal(wake.command_text, 'open YouTube.');

  const parsed = parseOfflineCommand('Hey El Dorado, open YouTube.', webContext);
  assert.equal(parsed.matched, true);
  assert.equal(parsed.supported, true);
  assert.equal(parsed.action?.action, 'open_url');
  assert.equal(parsed.action?.target, 'https://www.youtube.com');
  assert.equal(parsed.action?.requires_confirmation, false);
});

test('TEST 2 & 3 & 4: PDF scroll down, zoom in, and go to page 15', () => {
  const scroll = parseOfflineCommand('Hey El Dorado, scroll down.', webContext);
  assert.equal(scroll.action?.action, 'scroll');
  assert.equal(scroll.action?.parameters?.direction, 'down');
  assert.equal(scroll.supported, true);

  const zoom = parseOfflineCommand('Hey El Dorado, zoom in.', webContext);
  assert.equal(zoom.action?.action, 'zoom');
  assert.equal(zoom.action?.parameters?.direction, 'in');
  assert.equal(zoom.supported, true);

  const page15 = parseOfflineCommand('Hey El Dorado, go to page 15.', webContext);
  assert.equal(page15.action?.action, 'pdf_navigate_page');
  assert.equal(page15.action?.parameters?.page, 15);
  assert.equal(page15.supported, true);
});

test('TEST 4b: Unsupported PDF viewer honestly rejects page navigation', () => {
  const unsupportedCtx: ActiveViewerContext = {
    ...webContext,
    pdf_viewer_type: 'unsupported_viewer',
  };
  const page15 = parseOfflineCommand('Hey El Dorado, go to page 15.', unsupportedCtx);
  assert.equal(page15.supported, false);
  assert.match(page15.unsupported_reason ?? '', /does not expose page-jump controls/i);
});

test('TEST 5 & 6: Desktop window minimize & Chrome launch require connected Desktop Companion', () => {
  const minOffline = parseOfflineCommand('Hey El Dorado, minimize this window.', {
    ...windowsConnectedContext,
    companion_connected: false,
  });
  assert.equal(minOffline.supported, false);
  assert.match(minOffline.unsupported_reason ?? '', /Desktop Companion is not connected/i);

  const minOnline = parseOfflineCommand('Hey El Dorado, minimize this window.', windowsConnectedContext);
  assert.equal(minOnline.supported, true);
  assert.equal(minOnline.action?.action, 'minimize_window');

  const chromeOnline = parseOfflineCommand('Hey El Dorado, open Chrome.', windowsConnectedContext);
  assert.equal(chromeOnline.supported, true);
  assert.equal(chromeOnline.action?.action, 'open_app');
  assert.equal(chromeOnline.action?.target, 'Chrome');
});

test('TEST 7: Stop listening command works cleanly', () => {
  const stop = parseOfflineCommand('Hey El Dorado, stop listening.', webContext);
  assert.equal(stop.matched, true);
  assert.equal(stop.action?.action, 'stop_listening');
  assert.equal(stop.supported, true);
});

test('TEST 9: Ambiguous command triggers clarification request in English', () => {
  const ambiguous = parseOfflineCommand('Hey El Dorado, open', webContext);
  assert.equal(ambiguous.ambiguous, true);
  assert.equal(ambiguous.action?.action, 'clarify');
  assert.ok(ambiguous.clarification_question);
  assert.match(ambiguous.clarification_question ?? '', /ambiguous/i);

  const bareWake = parseOfflineCommand('Hey El Dorado', webContext);
  assert.equal(bareWake.ambiguous, true);
  assert.match(bareWake.clarification_question ?? '', /El Dorado/i);
});

test('TEST 10: Consequential actions always enforce confirmation', () => {
  const email = parseOfflineCommand(
    'Hey El Dorado, send an email to alex@example.com saying Hello',
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

test('Custom Alias & Legacy Wake Fallback support', () => {
  const legacyWake = parseOfflineCommand('Hey Dop, open YouTube', webContext);
  assert.equal(legacyWake.action?.action, 'open_url');
  assert.equal(legacyWake.action?.target, 'https://www.youtube.com');

  const customAlias = parseOfflineCommand('Hey El Dorado, study mode', webContext, [
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

test('Chrome Extension ZIP bundle (El Dorado v1.5.0), Alt+D shortcut & browser commands', async () => {
  const { buildExtensionBundleZip, saveCustomExtensionIcons } = await import(
    '../../server/extensionZip'
  );
  const { default: JSZip } = await import('jszip');
  const zipBuf = await buildExtensionBundleZip('https://dopextention.vercel.app');
  assert.equal(zipBuf.subarray(0, 4).toString('hex'), '504b0304'); // PK\x03\x04

  const parsedZip = await JSZip.loadAsync(zipBuf);
  assert.ok(parsedZip.file('manifest.json'), 'manifest.json must be at ZIP root');
  assert.ok(parsedZip.file('sidepanel.html'), 'sidepanel.html must be at ZIP root');
  assert.ok(parsedZip.file('hotkey_content.js'), 'hotkey_content.js must be bundled');
  assert.ok(parsedZip.file('icons/icon128.png'), 'icons/icon128.png must exist');
  assert.ok(parsedZip.file('icons/logo-white.png'), 'icons/logo-white.png must exist for floating orb');
  const manifestJson = JSON.parse(await parsedZip.file('manifest.json')!.async('string'));
  assert.equal(manifestJson.manifest_version, 3);
  assert.equal(manifestJson.name, 'El Dorado Assistant');
  assert.equal(manifestJson.version, '1.5.1');
  assert.equal(manifestJson.commands['activate-dope'].suggested_key.default, 'Alt+D');
  const bgJs = await parsedZip.file('background.js')!.async('string');
  assert.ok(bgJs.includes('https://dopextention.vercel.app'));

  const newTabCmd = parseOfflineCommand('Hey El Dorado, new tab', {
    ...webContext,
    platform: 'browser_extension',
    extension_connected: true,
  });
  assert.equal(newTabCmd.action?.action, 'new_tab');
  assert.equal(newTabCmd.supported, true);

  const ytSearch = parseOfflineCommand('Hey El Dorado, play lofi music on YouTube', {
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

test('Instant bare scroll, undo/redo, and compound multi-step web_workflow actions', () => {
  const bareScroll = parseOfflineCommand('Hey El Dorado, scroll', webContext);
  assert.equal(bareScroll.matched, true);
  assert.equal(bareScroll.ambiguous, undefined);
  assert.equal(bareScroll.action?.action, 'scroll');
  assert.equal(bareScroll.action?.parameters?.direction, 'down');

  const undoCmd = parseOfflineCommand('Hey El Dorado, undo this', webContext);
  assert.equal(undoCmd.matched, true);
  assert.equal(undoCmd.action?.action, 'undo');
  assert.equal(undoCmd.supported, true);

  const redoCmd = parseOfflineCommand('Hey El Dorado, redo', webContext);
  assert.equal(redoCmd.matched, true);
  assert.equal(redoCmd.action?.action, 'redo');

  const gptPrompt = parseOfflineCommand('Hey El Dorado, open ChatGPT and type a prompt hi', {
    ...webContext,
    platform: 'browser_extension',
    extension_connected: true,
  });
  assert.equal(gptPrompt.matched, true);
  assert.equal(gptPrompt.action?.action, 'web_workflow');
  assert.equal(gptPrompt.action?.target, 'https://chatgpt.com');
  assert.equal(gptPrompt.action?.parameters?.workflow_type, 'type_prompt');
  assert.equal(gptPrompt.action?.parameters?.prompt_text, 'hi');

  const flipkartOrders = parseOfflineCommand('Hey El Dorado, open Flipkart and go to order section', {
    ...webContext,
    platform: 'browser_extension',
    extension_connected: true,
  });
  assert.equal(flipkartOrders.matched, true);
  assert.equal(flipkartOrders.action?.action, 'web_workflow');
  assert.equal(flipkartOrders.action?.target, 'https://www.flipkart.com/account/orders');

  const waSend = parseOfflineCommand('Hey El Dorado, open WhatsApp and send hi to Abhinav', {
    ...webContext,
    platform: 'browser_extension',
    extension_connected: true,
  });
  assert.equal(waSend.matched, true);
  assert.equal(waSend.action?.action, 'web_workflow');
  assert.equal(waSend.action?.target, 'https://web.whatsapp.com');
  assert.equal(waSend.action?.parameters?.workflow_type, 'whatsapp_send');
  assert.equal(waSend.action?.parameters?.recipient, 'Abhinav');
  assert.equal(waSend.action?.parameters?.message_text, 'hi');
});

test('AI Q&A pure English fallback (math, time, date, El Dorado identity) & Desktop ZIP bundle', async () => {
  const mathCmd = parseOfflineCommand('Hey El Dorado, what is 25 * 48?', webContext);
  assert.equal(mathCmd.matched, true);
  assert.equal(mathCmd.supported, true);
  assert.equal(mathCmd.action?.action, 'answer_question');
  assert.match(mathCmd.spoken_response, /1200/);

  const addMath = parseOfflineCommand('Hey El Dorado, calculate 100 + 250', webContext);
  assert.equal(addMath.matched, true);
  assert.equal(addMath.action?.action, 'answer_question');
  assert.match(addMath.spoken_response, /350/);

  const timeCmd = parseOfflineCommand('Hey El Dorado, what is the current time?', webContext);
  assert.equal(timeCmd.matched, true);
  assert.equal(timeCmd.action?.action, 'answer_question');
  assert.match(timeCmd.spoken_response, /current time/i);

  const identityCmd = parseOfflineCommand('Hey El Dorado, who are you?', webContext);
  assert.equal(identityCmd.matched, true);
  assert.equal(identityCmd.action?.action, 'answer_question');
  assert.match(identityCmd.spoken_response, /El Dorado/i);

  const { buildDesktopBundleZip } = await import('../../server/desktopZip');
  const { default: JSZip } = await import('jszip');
  const desktopBuf = await buildDesktopBundleZip('https://dopextention.vercel.app');
  assert.equal(desktopBuf.subarray(0, 4).toString('hex'), '504b0304');

  const parsedDesktop = await JSZip.loadAsync(desktopBuf);
  assert.ok(parsedDesktop.file('manifest.json'), 'manifest.json must be in Desktop ZIP so Chrome Load unpacked also succeeds');
  assert.ok(parsedDesktop.file('icons/icon128.png'), 'icons/icon128.png must be in Desktop ZIP');
  assert.ok(parsedDesktop.file('icons/logo-white.png'), 'icons/logo-white.png must be in Desktop ZIP');
  assert.ok(parsedDesktop.file('el_dorado_companion.py'), 'el_dorado_companion.py must be in desktop ZIP');
  assert.ok(parsedDesktop.file('INSTALL_DESKTOP.txt'), 'INSTALL_DESKTOP.txt must be in desktop ZIP');
  assert.equal(parsedDesktop.file('Run-DOPE-Desktop.bat'), null, 'No .bat scripts inside ZIP so Chrome Safe Browsing does not block download');
  assert.equal(parsedDesktop.file('adapters/__init__.py'), null, 'No _-prefixed files so Chrome Load unpacked accepts the folder');
  assert.ok(parsedDesktop.file('adapters/windows_adapter.py'), 'windows_adapter.py must be in desktop ZIP');
  const pyCode = await parsedDesktop.file('el_dorado_companion.py')!.async('string');
  assert.ok(pyCode.includes('https://dopextention.vercel.app'));
  assert.ok(pyCode.includes('alt+d+t'));
  assert.ok(pyCode.includes('bootstrap_dependencies'));
  assert.ok(pyCode.includes('dont_write_bytecode'));
});

