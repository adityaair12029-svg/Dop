const micBtn = document.getElementById('micBtn');
const wakeBtn = document.getElementById('wakeBtn');
const statusEl = document.getElementById('orbStatus');
const subEl = document.getElementById('orbSub');
const waveBarsEl = document.getElementById('waveBars');
const formEl = document.getElementById('cmdForm');
const inputEl = document.getElementById('cmdInput');
const feedEl = document.getElementById('feed');
const sidePanelBtn = document.getElementById('openSidePanelBtn');
const serverInput = document.getElementById('serverUrlInput');
const saveServerBtn = document.getElementById('saveServerBtn');
const settingsToggleBtn = document.getElementById('settingsToggleBtn');
const settingsBox = document.getElementById('settingsBox');
const soundToggleBtn = document.getElementById('soundToggleBtn');
const langSelect = document.getElementById('langSelect');

let recognition = null;
let isListening = false;
let wakeMode = false;
let soundEnabled = true;
let selectedLang = 'en-IN';
let currentServerUrl = '';

function playToneSequence(notes) {
  if (!soundEnabled) return;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    notes.forEach(([freq, delay, dur, peak]) => {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const g1 = ctx.createGain();
      const g2 = ctx.createGain();
      osc1.type = 'sine';
      osc2.type = 'triangle';
      osc1.frequency.setValueAtTime(freq, now + delay);
      osc2.frequency.setValueAtTime(freq * 2, now + delay);
      g1.gain.setValueAtTime(0.001, now + delay);
      g1.gain.exponentialRampToValueAtTime(peak, now + delay + 0.018);
      g1.gain.exponentialRampToValueAtTime(0.0008, now + delay + dur);
      g2.gain.setValueAtTime(0.0005, now + delay);
      g2.gain.exponentialRampToValueAtTime(peak * 0.28, now + delay + 0.015);
      g2.gain.exponentialRampToValueAtTime(0.0004, now + delay + dur * 0.75);
      osc1.connect(g1);
      osc2.connect(g2);
      g1.connect(ctx.destination);
      g2.connect(ctx.destination);
      osc1.start(now + delay);
      osc2.start(now + delay);
      osc1.stop(now + delay + dur + 0.03);
      osc2.stop(now + delay + dur + 0.03);
    });
    setTimeout(() => ctx.close().catch(() => {}), 1100);
  } catch {
    // Ignore audio context autoplay errors
  }
}

function playActivateSound() {
  playToneSequence([
    [523.25, 0, 0.18, 0.13],
    [659.25, 0.06, 0.2, 0.12],
    [783.99, 0.12, 0.22, 0.12],
    [1174.66, 0.18, 0.3, 0.1],
  ]);
}

function playExecutingSound() {
  playToneSequence([
    [659.25, 0, 0.1, 0.09],
    [880.0, 0.06, 0.14, 0.09],
  ]);
}

function playSuccessSound() {
  playToneSequence([
    [783.99, 0, 0.14, 0.1],
    [987.77, 0.07, 0.16, 0.1],
    [1174.66, 0.14, 0.24, 0.11],
  ]);
}

function playErrorSound() {
  playToneSequence([
    [293.66, 0, 0.15, 0.1],
    [261.63, 0.11, 0.22, 0.09],
  ]);
}

function addChatBubble(role, text, meta) {
  const empty = feedEl.querySelector('.empty-hint');
  if (empty) empty.remove();

  const row = document.createElement('div');
  row.className = `bubble-row ${role === 'You' ? 'user' : 'dope'}`;

  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.textContent = text;
  row.appendChild(bubble);

  if (meta) {
    const metaEl = document.createElement('div');
    metaEl.className = 'bubble-meta';
    metaEl.textContent = meta;
    row.appendChild(metaEl);
  }

  feedEl.appendChild(row);
  feedEl.scrollTop = feedEl.scrollHeight;
}

function speakReply(text) {
  if (!text || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = selectedLang || 'en-IN';
    utterance.rate = 1.04;
    window.speechSynthesis.speak(utterance);
  } catch {
    // Ignore speech synthesis restrictions
  }
}

function setWaveActive(active) {
  if (!waveBarsEl) return;
  waveBarsEl.classList.toggle('active', active);
}

function runCommand(text) {
  const clean = text.trim();
  if (!clean) return;
  addChatBubble('You', clean);
  playExecutingSound();
  micBtn.classList.remove('listening');
  micBtn.classList.add('executing');
  setWaveActive(true);
  statusEl.textContent = 'Executing command...';
  subEl.textContent = clean;

  chrome.runtime.sendMessage(
    { type: 'run_command', text: clean, serverUrl: currentServerUrl },
    (res) => {
      micBtn.classList.remove('executing');
      setWaveActive(isListening);

      if (chrome.runtime.lastError) {
        playErrorSound();
        statusEl.textContent = 'Extension worker error';
        addChatBubble('DOPE', chrome.runtime.lastError.message, 'error');
        return;
      }

      const reply = res?.spoken_response || 'Done.';
      if (res?.ok) {
        playSuccessSound();
        statusEl.textContent = 'Executed';
      } else {
        playErrorSound();
        statusEl.textContent = 'Notice';
      }
      subEl.textContent = reply;
      addChatBubble('DOPE', reply, res?.action?.action ? res.action.action.replace(/_/g, ' ') : '');
      speakReply(reply);

      if (res?.action?.action === 'stop_listening') {
        stopListening();
      } else if (isListening) {
        micBtn.classList.add('listening');
      }
    }
  );
}

function stopListening() {
  isListening = false;
  wakeMode = false;
  try {
    recognition?.stop();
  } catch {
    // Ignore
  }
  recognition = null;
  micBtn.classList.remove('listening', 'executing');
  setWaveActive(false);
  wakeBtn.classList.remove('active');
  wakeBtn.textContent = 'Hey Dop Mode';
  statusEl.textContent = 'Hey Dop is ready';
  subEl.textContent = 'Press Alt + D or tap the orb to speak.';
}

function startListening(useWakeWord) {
  playActivateSound();
  const SpeechCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechCtor) {
    statusEl.textContent = 'Speech recognition unavailable';
    subEl.textContent = 'Type your command below or check Chrome microphone permissions.';
    inputEl.focus();
    return;
  }

  try {
    recognition?.stop();
  } catch {
    // Ignore previous session
  }

  wakeMode = useWakeWord;
  isListening = true;
  recognition = new SpeechCtor();
  recognition.continuous = useWakeWord;
  recognition.interimResults = false;
  recognition.lang = selectedLang || 'en-IN';

  micBtn.classList.add('listening');
  setWaveActive(true);
  wakeBtn.classList.toggle('active', useWakeWord);
  wakeBtn.textContent = useWakeWord ? 'Stop "Hey Dop"' : 'Hey Dop Mode';
  statusEl.textContent = useWakeWord ? 'Waiting for "Hey Dop"...' : 'Listening... Speak now';
  subEl.textContent = useWakeWord
    ? 'Say "Hey Dop, open YouTube" or "Hey Dop, scroll down"'
    : 'Listening for English, Hindi, or Hinglish command';

  recognition.onresult = (event) => {
    const last = event.results[event.results.length - 1];
    const transcript = (last?.[0]?.transcript || '').trim();
    if (!transcript) return;
    if (wakeMode) {
      if (/^\s*(?:hey|hi|ok|okay|hello)\s+(?:dop|dope|daap)\b/i.test(transcript)) {
        runCommand(transcript);
      }
    } else {
      isListening = false;
      micBtn.classList.remove('listening');
      runCommand(transcript);
    }
  };

  recognition.onerror = (ev) => {
    if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') {
      playErrorSound();
      subEl.textContent = 'Chrome needs mic permission once: ';
      const btn = document.createElement('button');
      btn.id = 'grantMicTabBtn';
      btn.className = 'icon-btn';
      btn.type = 'button';
      btn.textContent = 'Allow Mic in Tab';
      btn.addEventListener('click', () => {
        chrome.tabs.create({ url: chrome.runtime.getURL('sidepanel.html') });
      });
      subEl.appendChild(btn);
      isListening = false;
      micBtn.classList.remove('listening');
      setWaveActive(false);
    } else if (ev.error === 'no-speech' && isListening && !wakeMode) {
      stopListening();
    }
  };

  recognition.onend = () => {
    if (isListening && wakeMode) {
      try {
        recognition.start();
      } catch {
        stopListening();
      }
    } else if (isListening) {
      isListening = false;
      micBtn.classList.remove('listening');
      setWaveActive(false);
      statusEl.textContent = 'Hey Dop is ready';
    }
  };

  try {
    recognition.start();
  } catch {
    stopListening();
  }
}

micBtn.addEventListener('click', () => {
  if (isListening) stopListening();
  else startListening(false);
});

wakeBtn.addEventListener('click', () => {
  if (isListening && wakeMode) stopListening();
  else startListening(true);
});

soundToggleBtn.addEventListener('click', () => {
  soundEnabled = !soundEnabled;
  soundToggleBtn.classList.toggle('active', soundEnabled);
  soundToggleBtn.textContent = soundEnabled ? 'Sound On' : 'Sound Off';
  chrome.runtime.sendMessage({ type: 'save_prefs', soundEnabled });
  if (soundEnabled) playActivateSound();
});

langSelect.addEventListener('change', () => {
  selectedLang = langSelect.value;
  chrome.runtime.sendMessage({ type: 'save_prefs', lang: selectedLang });
});

formEl.addEventListener('submit', (e) => {
  e.preventDefault();
  const val = inputEl.value;
  inputEl.value = '';
  runCommand(val);
});

document.querySelectorAll('.quick-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    runCommand(btn.getAttribute('data-cmd') || btn.textContent || '');
  });
});

if (sidePanelBtn) {
  sidePanelBtn.addEventListener('click', async () => {
    if (chrome.sidePanel?.open) {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.windowId) {
        await chrome.sidePanel.open({ windowId: tab.windowId });
        window.close();
      }
    }
  });
}

settingsToggleBtn.addEventListener('click', () => {
  settingsBox.hidden = !settingsBox.hidden;
});

saveServerBtn.addEventListener('click', () => {
  currentServerUrl = serverInput.value.trim();
  chrome.runtime.sendMessage(
    { type: 'save_server_url', serverUrl: currentServerUrl },
    () => {
      subEl.textContent = currentServerUrl
        ? `Connected backend: ${currentServerUrl}`
        : 'Using built-in offline Chrome parser.';
      playSuccessSound();
    }
  );
});

const extPressed = new Set();
window.addEventListener('blur', () => extPressed.clear());
window.addEventListener('keyup', (e) => extPressed.delete(e.key.toLowerCase()));
window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  extPressed.add(k);
  const isAltDT = e.altKey && extPressed.has('d') && extPressed.has('t');
  const isAltD = e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && k === 'd';
  if (isAltDT || isAltD) {
    e.preventDefault();
    if (!isListening) startListening(false);
    else if (isAltD && !extPressed.has('t')) stopListening();
  }
});

// Auto-activate when background.js triggers Alt+D command
chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === 'dope_activate_now') {
    startListening(false);
  }
});

chrome.runtime.sendMessage({ type: 'get_status' }, (res) => {
  if (res) {
    currentServerUrl = res.serverUrl || '';
    serverInput.value = currentServerUrl;
    soundEnabled = res.soundEnabled !== false;
    soundToggleBtn.classList.toggle('active', soundEnabled);
    soundToggleBtn.textContent = soundEnabled ? 'Sound On' : 'Sound Off';
    if (res.lang) {
      selectedLang = res.lang;
      langSelect.value = selectedLang;
    }
    if (res.companionConnected) {
      subEl.textContent = 'Desktop Companion + Chrome API active.';
    }
    if (res.autoListen) {
      startListening(false);
    }
  }
});
