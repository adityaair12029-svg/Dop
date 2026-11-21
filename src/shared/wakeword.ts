import type { ActiveViewerContext, CustomAlias, DopeAction } from './actions';
import { validateDopeAction } from './actions';

export interface WakeWordResult {
  detected: boolean;
  wake_phrase_matched?: string;
  command_text: string;
}

export interface OfflineParseResult {
  matched: boolean;
  action?: DopeAction;
  spoken_response: string;
  ambiguous?: boolean;
  clarification_question?: string;
  supported: boolean;
  unsupported_reason?: string;
}

const WAKE_PATTERNS: RegExp[] = [
  /^\s*(?:hey|hi|ok|okay|hello)\s+(?:dop|dope|daap|top)\b[\s,.:!?-]*(.*)$/i,
  /^\s*(?:dop|dope)\b[\s,.:!?-]+(.*)$/i,
  /^\s*(?:हे|हाय|हेलो|अरे)\s+(?:डॉप|डोप|दोप)\b[\s,।.:!?-]*(.*)$/i,
];

export function detectWakeWord(transcript: string): WakeWordResult {
  const cleaned = transcript.trim();
  for (const pattern of WAKE_PATTERNS) {
    const match = cleaned.match(pattern);
    if (match) {
      const remainder = (match[1] ?? '').trim();
      const matchedPrefix = cleaned.slice(0, cleaned.length - remainder.length).trim();
      return {
        detected: true,
        wake_phrase_matched: matchedPrefix || 'Hey Dop',
        command_text: remainder,
      };
    }
  }
  return {
    detected: false,
    command_text: cleaned,
  };
}

export function normalizeMultilingualCommand(input: string): string {
  let text = input
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/खोलो|चलाओ|ओपन करो/gi, 'kholo')
    .replace(/नीचे स्क्रॉल करो|neeche scroll karo/gi, 'scroll down')
    .replace(/ऊपर स्क्रॉल करो|upar scroll karo/gi, 'scroll up')
    .replace(/सुनना बंद करो|sunna band karo/gi, 'stop listening')
    .replace(/ज़ूम इन|zoom badhao/gi, 'zoom in')
    .replace(/ज़ूम आउट|zoom kam karo/gi, 'zoom out')
    .replace(/आवाज़ बढ़ाओ|volume badhao|awaz badhao/gi, 'increase volume')
    .replace(/आवाज़ कम करो|volume kam karo/gi, 'decrease volume');

  const suffixOpen = text.match(/^(.+?)\s+(?:kholo|chalao|open karo|chalu karo)[.!?]*$/i);
  if (suffixOpen) {
    text = `open ${suffixOpen[1].trim()}`;
  }
  const suffixSearch = text.match(/^(.+?)\s+(?:search karo|dhundo|khojo)[.!?]*$/i);
  if (suffixSearch) {
    text = `search for ${suffixSearch[1].trim()}`;
  }
  return text;
}

const KNOWN_WEBSITES: Record<string, string> = {
  youtube: 'https://www.youtube.com',
  google: 'https://www.google.com',
  gmail: 'https://mail.google.com',
  github: 'https://github.com',
  wikipedia: 'https://www.wikipedia.org',
  reddit: 'https://www.reddit.com',
  instagram: 'https://www.instagram.com',
  insta: 'https://www.instagram.com',
  chatgpt: 'https://chatgpt.com',
  gemini: 'https://gemini.google.com',
  whatsapp: 'https://web.whatsapp.com',
  facebook: 'https://www.facebook.com',
  twitter: 'https://x.com',
  x: 'https://x.com',
  linkedin: 'https://www.linkedin.com',
  spotify: 'https://open.spotify.com',
  netflix: 'https://www.netflix.com',
  discord: 'https://discord.com/app',
  amazon: 'https://www.amazon.in',
  flipkart: 'https://www.flipkart.com',
  maps: 'https://maps.google.com',
  googlemaps: 'https://maps.google.com',
  drive: 'https://drive.google.com',
  docs: 'https://docs.google.com',
  sheets: 'https://sheets.google.com',
  canva: 'https://www.canva.com',
  figma: 'https://www.figma.com',
  hotstar: 'https://www.hotstar.com',
  jiocinema: 'https://www.jiocinema.com',
};

export function parseOfflineCommand(
  rawText: string,
  context: ActiveViewerContext,
  aliases: CustomAlias[] = []
): OfflineParseResult {
  const wake = detectWakeWord(rawText);
  const effectiveText = normalizeMultilingualCommand(wake.detected ? wake.command_text : rawText);
  const lower = effectiveText.toLowerCase();

  if (!effectiveText) {
    return {
      matched: false,
      ambiguous: true,
      supported: true,
      clarification_question: 'I heard "Hey Dop", what would you like me to do?',
      spoken_response: 'Yes, I am listening. What would you like me to do?',
    };
  }

  for (const alias of aliases) {
    if (lower === alias.phrase.toLowerCase().trim()) {
      const check = validateDopeAction(
        {
          action: alias.action,
          target: alias.target,
          platform: context.platform,
          requires_confirmation: false,
          parameters: alias.parameters,
        },
        context
      );
      return {
        matched: true,
        action: check.action,
        supported: check.supported,
        unsupported_reason: check.reason,
        spoken_response: check.supported
          ? `Running your custom alias "${alias.phrase}".`
          : check.reason ?? 'This action is unavailable on the current platform.',
      };
    }
  }

  // Stop listening
  if (/^(?:stop listening|mute microphone|go to sleep|band karo|cancel listening)/i.test(lower)) {
    const check = validateDopeAction(
      { action: 'stop_listening', platform: context.platform, requires_confirmation: false },
      context
    );
    return {
      matched: true,
      action: check.action,
      supported: check.supported,
      spoken_response: 'Microphone listening stopped.',
    };
  }

  // Ambiguous short command
  if (/^(?:open it|do that|open|scroll|zoom|close|delete)$/i.test(lower)) {
    return {
      matched: true,
      ambiguous: true,
      supported: true,
      action: { action: 'clarify', platform: context.platform, requires_confirmation: false },
      clarification_question: `Your command "${effectiveText}" is ambiguous. Please specify which app, URL, or direction you want.`,
      spoken_response: `Could you clarify what you want me to ${lower}?`,
    };
  }

  // PDF page navigation
  const pageMatch = lower.match(/(?:go to|open|jump to)\s+page\s+(\d+)/i);
  if (pageMatch) {
    const pageNum = Number.parseInt(pageMatch[1], 10);
    const check = validateDopeAction(
      {
        action: 'pdf_navigate_page',
        platform: context.platform,
        requires_confirmation: false,
        parameters: { page: pageNum },
      },
      context
    );
    return {
      matched: true,
      action: check.action,
      supported: check.supported,
      unsupported_reason: check.reason,
      spoken_response: check.supported
        ? `Navigating to page ${pageNum}.`
        : check.reason ?? 'Page navigation is unsupported in this viewer.',
    };
  }

  if (/(?:next page|agla page)/i.test(lower)) {
    const check = validateDopeAction(
      {
        action: 'pdf_navigate_page',
        platform: context.platform,
        requires_confirmation: false,
        parameters: { direction: 'next' },
      },
      context
    );
    return {
      matched: true,
      action: check.action,
      supported: check.supported,
      unsupported_reason: check.reason,
      spoken_response: check.supported ? 'Moving to the next page.' : check.reason ?? 'Unsupported.',
    };
  }

  if (/(?:previous page|pichla page)/i.test(lower)) {
    const check = validateDopeAction(
      {
        action: 'pdf_navigate_page',
        platform: context.platform,
        requires_confirmation: false,
        parameters: { direction: 'previous' },
      },
      context
    );
    return {
      matched: true,
      action: check.action,
      supported: check.supported,
      unsupported_reason: check.reason,
      spoken_response: check.supported ? 'Moving to the previous page.' : check.reason ?? 'Unsupported.',
    };
  }

  // Fit PDF
  if (/fit.*width/i.test(lower)) {
    const check = validateDopeAction(
      {
        action: 'pdf_fit',
        platform: context.platform,
        requires_confirmation: false,
        parameters: { fit_mode: 'width' },
      },
      context
    );
    return {
      matched: true,
      action: check.action,
      supported: check.supported,
      unsupported_reason: check.reason,
      spoken_response: check.supported ? 'Fitting page to width.' : check.reason ?? 'Unsupported.',
    };
  }
  if (/fit.*screen|fit.*page/i.test(lower)) {
    const check = validateDopeAction(
      {
        action: 'pdf_fit',
        platform: context.platform,
        requires_confirmation: false,
        parameters: { fit_mode: 'screen' },
      },
      context
    );
    return {
      matched: true,
      action: check.action,
      supported: check.supported,
      unsupported_reason: check.reason,
      spoken_response: check.supported ? 'Fitting page to screen.' : check.reason ?? 'Unsupported.',
    };
  }

  // Scroll
  if (/scroll\s+down/i.test(lower)) {
    const check = validateDopeAction(
      { action: 'scroll', platform: context.platform, requires_confirmation: false, parameters: { direction: 'down' } },
      context
    );
    return {
      matched: true,
      action: check.action,
      supported: check.supported,
      spoken_response: 'Scrolling down.',
    };
  }
  if (/scroll\s+up/i.test(lower)) {
    const check = validateDopeAction(
      { action: 'scroll', platform: context.platform, requires_confirmation: false, parameters: { direction: 'up' } },
      context
    );
    return {
      matched: true,
      action: check.action,
      supported: check.supported,
      spoken_response: 'Scrolling up.',
    };
  }

  // Zoom
  if (/zoom\s+in/i.test(lower)) {
    const check = validateDopeAction(
      { action: 'zoom', platform: context.platform, requires_confirmation: false, parameters: { direction: 'in' } },
      context
    );
    return {
      matched: true,
      action: check.action,
      supported: check.supported,
      spoken_response: 'Zooming in.',
    };
  }
  if (/zoom\s+out/i.test(lower)) {
    const check = validateDopeAction(
      { action: 'zoom', platform: context.platform, requires_confirmation: false, parameters: { direction: 'out' } },
      context
    );
    return {
      matched: true,
      action: check.action,
      supported: check.supported,
      spoken_response: 'Zooming out.',
    };
  }
  if (/reset\s+zoom/i.test(lower)) {
    const check = validateDopeAction(
      { action: 'zoom', platform: context.platform, requires_confirmation: false, parameters: { direction: 'reset' } },
      context
    );
    return {
      matched: true,
      action: check.action,
      supported: check.supported,
      spoken_response: 'Resetting zoom to 100%.',
    };
  }

  // Reload PDF / Tab
  if (/reload/i.test(lower)) {
    const check = validateDopeAction(
      { action: 'reload_tab', platform: context.platform, requires_confirmation: false },
      context
    );
    return {
      matched: true,
      action: check.action,
      supported: check.supported,
      spoken_response: 'Reloading the active document.',
    };
  }

  // Window controls
  if (/minimize/i.test(lower)) {
    const check = validateDopeAction(
      { action: 'minimize_window', platform: context.platform, requires_confirmation: false },
      context
    );
    return {
      matched: true,
      action: check.action,
      supported: check.supported,
      unsupported_reason: check.reason,
      spoken_response: check.supported ? 'Minimizing the active window.' : check.reason ?? 'Window minimize is unavailable.',
    };
  }
  if (/maximize/i.test(lower)) {
    const check = validateDopeAction(
      { action: 'maximize_window', platform: context.platform, requires_confirmation: false },
      context
    );
    return {
      matched: true,
      action: check.action,
      supported: check.supported,
      unsupported_reason: check.reason,
      spoken_response: check.supported ? 'Maximizing the active window.' : check.reason ?? 'Window maximize is unavailable.',
    };
  }
  if (/restore/i.test(lower)) {
    const check = validateDopeAction(
      { action: 'restore_window', platform: context.platform, requires_confirmation: false },
      context
    );
    return {
      matched: true,
      action: check.action,
      supported: check.supported,
      unsupported_reason: check.reason,
      spoken_response: check.supported ? 'Restoring the active window.' : check.reason ?? 'Window restore is unavailable.',
    };
  }
  if (/switch.*previous window/i.test(lower)) {
    const check = validateDopeAction(
      { action: 'switch_window', platform: context.platform, requires_confirmation: false, parameters: { direction: 'previous' } },
      context
    );
    return {
      matched: true,
      action: check.action,
      supported: check.supported,
      unsupported_reason: check.reason,
      spoken_response: check.supported ? 'Switching to the previous window.' : check.reason ?? 'Window switching is unavailable.',
    };
  }

  // Volume
  if (/(?:increase|turn up|raise).*volume/i.test(lower)) {
    const check = validateDopeAction(
      { action: 'adjust_volume', platform: context.platform, requires_confirmation: false, parameters: { delta: 10 } },
      context
    );
    return {
      matched: true,
      action: check.action,
      supported: check.supported,
      unsupported_reason: check.reason,
      spoken_response: check.supported ? 'Increasing system volume.' : check.reason ?? 'System volume control is unavailable.',
    };
  }

  // Consequential: shutdown / restart / delete / send email
  if (/(?:shut\s*down|restart|reboot)/i.test(lower)) {
    const powerAction = /restart|reboot/i.test(lower) ? 'restart' : 'shutdown';
    const check = validateDopeAction(
      {
        action: 'system_power',
        platform: context.platform,
        requires_confirmation: true,
        parameters: { power_action: powerAction },
      },
      context
    );
    return {
      matched: true,
      action: check.action,
      supported: check.supported,
      unsupported_reason: check.reason,
      spoken_response: check.supported
        ? `Confirmation required before I ${powerAction} your device.`
        : check.reason ?? `Cannot ${powerAction} from the current platform.`,
    };
  }

  const emailMatch = effectiveText.match(/send\s+(?:an?\s+)?email\s+to\s+([^\s]+@[^\s]+)(?:\s+(?:saying|about|with)\s+(.+))?/i);
  if (emailMatch) {
    const check = validateDopeAction(
      {
        action: 'send_email',
        platform: context.platform,
        requires_confirmation: true,
        parameters: {
          to: emailMatch[1],
          subject: 'Message via DOPE Assistant',
          body: emailMatch[2] ?? '',
        },
      },
      context
    );
    return {
      matched: true,
      action: check.action,
      supported: check.supported,
      spoken_response: `Please confirm sending an email to ${emailMatch[1]}.`,
    };
  }

  if (/(?:check|read|show).*(?:emails|inbox|gmail)/i.test(lower)) {
    const check = validateDopeAction(
      { action: 'read_emails', platform: context.platform, requires_confirmation: false },
      context
    );
    return {
      matched: true,
      action: check.action,
      supported: check.supported,
      spoken_response: 'Checking your Gmail inbox.',
    };
  }

  // Browser Tab & Navigation Controls
  if (/(?:new\s+tab|naya\s+tab)/i.test(lower)) {
    const check = validateDopeAction(
      { action: 'new_tab', platform: context.platform, requires_confirmation: false },
      context
    );
    return {
      matched: true,
      action: check.action,
      supported: check.supported,
      unsupported_reason: check.reason,
      spoken_response: check.supported ? 'Opening a new tab.' : check.reason ?? 'Requires Browser Extension.',
    };
  }
  if (/(?:go\s+back|back\s+jao|peeche\s+jao|pichle\s+page)/i.test(lower) && !/pdf/i.test(lower)) {
    const check = validateDopeAction(
      { action: 'go_back', platform: context.platform, requires_confirmation: false },
      context
    );
    return {
      matched: true,
      action: check.action,
      supported: check.supported,
      unsupported_reason: check.reason,
      spoken_response: check.supported ? 'Going back.' : check.reason ?? 'Requires Browser Extension.',
    };
  }
  if (/(?:go\s+forward|aage\s+jao)/i.test(lower)) {
    const check = validateDopeAction(
      { action: 'go_forward', platform: context.platform, requires_confirmation: false },
      context
    );
    return {
      matched: true,
      action: check.action,
      supported: check.supported,
      unsupported_reason: check.reason,
      spoken_response: check.supported ? 'Going forward.' : check.reason ?? 'Requires Browser Extension.',
    };
  }
  if (/unmute/i.test(lower)) {
    const check = validateDopeAction(
      { action: 'unmute_tab', platform: context.platform, requires_confirmation: false },
      context
    );
    return {
      matched: true,
      action: check.action,
      supported: check.supported,
      unsupported_reason: check.reason,
      spoken_response: check.supported ? 'Unmuting tab audio.' : check.reason ?? 'Requires Browser Extension.',
    };
  }
  if (/mute\s*(?:tab|this|it)?/i.test(lower)) {
    const check = validateDopeAction(
      { action: 'mute_tab', platform: context.platform, requires_confirmation: false },
      context
    );
    return {
      matched: true,
      action: check.action,
      supported: check.supported,
      unsupported_reason: check.reason,
      spoken_response: check.supported ? 'Muting tab audio.' : check.reason ?? 'Requires Browser Extension.',
    };
  }
  if (/duplicate\s+tab/i.test(lower)) {
    const check = validateDopeAction(
      { action: 'duplicate_tab', platform: context.platform, requires_confirmation: false },
      context
    );
    return {
      matched: true,
      action: check.action,
      supported: check.supported,
      unsupported_reason: check.reason,
      spoken_response: check.supported ? 'Duplicating current tab.' : check.reason ?? 'Requires Browser Extension.',
    };
  }

  // YouTube specific search / play
  const ytPlayMatch = effectiveText.match(
    /(?:play|search)\s+(.+?)\s+(?:on|in|pe|par)\s+youtube/i
  ) || effectiveText.match(/youtube\s+(?:pe|par|search)\s+(.+?)(?:\s+(?:chalao|bajao|play|search|kholo))?$/i);
  if (ytPlayMatch && ytPlayMatch[1]?.trim()) {
    const q = ytPlayMatch[1].trim();
    const check = validateDopeAction(
      {
        action: 'open_url',
        target: `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`,
        platform: context.platform,
        requires_confirmation: false,
      },
      context
    );
    return {
      matched: true,
      action: check.action,
      supported: check.supported,
      spoken_response: `Playing ${q} on YouTube.`,
    };
  }

  // Web search
  const searchMatch = effectiveText.match(/(?:search\s+(?:for\s+)?|google\s+)(.+)/i);
  if (searchMatch) {
    const query = searchMatch[1].trim();
    const check = validateDopeAction(
      {
        action: 'web_search',
        target: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
        platform: context.platform,
        requires_confirmation: false,
        parameters: { query },
      },
      context
    );
    return {
      matched: true,
      action: check.action,
      supported: check.supported,
      spoken_response: `Searching Google for ${query}.`,
    };
  }

  // Open website or app
  const openMatch = effectiveText.match(/open\s+(.+)/i);
  if (openMatch) {
    const rawTarget = openMatch[1].trim().replace(/[.!?]+$/, '');
    const key = rawTarget.toLowerCase().replace(/\s+/g, '');
    if (KNOWN_WEBSITES[key]) {
      const check = validateDopeAction(
        {
          action: 'open_url',
          target: KNOWN_WEBSITES[key],
          platform: context.platform,
          requires_confirmation: false,
        },
        context
      );
      return {
        matched: true,
        action: check.action,
        supported: check.supported,
        spoken_response: `Opening ${rawTarget}.`,
      };
    }

    if (/^https?:\/\//i.test(rawTarget) || /\.[a-z]{2,}$/i.test(rawTarget)) {
      const url = /^https?:\/\//i.test(rawTarget) ? rawTarget : `https://${rawTarget}`;
      const check = validateDopeAction(
        {
          action: 'open_url',
          target: url,
          platform: context.platform,
          requires_confirmation: false,
        },
        context
      );
      return {
        matched: true,
        action: check.action,
        supported: check.supported,
        unsupported_reason: check.reason,
        spoken_response: check.valid ? `Opening ${url}.` : check.reason ?? 'Invalid URL.',
      };
    }

    const appPlatform = context.platform === 'web' ? 'windows' : context.platform;
    const check = validateDopeAction(
      {
        action: 'open_app',
        target: rawTarget,
        platform: appPlatform,
        requires_confirmation: false,
      },
      { ...context, platform: appPlatform }
    );
    return {
      matched: true,
      action: check.action,
      supported: check.supported,
      unsupported_reason: check.reason,
      spoken_response: check.supported
        ? `Launching ${rawTarget}.`
        : check.reason ?? `Cannot launch ${rawTarget} without the Desktop Companion.`,
    };
  }

  // Built-in offline Q&A (time, date, math, identity)
  if (/(?:what(?:'s| is) the time|current time|time kya|kitna baja|kitne baje)/i.test(lower)) {
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return {
      matched: true,
      supported: true,
      action: { action: 'answer_question', platform: context.platform, requires_confirmation: false },
      spoken_response: `Abhi time ${now} hai.`,
    };
  }
  if (/(?:what(?:'s| is) the date|today'?s date|aaj ki date|aaj kya tarikh)/i.test(lower)) {
    const today = new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    return {
      matched: true,
      supported: true,
      action: { action: 'answer_question', platform: context.platform, requires_confirmation: false },
      spoken_response: `Aaj ${today} hai.`,
    };
  }
  if (/(?:who are you|tum kaun ho|what is dope|apne baare me batao)/i.test(lower)) {
    return {
      matched: true,
      supported: true,
      action: { action: 'answer_question', platform: context.platform, requires_confirmation: false },
      spoken_response:
        'Main DOPE hoon — aapka AI voice assistant. Aap mujhse koi bhi sawal pooch sakte ho ya browser/desktop commands de sakte ho.',
    };
  }

  const mathExpr = effectiveText
    .replace(/^(?:what is|calculate|solve|kitna hota hai|batao)\s+/i, '')
    .replace(/\bplus\b/gi, '+')
    .replace(/\bminus\b/gi, '-')
    .replace(/\b(?:times|multiplied by|into|guna)\b/gi, '*')
    .replace(/\b(?:divided by|by|bhag)\b/gi, '/')
    .replace(/\s*(?:kitna hota hai|hota hai|\?)+$/i, '')
    .trim();
  if (/^[0-9+\-*/().\s]{3,}$/.test(mathExpr) && /[+\-*/]/.test(mathExpr)) {
    const val = evaluateSafeArithmetic(mathExpr);
    if (val !== null) {
      return {
        matched: true,
        supported: true,
        action: { action: 'answer_question', platform: context.platform, requires_confirmation: false },
        spoken_response: `${mathExpr} = ${val}.`,
      };
    }
  }

  return {
    matched: false,
    supported: true,
    spoken_response: `Offline command parser did not match "${effectiveText}".`,
  };
}

function evaluateSafeArithmetic(expr: string): number | null {
  const tokens = expr.match(/\d+(?:\.\d+)?|[+\-*/()]/g);
  if (!tokens) return null;
  let idx = 0;

  function parseExpr(): number | null {
    let left = parseTerm();
    if (left === null) return null;
    while (tokens![idx] === '+' || tokens![idx] === '-') {
      const op = tokens![idx++];
      const right = parseTerm();
      if (right === null) return null;
      left = op === '+' ? left + right : left - right;
    }
    return left;
  }

  function parseTerm(): number | null {
    let left = parseFactor();
    if (left === null) return null;
    while (tokens![idx] === '*' || tokens![idx] === '/') {
      const op = tokens![idx++];
      const right = parseFactor();
      if (right === null || (op === '/' && right === 0)) return null;
      left = op === '*' ? left * right : left / right;
    }
    return left;
  }

  function parseFactor(): number | null {
    const tok = tokens![idx];
    if (tok === '(') {
      idx++;
      const val = parseExpr();
      if (tokens![idx] !== ')') return null;
      idx++;
      return val;
    }
    if (tok && /^\d+(?:\.\d+)?$/.test(tok)) {
      idx++;
      return Number(tok);
    }
    return null;
  }

  const result = parseExpr();
  if (result === null || idx !== tokens.length || !Number.isFinite(result)) return null;
  return Number(result.toFixed(6));
}
