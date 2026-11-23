const NATIVE_HOST_NAME = 'com.dope.assistant';
const DEFAULT_SERVER_URL = '__DOPE_SERVER_URL__';

const ALLOWED_EXTENSION_ACTIONS = new Set([
  'open_url',
  'web_search',
  'web_workflow',
  'new_tab',
  'switch_tab',
  'reload_tab',
  'go_back',
  'go_forward',
  'mute_tab',
  'unmute_tab',
  'duplicate_tab',
  'scroll',
  'undo',
  'redo',
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
  gpt: 'https://chatgpt.com',
  openai: 'https://chatgpt.com',
  gemini: 'https://gemini.google.com',
  claude: 'https://claude.ai',
  perplexity: 'https://www.perplexity.ai',
  firebase: 'https://console.firebase.google.com',
  vercel: 'https://vercel.com/dashboard',
  notion: 'https://www.notion.so',
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

async function fetchWithTimeout(url, options = {}, timeoutMs = 1800) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

async function injectContentScriptIntoOpenTabs() {
  try {
    const tabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] });
    for (const tab of tabs) {
      if (!tab.id) continue;
      chrome.scripting
        .executeScript({
          target: { tabId: tab.id, allFrames: true },
          files: ['hotkey_content.js'],
        })
        .catch(() => {});
    }
  } catch {
    // Ignore tabs unavailable during startup
  }
}

chrome.runtime.onInstalled.addListener(() => {
  void injectContentScriptIntoOpenTabs();
});

chrome.runtime.onStartup.addListener(() => {
  void injectContentScriptIntoOpenTabs();
});

function normalizeHinglish(raw) {
  let text = String(raw || '')
    .trim()
    .replace(/^\s*(?:hey|hi|ok|okay|hello)\s+(?:el\s*dorado|eldorado|el-dorado|dop|dope|daap|top)\b[\s,.:!?-]*/i, '')
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

function resolveSiteUrl(rawSite) {
  const cleaned = String(rawSite || '')
    .trim()
    .toLowerCase()
    .replace(/^(?:the|my|website|site|app)\s+/i, '')
    .replace(/[.!?]+$/, '');
  const key = cleaned.replace(/\s+/g, '');
  if (KNOWN_SITES[key]) return KNOWN_SITES[key];
  if (/^https?:\/\//i.test(cleaned)) return cleaned;
  if (/^[a-z0-9-]+(?:\.[a-z]{2,})+(?:\/\S*)?$/i.test(cleaned)) return `https://${cleaned}`;
  return null;
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
  if (/^(?:undo(?:\s+(?:this|that|it|last))?|step\s+back|undo\s+karo|wapas\s+karo|piche\s+karo)[.!?]*$/i.test(lower)) {
    return {
      isDirectMatch: true,
      action: { action: 'undo', platform: 'browser_extension', requires_confirmation: false },
      spoken_response: 'Undoing the last action.',
    };
  }
  if (/^(?:redo(?:\s+(?:this|that|it))?|redo\s+karo)[.!?]*$/i.test(lower)) {
    return {
      isDirectMatch: true,
      action: { action: 'redo', platform: 'browser_extension', requires_confirmation: false },
      spoken_response: 'Redoing the action.',
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
  if (/\b(?:scroll\s+(?:to\s+)?bottom|sabse\s+neeche)\b/i.test(lower)) {
    return {
      isDirectMatch: true,
      action: { action: 'scroll', platform: 'browser_extension', requires_confirmation: false, parameters: { direction: 'bottom' } },
      spoken_response: 'Scrolling to bottom.',
    };
  }
  if (/\b(?:scroll\s+(?:to\s+)?top|sabse\s+upar)\b/i.test(lower)) {
    return {
      isDirectMatch: true,
      action: { action: 'scroll', platform: 'browser_extension', requires_confirmation: false, parameters: { direction: 'top' } },
      spoken_response: 'Scrolling to top.',
    };
  }
  if (/\b(?:scroll\s+up|scroll\s+above|upar\s+jao)\b/i.test(lower)) {
    return {
      isDirectMatch: true,
      action: { action: 'scroll', platform: 'browser_extension', requires_confirmation: false, parameters: { direction: 'up' } },
      spoken_response: 'Scrolling up.',
    };
  }
  if (/^(?:scroll(?:\s+(?:down|page|this|please|karo))?|please\s+scroll|scroll\s+the\s+page)$/i.test(lower) || /\b(?:scroll\s+down|neeche\s+jao)\b/i.test(lower)) {
    return {
      isDirectMatch: true,
      action: { action: 'scroll', platform: 'browser_extension', requires_confirmation: false, parameters: { direction: 'down' } },
      spoken_response: 'Scrolling down.',
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

  // Compound multi-step workflows (WhatsApp message, ChatGPT prompt, Flipkart/Amazon orders/cart, open+action)
  const waMatch =
    clean.match(/(?:open\s+)?whatsapp(?:\s+(?:web|app))?(?:\s+and)?\s+(?:send|message|msg|type)\s+(?:a\s+message\s+)?["']?(.+?)["']?\s+to\s+([a-z0-9 ._'-]+)[.!?]*$/i) ||
    clean.match(/(?:open\s+)?whatsapp(?:\s+(?:web|app))?(?:\s+and)?\s+(?:message|msg|text)\s+([a-z0-9 ._'-]+?)\s+(?:saying|with|hi|hello)?\s*["']?(.+?)["']?[.!?]*$/i) ||
    clean.match(/send\s+["']?(.+?)["']?\s+to\s+([a-z0-9 ._'-]+?)\s+(?:on|in)\s+whatsapp[.!?]*$/i);
  if (waMatch) {
    const isMsgSecond = /message|msg|text/i.test(clean) && !/\bto\b/i.test(clean);
    const msgText = (isMsgSecond ? waMatch[2] : waMatch[1] || 'Hi').trim();
    const recipient = (isMsgSecond ? waMatch[1] : waMatch[2] || '').trim();
    return {
      isDirectMatch: true,
      action: {
        action: 'web_workflow',
        target: 'https://web.whatsapp.com',
        platform: 'browser_extension',
        requires_confirmation: false,
        parameters: {
          workflow_type: 'whatsapp_send',
          recipient,
          message_text: msgText,
        },
      },
      spoken_response: `Opening WhatsApp and sending "${msgText}" to ${recipient}.`,
    };
  }

  const aiPromptMatch = clean.match(
    /^(?:open\s+)?(chat\s*gpt|gpt|openai|gemini|claude|perplexity)\s*(?:and\s+)?(?:type|write|ask|enter|submit|send)?(?:\s+a)?(?:\s+prompt)?[\s:,-]+["']?(.+?)["']?[.!?]*$/i
  );
  if (aiPromptMatch && aiPromptMatch[2]?.trim()) {
    const siteKey = aiPromptMatch[1].toLowerCase().replace(/\s+/g, '');
    const promptText = aiPromptMatch[2].trim();
    const targetUrl = resolveSiteUrl(siteKey) || 'https://chatgpt.com';
    return {
      isDirectMatch: true,
      action: {
        action: 'web_workflow',
        target: targetUrl,
        platform: 'browser_extension',
        requires_confirmation: false,
        parameters: {
          workflow_type: 'type_prompt',
          prompt_text: promptText,
        },
      },
      spoken_response: `Opening ${aiPromptMatch[1].trim()} and typing "${promptText}".`,
    };
  }

  const compoundMatch = clean.match(
    /^open\s+([a-z0-9 .-]+?)\s+(?:and\s+(?:go\s+to|open|click|search(?:\s+for)?|find|type)|go\s+to|search(?:\s+for)?)\s+(.+?)[.!?]*$/i
  );
  if (compoundMatch) {
    const rawSite = compoundMatch[1].trim();
    const subCommand = compoundMatch[2].trim();
    const siteKey = rawSite.toLowerCase().replace(/\s+/g, '');
    let targetUrl = resolveSiteUrl(rawSite) || `https://${siteKey}.com`;
    let workflowType = 'click_target';

    if (siteKey === 'flipkart' && /\border/i.test(subCommand)) {
      targetUrl = 'https://www.flipkart.com/account/orders';
    } else if (siteKey === 'flipkart' && /\bcart/i.test(subCommand)) {
      targetUrl = 'https://www.flipkart.com/viewcart';
    } else if (siteKey === 'amazon' && /\border/i.test(subCommand)) {
      targetUrl = 'https://www.amazon.in/gp/your-account/order-history';
    } else if (siteKey === 'amazon' && /\bcart/i.test(subCommand)) {
      targetUrl = 'https://www.amazon.in/gp/cart/view.html';
    } else if (/search|find/i.test(clean)) {
      workflowType = 'search_site';
    } else if (/type|prompt|write/i.test(clean)) {
      workflowType = 'type_prompt';
    }

    return {
      isDirectMatch: true,
      action: {
        action: 'web_workflow',
        target: targetUrl,
        platform: 'browser_extension',
        requires_confirmation: false,
        parameters: {
          workflow_type: workflowType,
          click_label: subCommand,
          query: subCommand,
          prompt_text: subCommand,
        },
      },
      spoken_response: `Opening ${rawSite} and navigating to ${subCommand}.`,
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

function evaluateSafeMath(exprText) {
  const cleaned = exprText
    .replace(/^(?:what is|calculate|solve|evaluate|kitna hota hai|batao)\s+/i, '')
    .replace(/\b(?:plus|aur|jodo)\b/gi, '+')
    .replace(/\b(?:minus|ghatao)\b/gi, '-')
    .replace(/\b(?:times|into|multiplied by|guna|x)\b/gi, '*')
    .replace(/\b(?:divided by|divide by|bhag)\b/gi, '/')
    .replace(/\b(?:kitna hota hai|hota hai|kya hoga|equals|\?|=)\b/gi, '')
    .trim();
  if (!/^[\d\s+\-*/().%]+$/.test(cleaned) || !/\d/.test(cleaned) || !/[+\-*/%]/.test(cleaned)) {
    return null;
  }
  const tokens = cleaned.match(/\d+(?:\.\d+)?|[+\-*/()%]/g);
  if (!tokens) return null;
  let pos = 0;
  const peek = () => tokens[pos];
  const eat = () => tokens[pos++];
  function parseExpr() {
    let val = parseTerm();
    while (peek() === '+' || peek() === '-') {
      const op = eat();
      const r = parseTerm();
      val = op === '+' ? val + r : val - r;
    }
    return val;
  }
  function parseTerm() {
    let val = parseFactor();
    while (peek() === '*' || peek() === '/' || peek() === '%') {
      const op = eat();
      const r = parseFactor();
      if ((op === '/' || op === '%') && r === 0) throw new Error('div0');
      val = op === '*' ? val * r : op === '/' ? val / r : val % r;
    }
    return val;
  }
  function parseFactor() {
    const t = peek();
    if (t === '-') { eat(); return -parseFactor(); }
    if (t === '+') { eat(); return parseFactor(); }
    if (t === '(') {
      eat();
      const v = parseExpr();
      if (eat() !== ')') throw new Error('paren');
      return v;
    }
    if (t && /^\d+(?:\.\d+)?$/.test(t)) { eat(); return Number(t); }
    throw new Error('token');
  }
  try {
    const val = parseExpr();
    if (pos !== tokens.length || !Number.isFinite(val)) return null;
    const rounded = Number.isInteger(val) ? String(val) : String(Number(val.toFixed(6)));
    return `${cleaned} = ${rounded}.`;
  } catch {
    return null;
  }
}

async function localAnswerQuestionFallback(cleanText) {
  const clean = normalizeHinglish(cleanText);
  const lower = clean.toLowerCase();

  const mathAns = evaluateSafeMath(clean);
  if (mathAns) return mathAns;

  if (/(?:what(?:'s| is) the time|current time|time kya|kitna baja|kitne baje)/i.test(lower)) {
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `The current time is ${now}.`;
  }
  if (/(?:what(?:'s| is) the date|today'?s date|aaj ki date|aaj kya tarikh)/i.test(lower)) {
    const today = new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    return `Today is ${today}.`;
  }
  if (/(?:who are you|tum kaun ho|what is (?:el\s*dorado|eldorado|dope))/i.test(lower)) {
    return 'I am El Dorado, your AI voice assistant. Ask me any question or speak any browser command.';
  }

  const topic = clean
    .replace(/^(?:what is|who is|who was|tell me about|explain|define|what are|kya hai|kaun hai)\s+(?:a |an |the )?/i, '')
    .replace(/\s*(?:kya hota hai|kya hai|kaun hai|batao|\?)+$/i, '')
    .trim();
  if (topic.length >= 2) {
    try {
      const sRes = await fetchWithTimeout(
        `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(topic)}&limit=1&namespace=0&format=json`,
        {},
        1800
      );
      if (sRes.ok) {
        const sData = await sRes.json();
        const title = sData?.[1]?.[0];
        if (title) {
          const sumRes = await fetchWithTimeout(
            `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`,
            {},
            1800
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
      // Fall through cleanly on fast timeout
    }
  }
  return null;
}

function waitForTabComplete(tabId, timeoutMs = 8000) {
  return new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      chrome.tabs.onUpdated.removeListener(onUpdated);
      clearTimeout(timer);
      resolve();
    };
    const onUpdated = (updatedTabId, info) => {
      if (updatedTabId === tabId && info.status === 'complete') {
        setTimeout(done, 450);
      }
    };
    chrome.tabs.onUpdated.addListener(onUpdated);
    const timer = setTimeout(done, timeoutMs);
    chrome.tabs.get(tabId, (t) => {
      if (t?.status === 'complete') {
        setTimeout(done, 350);
      }
    });
  });
}

async function executeWebWorkflow(cmd) {
  const url = cmd.target;
  if (!url || !isSafeHttpUrl(url)) {
    return { ok: false, error: 'Blocked unsafe or invalid workflow URL.' };
  }
  let targetHost = '';
  try {
    targetHost = new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return { ok: false, error: 'Invalid workflow URL.' };
  }

  const allTabs = await chrome.tabs.query({ lastFocusedWindow: true });
  let tab = allTabs.find((t) => {
    try {
      return t.url && new URL(t.url).hostname.replace(/^www\./, '') === targetHost;
    } catch {
      return false;
    }
  });

  if (tab?.id) {
    await chrome.tabs.update(tab.id, { active: true });
    // Navigate deep path for ecommerce sections if on home/different path
    if (url.length > `https://${targetHost}`.length + 3 && !(tab.url || '').startsWith(url)) {
      await chrome.tabs.update(tab.id, { url });
      await waitForTabComplete(tab.id, 7000);
    }
  } else {
    tab = await chrome.tabs.create({ url, active: true });
    if (tab?.id) {
      await waitForTabComplete(tab.id, 8000);
    }
  }

  if (!tab?.id) {
    return { ok: false, error: 'Could not open target tab.' };
  }

  const params = cmd.parameters || {};
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      args: [params],
      func: (workflowParams) => {
        const wfType = workflowParams.workflow_type || 'type_prompt';
        const waitAndRun = (attempt) => {
          if (wfType === 'type_prompt') {
            const promptText = String(workflowParams.prompt_text || '').trim();
            if (!promptText) return;
            const input =
              document.querySelector('#prompt-textarea') ||
              document.querySelector('textarea[placeholder*="Message"], textarea[placeholder*="Ask"], textarea') ||
              document.querySelector('[contenteditable="true"][role="textbox"], div[contenteditable="true"].ProseMirror');
            if (input) {
              input.focus();
              if (input instanceof HTMLTextAreaElement || input instanceof HTMLInputElement) {
                const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value')?.set;
                if (setter) setter.call(input, promptText);
                else input.value = promptText;
                input.dispatchEvent(new Event('input', { bubbles: true }));
              } else {
                input.textContent = promptText;
                input.dispatchEvent(new InputEvent('input', { bubbles: true, data: promptText }));
              }
              setTimeout(() => {
                const sendBtn =
                  document.querySelector('button[data-testid="send-button"]') ||
                  document.querySelector('button[aria-label*="Send" i]:not([disabled])') ||
                  document.querySelector('button[type="submit"]:not([disabled])');
                if (sendBtn instanceof HTMLElement) sendBtn.click();
              }, 220);
              return;
            }
          } else if (wfType === 'click_target') {
            const label = String(workflowParams.click_label || '').toLowerCase();
            if (label) {
              const els = Array.from(document.querySelectorAll('a, button, [role="link"], [role="button"]'));
              const match = els.find((el) => (el.textContent || '').toLowerCase().includes(label));
              if (match instanceof HTMLElement) {
                match.click();
                return;
              }
            }
          } else if (wfType === 'search_site') {
            const query = String(workflowParams.query || '').trim();
            const searchBox =
              document.querySelector('input[type="search"]') ||
              document.querySelector('input[name="q"], input[placeholder*="Search" i]');
            if (searchBox instanceof HTMLInputElement && query) {
              searchBox.focus();
              searchBox.value = query;
              searchBox.dispatchEvent(new Event('input', { bubbles: true }));
              searchBox.form?.submit();
              return;
            }
          } else if (wfType === 'whatsapp_send') {
            const recipient = String(workflowParams.recipient || '').trim();
            const msgText = String(workflowParams.message_text || 'Hi').trim();
            const searchBox =
              document.querySelector('[data-testid="chat-list-search"]') ||
              document.querySelector('div[contenteditable="true"][data-tab="3"]');
            if (searchBox instanceof HTMLElement && recipient) {
              searchBox.focus();
              document.execCommand('insertText', false, recipient);
              setTimeout(() => {
                const chats = Array.from(document.querySelectorAll('#pane-side [role="listitem"], #pane-side span[title]'));
                const targetChat = chats.find((el) =>
                  (el.getAttribute('title') || el.textContent || '').toLowerCase().includes(recipient.toLowerCase())
                );
                if (targetChat instanceof HTMLElement) {
                  targetChat.click();
                  setTimeout(() => {
                    const msgBox =
                      document.querySelector('footer div[contenteditable="true"][data-tab="10"]') ||
                      document.querySelector('footer div[contenteditable="true"]');
                    if (msgBox instanceof HTMLElement) {
                      msgBox.focus();
                      document.execCommand('insertText', false, msgText);
                      setTimeout(() => {
                        const sendBtn = document.querySelector('button[aria-label="Send"], span[data-icon="send"]');
                        if (sendBtn instanceof HTMLElement) sendBtn.click();
                      }, 250);
                    }
                  }, 500);
                }
              }, 700);
              return;
            }
          }
          if (attempt < 14) {
            setTimeout(() => waitAndRun(attempt + 1), 350);
          }
        };
        waitAndRun(0);
      },
    });
  } catch {
    // Tab opened even if site blocks late scripting
  }
  return { ok: true, tabId: tab.id, message: `Executed workflow on ${url}` };
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

      case 'web_workflow':
        return await executeWebWorkflow(cmd);

      case 'undo':
      case 'redo': {
        const [active] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        if (!active?.id) return { ok: false, error: 'No active tab.' };
        const isUndo = cmd.action === 'undo';
        await chrome.scripting
          .executeScript({
            target: { tabId: active.id },
            args: [isUndo],
            func: (undoMode) => {
              const activeEl = document.activeElement;
              const isEditable =
                activeEl &&
                (activeEl.tagName === 'TEXTAREA' ||
                  activeEl.tagName === 'INPUT' ||
                  activeEl.getAttribute('contenteditable') === 'true');
              if (isEditable) {
                document.execCommand(undoMode ? 'undo' : 'redo');
              } else if (undoMode) {
                window.history.back();
              } else {
                window.history.forward();
              }
            },
          })
          .catch(() => {});
        return { ok: true, message: isUndo ? 'Undid last action.' : 'Redid action.' };
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

  // Run direct matches immediately with zero network wait; query AI backend for open questions only (1.8s timeout)
  if (!localParsed.isDirectMatch) {
    const base = (serverUrl || DEFAULT_SERVER_URL || '').trim().replace(/\/+$/, '');
    if (base && /^https?:\/\//i.test(base)) {
      try {
        const [active] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        const res = await fetchWithTimeout(
          `${base}/api/dope/command`,
          {
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
          },
          1800
        );
        const contentType = (res.headers.get('content-type') || '').toLowerCase();
        if (res.ok && contentType.includes('application/json')) {
          interpreted = await res.json();
          source = interpreted.ai_source || 'server';
        }
      } catch {
        // Fall through cleanly on timeout/offline
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
          'Connect an El Dorado AI backend URL in Settings for full Gemini answers, or speak any browser command.',
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
        `Action "${action?.action ?? 'unknown'}" requires the El Dorado Desktop Companion.`,
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
          lang: stored.dopeLang || 'en-US',
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
