export type DopePlatform =
  | 'web'
  | 'browser_extension'
  | 'windows'
  | 'macos'
  | 'linux'
  | 'android'
  | 'ios';

export type CommandCategory =
  | 'Applications'
  | 'Browser'
  | 'PDF and Documents'
  | 'Window Controls'
  | 'System Settings'
  | 'Navigation'
  | 'Media Controls'
  | 'File and Folder Operations'
  | 'Voice Conversation'
  | 'Device Management';

export type ActionName =
  | 'open_url'
  | 'web_search'
  | 'open_app'
  | 'switch_window'
  | 'minimize_window'
  | 'maximize_window'
  | 'restore_window'
  | 'close_window'
  | 'scroll'
  | 'new_tab'
  | 'switch_tab'
  | 'reload_tab'
  | 'go_back'
  | 'go_forward'
  | 'mute_tab'
  | 'unmute_tab'
  | 'duplicate_tab'
  | 'zoom'
  | 'pdf_navigate_page'
  | 'pdf_fit'
  | 'adjust_volume'
  | 'media_control'
  | 'open_approved_path'
  | 'read_emails'
  | 'send_email'
  | 'delete_file'
  | 'install_app'
  | 'change_security_setting'
  | 'system_power'
  | 'stop_listening'
  | 'clarify'
  | 'answer_question'
  | 'list_devices'
  | 'pair_device';

export interface DopeActionParameters {
  direction?: 'up' | 'down' | 'in' | 'out' | 'reset' | 'next' | 'previous';
  page?: number;
  fit_mode?: 'screen' | 'width';
  delta?: number;
  query?: string;
  to?: string;
  subject?: string;
  body?: string;
  power_action?: 'shutdown' | 'restart' | 'sleep';
  media_action?: 'play' | 'pause' | 'next' | 'previous' | 'mute';
  setting_name?: string;
}

export interface DopeAction {
  action: ActionName;
  target?: string;
  platform: DopePlatform;
  requires_confirmation: boolean;
  parameters?: DopeActionParameters;
}

export interface ActiveViewerContext {
  platform: DopePlatform;
  companion_connected: boolean;
  extension_connected: boolean;
  active_app: string;
  active_window_title: string;
  pdf_viewer_type?: 'browser_pdf_testbench' | 'adobe_acrobat' | 'edge_pdf' | 'chrome_pdf' | 'unsupported_viewer' | 'none';
  linux_display_server?: 'x11' | 'wayland';
}

export interface ActionValidationResult {
  valid: boolean;
  supported: boolean;
  action: DopeAction;
  reason?: string;
}

export interface CommandCatalogItem {
  id: string;
  category: CommandCategory;
  action: ActionName;
  voice_phrase: string;
  hinglish_phrase?: string;
  supported_platforms: DopePlatform[];
  required_permissions: string[];
  requires_confirmation: boolean;
  implementation_status: 'implemented_web' | 'implemented_companion' | 'scaffold_mobile';
  failure_behavior: string;
}

export interface CustomAlias {
  id: string;
  phrase: string;
  action: ActionName;
  target?: string;
  parameters?: DopeActionParameters;
  created_at: string;
}

export const ALLOWLISTED_ACTIONS: ReadonlySet<ActionName> = new Set<ActionName>([
  'open_url',
  'web_search',
  'open_app',
  'switch_window',
  'minimize_window',
  'maximize_window',
  'restore_window',
  'close_window',
  'scroll',
  'new_tab',
  'switch_tab',
  'reload_tab',
  'go_back',
  'go_forward',
  'mute_tab',
  'unmute_tab',
  'duplicate_tab',
  'zoom',
  'pdf_navigate_page',
  'pdf_fit',
  'adjust_volume',
  'media_control',
  'open_approved_path',
  'read_emails',
  'send_email',
  'delete_file',
  'install_app',
  'change_security_setting',
  'system_power',
  'stop_listening',
  'clarify',
  'answer_question',
  'list_devices',
  'pair_device',
]);

export const CONSEQUENTIAL_ACTIONS: ReadonlySet<ActionName> = new Set<ActionName>([
  'send_email',
  'delete_file',
  'install_app',
  'change_security_setting',
  'system_power',
]);

export const PLATFORM_CAPABILITIES: Record<DopePlatform, ReadonlySet<ActionName>> = {
  web: new Set<ActionName>([
    'open_url',
    'web_search',
    'scroll',
    'zoom',
    'pdf_navigate_page',
    'pdf_fit',
    'reload_tab',
    'read_emails',
    'send_email',
    'stop_listening',
    'clarify',
    'answer_question',
    'list_devices',
    'pair_device',
  ]),
  browser_extension: new Set<ActionName>([
    'open_url',
    'web_search',
    'scroll',
    'new_tab',
    'switch_tab',
    'reload_tab',
    'go_back',
    'go_forward',
    'mute_tab',
    'unmute_tab',
    'duplicate_tab',
    'zoom',
    'pdf_navigate_page',
    'pdf_fit',
    'minimize_window',
    'maximize_window',
    'restore_window',
    'close_window',
    'read_emails',
    'send_email',
    'stop_listening',
    'clarify',
    'answer_question',
    'list_devices',
    'pair_device',
  ]),
  windows: new Set<ActionName>([
    'open_url',
    'web_search',
    'open_app',
    'switch_window',
    'minimize_window',
    'maximize_window',
    'restore_window',
    'close_window',
    'scroll',
    'switch_tab',
    'reload_tab',
    'zoom',
    'pdf_navigate_page',
    'pdf_fit',
    'adjust_volume',
    'media_control',
    'open_approved_path',
    'read_emails',
    'send_email',
    'delete_file',
    'install_app',
    'change_security_setting',
    'system_power',
    'stop_listening',
    'clarify',
    'answer_question',
    'list_devices',
    'pair_device',
  ]),
  macos: new Set<ActionName>([
    'open_url',
    'web_search',
    'open_app',
    'switch_window',
    'minimize_window',
    'maximize_window',
    'restore_window',
    'close_window',
    'scroll',
    'switch_tab',
    'reload_tab',
    'zoom',
    'pdf_navigate_page',
    'pdf_fit',
    'adjust_volume',
    'media_control',
    'open_approved_path',
    'read_emails',
    'send_email',
    'delete_file',
    'change_security_setting',
    'system_power',
    'stop_listening',
    'clarify',
    'answer_question',
    'list_devices',
    'pair_device',
  ]),
  linux: new Set<ActionName>([
    'open_url',
    'web_search',
    'open_app',
    'switch_window',
    'minimize_window',
    'maximize_window',
    'restore_window',
    'close_window',
    'scroll',
    'switch_tab',
    'reload_tab',
    'zoom',
    'pdf_navigate_page',
    'pdf_fit',
    'adjust_volume',
    'media_control',
    'open_approved_path',
    'read_emails',
    'send_email',
    'delete_file',
    'system_power',
    'stop_listening',
    'clarify',
    'answer_question',
    'list_devices',
    'pair_device',
  ]),
  android: new Set<ActionName>([
    'open_url',
    'web_search',
    'open_app',
    'adjust_volume',
    'media_control',
    'read_emails',
    'send_email',
    'stop_listening',
    'clarify',
    'answer_question',
    'list_devices',
    'pair_device',
  ]),
  ios: new Set<ActionName>([
    'open_url',
    'web_search',
    'media_control',
    'read_emails',
    'send_email',
    'stop_listening',
    'clarify',
    'answer_question',
    'list_devices',
    'pair_device',
  ]),
};

export const ACTION_CATALOG: CommandCatalogItem[] = [
  {
    id: 'cmd-open-app',
    category: 'Applications',
    action: 'open_app',
    voice_phrase: 'Hey Dop, open Chrome.',
    hinglish_phrase: 'Hey Dop, Chrome kholo.',
    supported_platforms: ['windows', 'macos', 'linux', 'android'],
    required_permissions: ['Desktop Companion / App Launcher', 'Android Package Visibility'],
    requires_confirmation: false,
    implementation_status: 'implemented_companion',
    failure_behavior: 'Reports that the app is not installed or desktop companion is not connected.',
  },
  {
    id: 'cmd-open-url',
    category: 'Browser',
    action: 'open_url',
    voice_phrase: 'Hey Dop, open YouTube.',
    hinglish_phrase: 'Hey Dop, YouTube chalao.',
    supported_platforms: ['web', 'browser_extension', 'windows', 'macos', 'linux', 'android', 'ios'],
    required_permissions: ['Browser Tab / Popup Permission'],
    requires_confirmation: false,
    implementation_status: 'implemented_web',
    failure_behavior: 'Returns clickable URL link if browser popup blocker prevents automatic opening.',
  },
  {
    id: 'cmd-web-search',
    category: 'Browser',
    action: 'web_search',
    voice_phrase: 'Hey Dop, search for Python tutorials.',
    hinglish_phrase: 'Hey Dop, Python tutorials search karo.',
    supported_platforms: ['web', 'browser_extension', 'windows', 'macos', 'linux', 'android', 'ios'],
    required_permissions: ['Browser Tab Permission'],
    requires_confirmation: false,
    implementation_status: 'implemented_web',
    failure_behavior: 'Shows search link in transcript if popups are blocked.',
  },
  {
    id: 'cmd-switch-tab',
    category: 'Browser',
    action: 'switch_tab',
    voice_phrase: 'Hey Dop, switch to the next tab.',
    hinglish_phrase: 'Hey Dop, agle tab par jao.',
    supported_platforms: ['browser_extension', 'windows', 'macos', 'linux'],
    required_permissions: ['Extension tabs permission'],
    requires_confirmation: false,
    implementation_status: 'implemented_companion',
    failure_behavior: 'Explains that browser tab switching requires DOPE Browser Extension or Desktop Companion.',
  },
  {
    id: 'cmd-reload-tab',
    category: 'Browser',
    action: 'reload_tab',
    voice_phrase: 'Hey Dop, reload this PDF.',
    hinglish_phrase: 'Hey Dop, is PDF ko reload karo.',
    supported_platforms: ['web', 'browser_extension', 'windows', 'macos', 'linux'],
    required_permissions: ['Active Tab / PDF Viewer'],
    requires_confirmation: false,
    implementation_status: 'implemented_web',
    failure_behavior: 'Reports if no reloadable document or tab is active.',
  },
  {
    id: 'cmd-pdf-scroll',
    category: 'PDF and Documents',
    action: 'scroll',
    voice_phrase: 'Hey Dop, scroll down.',
    hinglish_phrase: 'Hey Dop, neeche scroll karo.',
    supported_platforms: ['web', 'browser_extension', 'windows', 'macos', 'linux'],
    required_permissions: ['Active Tab or Desktop Accessibility'],
    requires_confirmation: false,
    implementation_status: 'implemented_web',
    failure_behavior: 'States if active viewer has reached bottom or lacks scroll accessibility.',
  },
  {
    id: 'cmd-pdf-page',
    category: 'PDF and Documents',
    action: 'pdf_navigate_page',
    voice_phrase: 'Hey Dop, open page 15.',
    hinglish_phrase: 'Hey Dop, page 15 kholo.',
    supported_platforms: ['web', 'browser_extension', 'windows', 'macos', 'linux'],
    required_permissions: ['Compatible PDF Viewer API / Keyboard Shortcut'],
    requires_confirmation: false,
    implementation_status: 'implemented_web',
    failure_behavior: 'Honesty check: reports if current PDF viewer does not expose page-jump controls or page is out of range.',
  },
  {
    id: 'cmd-pdf-zoom',
    category: 'PDF and Documents',
    action: 'zoom',
    voice_phrase: 'Hey Dop, zoom in.',
    hinglish_phrase: 'Hey Dop, zoom badhao.',
    supported_platforms: ['web', 'browser_extension', 'windows', 'macos', 'linux'],
    required_permissions: ['Active Tab or Desktop Accessibility'],
    requires_confirmation: false,
    implementation_status: 'implemented_web',
    failure_behavior: 'Reports minimum/maximum zoom bounds or unsupported viewer.',
  },
  {
    id: 'cmd-pdf-fit',
    category: 'PDF and Documents',
    action: 'pdf_fit',
    voice_phrase: 'Hey Dop, fit the page to the screen.',
    hinglish_phrase: 'Hey Dop, page ko screen par fit karo.',
    supported_platforms: ['web', 'browser_extension', 'windows', 'macos', 'linux'],
    required_permissions: ['Compatible PDF Viewer'],
    requires_confirmation: false,
    implementation_status: 'implemented_web',
    failure_behavior: 'Reports if the active PDF reader does not support fit-width or fit-screen.',
  },
  {
    id: 'cmd-win-minimize',
    category: 'Window Controls',
    action: 'minimize_window',
    voice_phrase: 'Hey Dop, minimize this application.',
    hinglish_phrase: 'Hey Dop, is window ko minimize karo.',
    supported_platforms: ['windows', 'macos', 'linux'],
    required_permissions: ['Desktop Companion + OS Accessibility (UIA / macOS AX / X11)'],
    requires_confirmation: false,
    implementation_status: 'implemented_companion',
    failure_behavior: 'Explains OS limitation on Wayland, iOS, or when Desktop Companion is offline.',
  },
  {
    id: 'cmd-win-switch',
    category: 'Window Controls',
    action: 'switch_window',
    voice_phrase: 'Hey Dop, switch to the previous window.',
    hinglish_phrase: 'Hey Dop, pichli window par wapas jao.',
    supported_platforms: ['windows', 'macos', 'linux'],
    required_permissions: ['Desktop Companion + OS Accessibility'],
    requires_confirmation: false,
    implementation_status: 'implemented_companion',
    failure_behavior: 'Reports when desktop companion is offline or Wayland restricts global window switching.',
  },
  {
    id: 'cmd-win-maximize',
    category: 'Window Controls',
    action: 'maximize_window',
    voice_phrase: 'Hey Dop, maximize this PDF window.',
    supported_platforms: ['windows', 'macos', 'linux'],
    required_permissions: ['Desktop Companion + OS Accessibility'],
    requires_confirmation: false,
    implementation_status: 'implemented_companion',
    failure_behavior: 'Reports platform restriction or missing companion connection.',
  },
  {
    id: 'cmd-win-restore',
    category: 'Window Controls',
    action: 'restore_window',
    voice_phrase: 'Hey Dop, restore this PDF window.',
    supported_platforms: ['windows', 'macos', 'linux'],
    required_permissions: ['Desktop Companion + OS Accessibility'],
    requires_confirmation: false,
    implementation_status: 'implemented_companion',
    failure_behavior: 'Reports if window is already restored or companion is offline.',
  },
  {
    id: 'cmd-sys-volume',
    category: 'System Settings',
    action: 'adjust_volume',
    voice_phrase: 'Hey Dop, increase the volume.',
    hinglish_phrase: 'Hey Dop, volume badhao.',
    supported_platforms: ['windows', 'macos', 'linux', 'android'],
    required_permissions: ['Desktop Audio Endpoint / Android AudioManager'],
    requires_confirmation: false,
    implementation_status: 'implemented_companion',
    failure_behavior: 'Browser cannot change OS master volume; informs user to use Desktop/Android app.',
  },
  {
    id: 'cmd-sys-power',
    category: 'System Settings',
    action: 'system_power',
    voice_phrase: 'Hey Dop, restart my computer.',
    supported_platforms: ['windows', 'macos', 'linux'],
    required_permissions: ['Desktop Companion + Explicit User Confirmation'],
    requires_confirmation: true,
    implementation_status: 'implemented_companion',
    failure_behavior: 'Always pauses for explicit confirmation; aborts cleanly on cancel.',
  },
  {
    id: 'cmd-nav-gmail-read',
    category: 'Navigation',
    action: 'read_emails',
    voice_phrase: 'Hey Dop, check my unread emails.',
    hinglish_phrase: 'Hey Dop, mere unread emails dikhao.',
    supported_platforms: ['web', 'browser_extension', 'windows', 'macos', 'linux', 'android', 'ios'],
    required_permissions: ['Google Sign-In + Gmail Read Permission'],
    requires_confirmation: false,
    implementation_status: 'implemented_web',
    failure_behavior: 'Prompts user to Sign in with Google if Gmail permission is not active.',
  },
  {
    id: 'cmd-nav-gmail-send',
    category: 'Navigation',
    action: 'send_email',
    voice_phrase: 'Hey Dop, send an email to Alex saying I am ready.',
    supported_platforms: ['web', 'browser_extension', 'windows', 'macos', 'linux', 'android', 'ios'],
    required_permissions: ['Google Sign-In + Gmail Send Permission + Confirmation'],
    requires_confirmation: true,
    implementation_status: 'implemented_web',
    failure_behavior: 'Requires explicit confirmation dialog with recipient, subject, and body before sending.',
  },
  {
    id: 'cmd-media-control',
    category: 'Media Controls',
    action: 'media_control',
    voice_phrase: 'Hey Dop, pause the music.',
    hinglish_phrase: 'Hey Dop, gana roko.',
    supported_platforms: ['windows', 'macos', 'linux', 'android', 'ios'],
    required_permissions: ['OS Media Session / MPRIS / Audio Focus'],
    requires_confirmation: false,
    implementation_status: 'implemented_companion',
    failure_behavior: 'Reports if no active OS media session is available.',
  },
  {
    id: 'cmd-file-open',
    category: 'File and Folder Operations',
    action: 'open_approved_path',
    voice_phrase: 'Hey Dop, open my Documents folder.',
    supported_platforms: ['windows', 'macos', 'linux'],
    required_permissions: ['User-Approved Folder Allowlist'],
    requires_confirmation: false,
    implementation_status: 'implemented_companion',
    failure_behavior: 'Blocks unapproved paths outside allowlist and explains why.',
  },
  {
    id: 'cmd-file-delete',
    category: 'File and Folder Operations',
    action: 'delete_file',
    voice_phrase: 'Hey Dop, delete draft report.',
    supported_platforms: ['windows', 'macos', 'linux'],
    required_permissions: ['User-Approved Folder + Explicit Confirmation'],
    requires_confirmation: true,
    implementation_status: 'implemented_companion',
    failure_behavior: 'Never executes without explicit confirmation; moves to Trash where supported.',
  },
  {
    id: 'cmd-voice-stop',
    category: 'Voice Conversation',
    action: 'stop_listening',
    voice_phrase: 'Hey Dop, stop listening.',
    hinglish_phrase: 'Hey Dop, sunna band karo.',
    supported_platforms: ['web', 'browser_extension', 'windows', 'macos', 'linux', 'android', 'ios'],
    required_permissions: ['Microphone Control'],
    requires_confirmation: false,
    implementation_status: 'implemented_web',
    failure_behavior: 'Immediately stops microphone recognition and wake-word capture.',
  },
  {
    id: 'cmd-ai-qa',
    category: 'Voice Conversation',
    action: 'answer_question',
    voice_phrase: 'Hey Dop, what is quantum computing?',
    hinglish_phrase: 'Hey Dop, 25 * 48 kitna hota hai?',
    supported_platforms: ['web', 'browser_extension', 'windows', 'macos', 'linux', 'android', 'ios'],
    required_permissions: ['Gemini AI / Offline Q&A Fallback'],
    requires_confirmation: false,
    implementation_status: 'implemented_web',
    failure_behavior: 'Falls back to built-in math, time/date, and Wikipedia summary answers if Gemini API key is not configured.',
  },
  {
    id: 'cmd-dev-list',
    category: 'Device Management',
    action: 'list_devices',
    voice_phrase: 'Hey Dop, show my connected devices.',
    supported_platforms: ['web', 'browser_extension', 'windows', 'macos', 'linux', 'android', 'ios'],
    required_permissions: ['Authenticated Session'],
    requires_confirmation: false,
    implementation_status: 'implemented_web',
    failure_behavior: 'Shows empty device list with pairing prompt if none connected.',
  },
];

export function isSafeHttpUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export function validateDopeAction(
  candidate: Partial<DopeAction>,
  context: ActiveViewerContext
): ActionValidationResult {
  const actionName = candidate.action;
  if (!actionName || !ALLOWLISTED_ACTIONS.has(actionName)) {
    return {
      valid: false,
      supported: false,
      action: {
        action: 'clarify',
        platform: context.platform,
        requires_confirmation: false,
      },
      reason: `Action "${String(actionName ?? 'unknown')}" is not in the DOPE allowlisted action registry.`,
    };
  }

  const platform: DopePlatform = candidate.platform ?? context.platform;
  const requiresConfirmation =
    CONSEQUENTIAL_ACTIONS.has(actionName) || Boolean(candidate.requires_confirmation);

  const sanitizedAction: DopeAction = {
    action: actionName,
    target: typeof candidate.target === 'string' ? candidate.target.trim().slice(0, 500) : undefined,
    platform,
    requires_confirmation: requiresConfirmation,
    parameters: candidate.parameters ? { ...candidate.parameters } : undefined,
  };

  if (actionName === 'open_url' && sanitizedAction.target) {
    if (!isSafeHttpUrl(sanitizedAction.target)) {
      return {
        valid: false,
        supported: false,
        action: sanitizedAction,
        reason: 'Blocked unsafe URL scheme. Only http:// and https:// URLs are permitted.',
      };
    }
  }

  const supportedSet = PLATFORM_CAPABILITIES[platform];
  if (!supportedSet || !supportedSet.has(actionName)) {
    return {
      valid: true,
      supported: false,
      action: sanitizedAction,
      reason: `The "${actionName}" action is not supported on ${platform} due to operating system restrictions.`,
    };
  }

  if (
    (platform === 'windows' || platform === 'macos' || platform === 'linux') &&
    !context.companion_connected &&
    ['open_app', 'switch_window', 'minimize_window', 'maximize_window', 'restore_window', 'close_window', 'adjust_volume', 'media_control', 'open_approved_path', 'delete_file', 'install_app', 'change_security_setting', 'system_power'].includes(actionName)
  ) {
    return {
      valid: true,
      supported: false,
      action: sanitizedAction,
      reason: `Cannot execute "${actionName}" from the web dashboard alone because the ${platform} Desktop Companion is not connected.`,
    };
  }

  if (
    platform === 'linux' &&
    context.linux_display_server === 'wayland' &&
    ['switch_window', 'minimize_window', 'maximize_window', 'restore_window'].includes(actionName)
  ) {
    return {
      valid: true,
      supported: false,
      action: sanitizedAction,
      reason:
        'Global window switching and programmatic window minimize/maximize are restricted by Wayland compositor security unless a desktop-specific extension is enabled.',
    };
  }

  if (actionName === 'pdf_navigate_page') {
    if (context.pdf_viewer_type === 'unsupported_viewer') {
      return {
        valid: true,
        supported: false,
        action: sanitizedAction,
        reason:
          'The currently active PDF viewer does not expose page-jump controls via accessibility or keyboard shortcuts.',
      };
    }
    const page = sanitizedAction.parameters?.page;
    if (page !== undefined && (!Number.isInteger(page) || page < 1 || page > 10000)) {
      return {
        valid: false,
        supported: false,
        action: sanitizedAction,
        reason: 'Page number must be a positive integer between 1 and 10000.',
      };
    }
  }

  return {
    valid: true,
    supported: true,
    action: sanitizedAction,
  };
}
