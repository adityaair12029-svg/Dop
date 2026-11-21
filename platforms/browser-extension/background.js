const NATIVE_HOST_NAME = 'com.dope.assistant';
const DEFAULT_SERVER_URL = '__DOPE_SERVER_URL__';

const ALLOWED_EXTENSION_ACTIONS = new Set([
  'open_url',
  'web_search',
  'new_tab',
  'switch_tab',
  'reload_tab',
  'go_back',
  'go_forward',
  'mute_tab',
  'unmute_tab',
  'duplicate_tab',
  'scroll',
  'zoom',
  'pdf_navigate_page',
  'pdf_fit',
  'minimize_window',
  'maximize_window',
  'restore_window',
  'close_window',
  'stop_listening',
  'clarify',
  'answer_question',
  'ping',
]);

const KNOWN_SITES = {
  youtube: 'https://www.youtube.com',
  yt: 'https://www.youtube.com',
  google: 'https://www.google.com',
  gmail: 'https://mail.google.com',
  mail: 'https://mail.google.com',
  github: 'https://github.com',
  wikipedia: 'https://www.wikipedia.org',
  reddit: 'https://www.reddit.com',
  chatgpt: 'https://chatgpt.com',
  gemini: 'https://gemini.google.com',
  instagram: 'https://www.instagram.com',
  insta: 'https://www.instagram.com',
  whatsapp: 'https://web.whatsapp.com',
  facebook: 'https://www.facebook.com',
  fb: 'https://www.facebook.com',
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

let nativePort = null;
let companionConnected = false;

function isSafeHttpUrl(raw) {
  try {
    const parsed = new URL(raw);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' || parsed.protocol === 'chrome:';
  } catch {
    return false;
  }
}

function normalizeHinglish(raw) {
  let text = String(raw || '')
    .trim()
    .replace(/^\s*(?:hey|hi|ok|okay|hello)\s+(?:dop|dope|daap|top)\b[\s,.:!?-]*/i, '')
    .replace(/^\s*(?:हे|हाय|हेलो)\s+(?:डॉप|डोप|दोप)\b[\s,।.:!?-]*/i, '')
    .replace(/\s+/g, ' ')
    .replace(/खोलो|चलाओ|ओपन करो|चालू करो/gi, 'kholo')
    .replace(/नीचे स्क्रॉल करो|neeche scroll karo/gi, 'scroll down')
    .replace(/ऊपर स्क्रॉल करो|upar scroll karo/gi, 'scroll up')
    .replace(/सुनना बंद करो|sunna band karo/gi, 'stop listening')
    .replace(/ज़ूम इन|zoom badhao/gi, 'zoom in')
    .replace(/ज़ूम आउट|zoom kam karo/gi, 'zoom out');

  const suffixOpen = text.match(/^(.+?)\s+(?:kholo|chalao|open karo|chalu karo)[.!?]*$/i);
  if (suffixOpen) text = `open ${suffixOpen[1].trim()}`;
  const suffixSearch = text.match(/^(.+?)\s+(?:search karo|dhundo|khojo)[.!?]*$/i);
  if (suffixSearch) text = `search for ${suffixSearch[1].trim()}`;
  return text.trim();
}

function parseLocalCommand(rawText) {
  const clean = normalizeHinglish(rawText);
  const lower = clean.toLowerCase();

  if (!clean) {
    return {
      isDirectMatch: true,
      action: { action: 'clarify', platform: 'browser_extension', requires_confirmation: false },
      spoken_response: 'Yes, I heard you. Speak any command!',
    };
  }
  if (/stop listening|band karo|chup/i.test(lower)) {
    return {
      isDirectMatch: true,
      action: { action: 'stop_listening', platform: 'browser_extension', requires_confirmation: false },
      spoken_response: 'Voice listening stopped.',
    };
  }
  if (/(?:new\s+tab|naya\s+tab)/i.test(lower)) {
    return {
      isDirectMatch: true,
      action: { action: 'new_tab', platform: 'browser_extension', requires_confirmation: false },
      spoken_response: 'Opening a new tab.',
    };
  }
  if (/duplicate\s+tab/i.test(lower)) {
    return {
      isDirectMatch: true,
      action: { action: 'duplicate_tab', platform: 'browser_extension', requires_confirmation: false },
      spoken_response: 'Duplicating this tab.',
    };
  }
  if (/(?:go\s+back|back\s+jao|peeche\s+jao|wapas\s+jao)/i.test(lower)) {
    return {
      isDirectMatch: true,
      action: { action: 'go_back', platform: 'browser_extension', requires_confirmation: false },
      spoken_response: 'Going back.',
    };
  }
  if (/(?:go\s+forward|aage\s+jao)/i.test(lower)) {
    return {
      isDirectMatch: true,
      action: { action: 'go_forward', platform: 'browser_extension', requires_confirmation: false },
      spoken_response: 'Going forward.',
    };
  }
  if (/unmute/i.test(lower)) {
    return {
      isDirectMatch: true,
      action: { action: 'unmute_tab', platform: 'browser_extension', requires_confirmation: false },
      spoken_response: 'Unmuting this tab.',
    };
  }
  if (/mute/i.test(lower)) {
    return {
      isDirectMatch: true,
      action: { action: 'mute_tab', platform: 'browser_extension', requires_confirmation: false },
      spoken_response: 'Muting this tab.',
    };
  }
  if (/scroll\s+(?:to\s+)?bottom|sabse\s+neeche/i.test(lower)) {
    return {
      isDirectMatch: true,
      action: { action: 'scroll', platform: 'browser_extension', requires_confirmation: false, parameters: { direction: 'bottom' } },
      spoken_response: 'Scrolling to bottom.',
    };
  }
  if (/scroll\s+(?:to\s+)?top|sabse\s+upar/i.test(lower)) {
    return {
      isDirectMatch: true,
      action: { action: 'scroll', platform: 'browser_extension', requires_confirmation: false, parameters: { direction: 'top' } },
      spoken_response: 'Scrolling to top.',
    };
  }
  if (/scroll\s+down|neeche\s+jao/i.test(lower)) {
    return {
      isDirectMatch: true,
      action: { action: 'scroll', platform: 'browser_extension', requires_confirmation: false, parameters: { direction: 'down' } },
      spoken_response: 'Scrolling down.',
    };
  }
  if (/scroll\s+up|upar\s+jao/i.test(lower)) {
    return {
      isDirectMatch: true,
      action: { action: 'scroll', platform: 'browser_extension', requires_confirmation: false, parameters: { direction: 'up' } },
      spoken_response: 'Scrolling up.',
    };
  }
  if (/zoom\s+in/i.test(lower)) {
    return {
      isDirectMatch: true,
      action: { action: 'zoom', platform: 'browser_extension', requires_confirmation: false, parameters: { direction: 'in' } },
      spoken_response: 'Zooming in.',
    };
  }
  if (/zoom\s+out/i.test(lower)) {
    return {
      isDirectMatch: true,
      action: { action: 'zoom', platform: 'browser_extension', requires_confirmation: false, parameters: { direction: 'out' } },
      spoken_response: 'Zooming out.',
    };
  }
  if (/reset\s+zoom/i.test(lower)) {
    return {
      isDirectMatch: true,
      action: { action: 'zoom', platform: 'browser_extension', requires_confirmation: false, parameters: { direction: 'reset' } },
      spoken_response: 'Zoom reset to 100%.',
    };
  }
  if (/next\s+tab|agla\s+tab|switch\s+tab/i.test(lower)) {
    return {
      isDirectMatch: true,
      action: { action: 'switch_tab', platform: 'browser_extension', requires_confirmation: false, parameters: { direction: 'next' } },
      spoken_response: 'Switching to next tab.',
    };
  }
  if (/prev(?:ious)?\s+tab|pichla\s+tab/i.test(lower)) {
    return {
      isDirectMatch: true,
      action: { action: 'switch_tab', platform: 'browser_extension', requires_confirmation: false, parameters: { direction: 'previous' } },
      spoken_response: 'Switching to previous tab.',
    };
  }
  if (/reload|refresh/i.test(lower)) {
    return {
      isDirectMatch: true,
      action: { action: 'reload_tab', platform: 'browser_extension', requires_confirmation: false },
      spoken_response: 'Reloading this tab.',
    };
  }
  if (/minimize/i.test(lower)) {
    return {
      isDirectMatch: true,
      action: { action: 'minimize_window', platform: 'browser_extension', requires_confirmation: false },
      spoken_response: 'Minimizing Chrome window.',
    };
  }
  if (/maximize|full\s*screen/i.test(lower)) {
    return {
      isDirectMatch: true,
      action: { action: 'maximize_window', platform: 'browser_extension', requires_confirmation: false },
      spoken_response: 'Maximizing Chrome window.',
    };
  }
  if (/restore/i.test(lower)) {
    return {
      isDirectMatch: true,
      action: { action: 'restore_window', platform: 'browser_extension', requires_confirmation: false },
      spoken_response: 'Restoring Chrome window.',
    };
  }
  if (/close\s*(?:this\s*)?tab|tab\s+band\s+karo/i.test(lower)) {
    return {
      isDirectMatch: true,
      action: { action: 'close_window', platform: 'browser_extension', requires_confirmation: false },
      spoken_response: 'Closing current tab.',
    };
  }

  // YouTube play/search
  const ytPlayMatch =
    clean.match(/(?:play|search)\s+(.+?)\s+(?:on|in|pe|par)\s+youtube/i) ||
    clean.match(/youtube\s+(?:pe|par|search)\s+(.+?)(?:\s+(?:chalao|bajao|play|search|kholo))?$/i);
  if (ytPlayMatch && ytPlayMatch[1]?.trim()) {
    const q = ytPlayMatch[1].trim();
    return {
      isDirectMatch: true,
      action: {
        action: 'open_url',
        target: `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`,
        platform: 'browser_extension',
        requires_confirmation: false,
      },
      spoken_response: `Searching YouTube for ${q}.`,
    };
  }

  const searchMatch = clean.match(/(?:search\s+(?:for\s+)?|google\s+)(.+)/i);
  if (searchMatch) {
    const q = searchMatch[1].trim();
    return {
      isDirectMatch: true,
      action: {
        action: 'web_search',
        target: `https://www.google.com/search?q=${encodeURIComponent(q)}`,
        platform: 'browser_extension',
        requires_confirmation: false,
        parameters: { query: q },
      },
      spoken_response: `Searching Google for ${q}.`,
    };
  }

  const openMatch = clean.match(/open\s+(.+)/i);
  if (openMatch) {
    const rawTarget = openMatch[1].trim().replace(/[.!?]+$/, '');
    const key = rawTarget.toLowerCase().replace(/\s+/g, '');
    if (key === 'history') {
      return {
        isDirectMatch: true,
        action: { action: 'open_url', target: 'chrome://history', platform: 'browser_extension', requires_confirmation: false },
        spoken_response: 'Opening Chrome History.',
      };
    }
    if (key === 'downloads') {
      return {
        isDirectMatch: true,
        action: { action: 'open_url', target: 'chrome://downloads', platform: 'browser_extension', requires_confirmation: false },
        spoken_response: 'Opening Chrome Downloads.',
      };
    }
    if (key === 'settings') {
      return {
        isDirectMatch: true,
        action: { action: 'open_url', target: 'chrome://settings', platform: 'browser_extension', requires_confirmation: false },
        spoken_response: 'Opening Chrome Settings.',
      };
    }
    if (key === 'bookmarks') {
      return {
        isDirectMatch: true,
        action: { action: 'open_url', target: 'chrome://bookmarks', platform: 'browser_extension', requires_confirmation: false },
        spoken_response: 'Opening Chrome Bookmarks.',
      };
    }
    const mapped = KNOWN_SITES[key];
    if (mapped) {
      return {
        isDirectMatch: true,
        action: { action: 'open_url', target: mapped, platform: 'browser_extension', requires_confirmation: false },
        spoken_response: `Opening ${rawTarget}.`,
      };
    }
    if (/^https?:\/\//i.test(rawTarget) || /\.[a-z]{2,}$/i.test(rawTarget)) {
      const url = /^https?:\/\//i.test(rawTarget) ? rawTarget : `https://${rawTarget}`;
      return {
        isDirectMatch: true,
        action: { action: 'open_url', target: url, platform: 'browser_extension', requires_confirmation: false },
        spoken_response: `Opening ${url}.`,
      };
    }
    // Any other "open X" resolves cleanly via web search
    return {
      isDirectMatch: true,
      action: {
        action: 'web_search',
        target: `https://www.google.com/search?q=${encodeURIComponent(rawTarget)}`,
        platform: 'browser_extension',
        requires_confirmation: false,
      },
      spoken_response: `Opening search results for ${rawTarget}.`,
    };
  }

  const cleanLower = clean.toLowerCase();
  const looksLikeQuestion =
    /\?$/.test(clean) ||
    /^(?:what|who|why|how|when|where|which|explain|define|tell me|can you|could you|write|kya|kaun|kaise|kyu|kab|kahan|batao|samjhao)\b/i.test(cleanLower) ||
    /\b(?:kya hota hai|kya hai|kaun hai|kaise kare|kitna hota hai|ke baare me)\b/i.test(cleanLower);

  return {
    isDirectMatch: false,
    isQuestion: looksLikeQuestion,
    action: {
      action: looksLikeQuestion ? 'answer_question' : 'web_search',
      target: looksLikeQuestion ? undefined : `https://www.google.com/search?q=${encodeURIComponent(clean)}`,
      platform: 'browser_extension',
      requires_confirmation: false,
      parameters: { query: clean },
    },
    spoken_response: looksLikeQuestion
      ? 'Thinking of the answer...'
      : `Searching Google for "${clean}".`,
  };
}

async function localAnswerQuestionFallback(cleanText) {
  const clean = normalizeHinglish(cleanText);
  const lower = clean.toLowerCase();

  if (/(?:what(?:'s| is) the time|current time|time kya|kitna baja|kitne baje)/i.test(lower)) {
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `Abhi time ${now} hai.`;
  }
  if (/(?:what(?:'s| is) the date|today'?s date|aaj ki date|aaj kya tarikh)/i.test(lower)) {
    const today = new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    return `Aaj ${today} hai.`;
  }
  if (/(?:who are you|tum kaun ho|what is dope)/i.test(lower)) {
    return 'Main DOPE hoon, aapka AI voice assistant. Aap mujhse koi bhi sawal pooch sakte ho ya browser commands de sakte ho.';
  }

  // Wikipedia summary lookup for factual Q&A even offline from backend
  const topic = clean
    .replace(/^(?:what is|who is|who was|tell me about|explain|define|what are|kya hai|kaun hai)\s+(?:a |an |the )?/i, '')
    .replace(/\s*(?:kya hota hai|kya hai|kaun hai|batao|\?)+$/i, '')
    .trim();
  if (topic.length >= 2) {
    try {
      const sRes = await fetch(
        `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(topic)}&limit=1&namespace=0&format=json`
      );
      if (sRes.ok) {
        const sData = await sRes.json();
        const title = sData?.[1]?.[0];
        if (title) {
          const sumRes = await fetch(
            `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`
          );
          if (sumRes.ok) {
            const sumJson = await sumRes.json();
            if (sumJson.extract) {
              return sumJson.extract.split(/(?<=[.!?])\s+/).slice(0, 2).join(' ');
            }
          }
        }
      }
    } catch {
      // Fall through cleanly
    }
  }
  return null;
}

function connectNativeCompanion() {
  try {
    nativePort = chrome.runtime.connectNative(NATIVE_HOST_NAME);
    companionConnected = true;
    nativePort.onMessage.addListener(async (msg) => {
      if (!msg || typeof msg !== 'object' || !ALLOWED_EXTENSION_ACTIONS.has(msg.action)) {
        sendToNative({ ok: false, error: 'Rejected unlisted command.' });
        return;
      }
      const result = await executeBrowserAction(msg);
      sendToNative({ requestId: msg.requestId, ...result });
    });
    nativePort.onDisconnect.addListener(() => {
      companionConnected = false;
      nativePort = null;
    });
  } catch {
    companionConnected = false;
    nativePort = null;
  }
}

function sendToNative(payload) {
  if (nativePort && companionConnected) {
    nativePort.postMessage(payload);
  }
}

async function executeBrowserAction(cmd) {
  try {
    switch (cmd.action) {
      case 'ping':
        return { ok: true, message: 'Extension ready.' };

      case 'clarify':
      case 'stop_listening':
      case 'answer_question':
        return { ok: true, message: 'Ready.' };

      case 'new_tab': {
        const tab = await chrome.tabs.create({});
        return { ok: true, tabId: tab.id, message: 'Opened new tab.' };
      }

      case 'open_url':
      case 'web_search': {
        const url = cmd.target;
        if (!url || !isSafeHttpUrl(url)) {
          return { ok: false, error: 'Blocked unsafe or invalid URL.' };
        }
        const tab = await chrome.tabs.create({ url });
        return { ok: true, tabId: tab.id, message: `Opened ${url}` };
      }

      case 'duplicate_tab': {
        const [active] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        if (!active?.id) return { ok: false, error: 'No active tab to duplicate.' };
        await chrome.tabs.duplicate(active.id);
        return { ok: true, message: 'Duplicated tab.' };
      }

      case 'go_back': {
        const [active] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        if (!active?.id) return { ok: false, error: 'No active tab.' };
        await chrome.tabs.goBack(active.id);
        return { ok: true, message: 'Navigated back.' };
      }

      case 'go_forward': {
        const [active] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        if (!active?.id) return { ok: false, error: 'No active tab.' };
        await chrome.tabs.goForward(active.id);
        return { ok: true, message: 'Navigated forward.' };
      }

      case 'mute_tab':
      case 'unmute_tab': {
        const [active] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        if (!active?.id) return { ok: false, error: 'No active tab.' };
        const muted = cmd.action === 'mute_tab';
        await chrome.tabs.update(active.id, { muted });
        return { ok: true, message: muted ? 'Tab muted.' : 'Tab unmuted.' };
      }

      case 'reload_tab': {
        const [active] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        if (!active?.id) return { ok: false, error: 'No active browser tab found.' };
        await chrome.tabs.reload(active.id);
        return { ok: true, message: `Reloaded "${active.title || 'current tab'}".` };
      }

      case 'switch_tab': {
        const tabs = await chrome.tabs.query({ lastFocusedWindow: true });
        const activeIdx = tabs.findIndex((t) => t.active);
        if (activeIdx === -1 || tabs.length < 2) {
          return { ok: false, error: 'Open at least 2 tabs in this window to switch.' };
        }
        const dir = cmd.parameters?.direction === 'previous' ? -1 : 1;
        const nextIdx = (activeIdx + dir + tabs.length) % tabs.length;
        await chrome.tabs.update(tabs[nextIdx].id, { active: true });
        return { ok: true, message: `Switched to "${tabs[nextIdx].title}".` };
      }

      case 'zoom': {
        const [active] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        if (!active?.id) return { ok: false, error: 'No active tab.' };
        const current = await chrome.tabs.getZoom(active.id);
        const dir = cmd.parameters?.direction;
        let nextZoom = 1.0;
        if (dir === 'in') nextZoom = Math.min(3.0, Number((current + 0.15).toFixed(2)));
        else if (dir === 'out') nextZoom = Math.max(0.5, Number((current - 0.15).toFixed(2)));
        await chrome.tabs.setZoom(active.id, nextZoom);
        return { ok: true, message: `Tab zoom set to ${Math.round(nextZoom * 100)}%.` };
      }

      case 'scroll': {
        const [active] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        if (!active?.id) return { ok: false, error: 'No active tab.' };
        if (
          active.url?.startsWith('chrome://') ||
          active.url?.startsWith('edge://') ||
          active.url?.startsWith('chrome-extension://')
        ) {
          return { ok: false, error: 'Browser internal pages block scroll injection.' };
        }
        const dir = cmd.parameters?.direction || 'down';
        await chrome.scripting.executeScript({
          target: { tabId: active.id },
          func: (direction) => {
            if (direction === 'top') window.scrollTo({ top: 0, behavior: 'smooth' });
            else if (direction === 'bottom') window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
            else window.scrollBy({ top: direction === 'up' ? -520 : 520, behavior: 'smooth' });
          },
          args: [dir],
        });
        return { ok: true, message: `Scrolled ${dir}.` };
      }

      case 'minimize_window': {
        const win = await chrome.windows.getLastFocused();
        if (!win?.id) return { ok: false, error: 'No active browser window.' };
        await chrome.windows.update(win.id, { state: 'minimized' });
        return { ok: true, message: 'Minimized Chrome window.' };
      }

      case 'maximize_window': {
        const win = await chrome.windows.getLastFocused();
        if (!win?.id) return { ok: false, error: 'No active browser window.' };
        await chrome.windows.update(win.id, { state: 'maximized' });
        return { ok: true, message: 'Maximized Chrome window.' };
      }

      case 'restore_window': {
        const win = await chrome.windows.getLastFocused();
        if (!win?.id) return { ok: false, error: 'No active browser window.' };
        await chrome.windows.update(win.id, { state: 'normal' });
        return { ok: true, message: 'Restored Chrome window.' };
      }

      case 'close_window': {
        const [active] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        if (!active?.id) return { ok: false, error: 'No active tab to close.' };
        await chrome.tabs.remove(active.id);
        return { ok: true, message: 'Closed current tab.' };
      }

      case 'pdf_navigate_page':
      case 'pdf_fit': {
        return {
          ok: false,
          error:
            'Built-in Chrome PDF viewer restricts page-jump scripts. Use zoom/reload here, or connect Desktop Companion.',
        };
      }

      default:
        return {
          ok: false,
          error: `Action "${cmd.action}" requires the Desktop Companion app.`,
        };
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function handleVoiceOrTextCommand(text, serverUrl) {
  const cleanText = String(text || '').trim();
  if (!cleanText) return { ok: false, error: 'Empty command.' };

  const localParsed = parseLocalCommand(cleanText);
  let interpreted = null;
  let source = 'extension_local';

  // Run direct Chrome-native matches instantaneously; ask Gemini backend for complex queries
  if (!localParsed.isDirectMatch) {
    const base = (serverUrl || DEFAULT_SERVER_URL || '').trim().replace(/\/+$/, '');
    if (base && /^https?:\/\//i.test(base)) {
      try {
        const [active] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        const res = await fetch(`${base}/api/dope/command`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: cleanText,
            context: {
              platform: 'browser_extension',
              extension_connected: true,
              companion_connected: companionConnected,
              active_app: 'Google Chrome',
              active_window_title: active?.title || 'Chrome Tab',
            },
          }),
        });
        if (res.ok) {
          interpreted = await res.json();
          source = interpreted.ai_source || 'server';
        }
      } catch {
        // Fall back smoothly
      }
    }
  }

  if (!interpreted) {
    if (localParsed.isQuestion) {
      const localAnswer = await localAnswerQuestionFallback(cleanText);
      interpreted = {
        action: { action: 'answer_question', platform: 'browser_extension', requires_confirmation: false },
        spoken_response:
          localAnswer ||
          'Backend Gemini server se connect karke full AI answers paayein, ya direct command bolein.',
      };
    } else {
      interpreted = localParsed;
    }
  }

  const action = interpreted.action;
  if (!action || !ALLOWED_EXTENSION_ACTIONS.has(action.action)) {
    return {
      ok: false,
      source,
      spoken_response:
        interpreted.spoken_response ||
        `Action "${action?.action ?? 'unknown'}" requires the DOPE Desktop Companion.`,
      action,
    };
  }

  if (action.requires_confirmation) {
    return {
      ok: false,
      requires_confirmation: true,
      source,
      spoken_response: interpreted.spoken_response,
      action,
    };
  }

  const execResult = await executeBrowserAction(action);
  return {
    ok: execResult.ok,
    source,
    action,
    spoken_response: execResult.ok
      ? interpreted.spoken_response
      : execResult.error || 'Could not execute action.',
    execResult,
  };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'get_status') {
    chrome.storage.local.get(
      ['dopeServerUrl', 'autoListenPending', 'dopeSoundEnabled', 'dopeLang'],
      (stored) => {
        const pending =
          typeof stored.autoListenPending === 'number' &&
          Date.now() - stored.autoListenPending < 8000;
        if (pending) {
          chrome.storage.local.remove('autoListenPending');
        }
        sendResponse({
          companionConnected,
          serverUrl: stored.dopeServerUrl || DEFAULT_SERVER_URL,
          autoListen: pending,
          soundEnabled: stored.dopeSoundEnabled !== false,
          lang: stored.dopeLang || 'en-IN',
        });
      }
    );
    return true;
  }

  if (msg?.type === 'save_prefs') {
    chrome.storage.local.set(
      {
        ...(msg.serverUrl !== undefined ? { dopeServerUrl: msg.serverUrl || '' } : {}),
        ...(msg.soundEnabled !== undefined ? { dopeSoundEnabled: Boolean(msg.soundEnabled) } : {}),
        ...(msg.lang !== undefined ? { dopeLang: msg.lang } : {}),
      },
      () => sendResponse({ ok: true })
    );
    return true;
  }

  if (msg?.type === 'save_server_url') {
    chrome.storage.local.set({ dopeServerUrl: msg.serverUrl || '' }, () => {
      sendResponse({ ok: true });
    });
    return true;
  }

  if (msg?.type === 'run_command') {
    chrome.storage.local.get(['dopeServerUrl'], (stored) => {
      handleVoiceOrTextCommand(msg.text, msg.serverUrl || stored.dopeServerUrl).then(sendResponse);
    });
    return true;
  }

  return false;
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'activate-dope') {
    await chrome.storage.local.set({ autoListenPending: Date.now() });
    if (chrome.sidePanel?.open) {
      try {
        const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        if (tab?.windowId) {
          await chrome.sidePanel.open({ windowId: tab.windowId });
        }
      } catch {
        // Ignore if window unavailable
      }
    }
    chrome.runtime.sendMessage({ type: 'dope_activate_now' }).catch(() => {});
  }
});

connectNativeCompanion();
