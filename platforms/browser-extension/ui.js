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
const themeToggleBtn = document.getElementById('themeToggleBtn');
const langSelect = document.getElementById('langSelect');
const particlesCanvas = document.getElementById('agParticles');

let recognition = null;
let isListening = false;
let wakeMode = false;
let soundEnabled = true;
let selectedLang = 'en-IN';
let currentServerUrl = '';
let currentTheme = 'dark';

function applyExtensionTheme(theme) {
  currentTheme = theme === 'light' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', currentTheme);
  if (themeToggleBtn) {
    themeToggleBtn.textContent = currentTheme === 'dark' ? 'Dark' : 'Light';
  }
}

function initAntigravityParticles() {
  if (!particlesCanvas) return;
  const ctx = particlesCanvas.getContext('2d');
  if (!ctx) return;

  const prefersReduced =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const particles = Array.from({ length: 48 }, (_, idx) => ({
    angle: ((idx * 137.508) % 360) * (Math.PI / 180),
    radiusRatio: 0.14 + ((idx * 19) % 100) / 105,
    speed: 0.0007 + (idx % 6) * 0.0002,
    drift: (idx % 9) * 0.0004,
    length: 2.5 + (idx % 3) * 1.2,
    thickness: 1.6,
    idx,
  }));

  const LIGHT_COLORS = ['#2F75C3', '#4285F4', '#6366F1', '#8B5CF6', '#EA4335', '#FBBC05'];
  const DARK_COLORS = ['#2F71E3', '#60A5FA', '#818CF8', '#A78BFA', '#F87171', '#FBBF24'];

  let width = 380;
  let height = 560;
  let flowSurge = 0;
  let pointerOffsetX = 0;
  let pointerOffsetY = 0;
  const ripples = [];

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = Math.max(window.innerWidth, 360);
    height = Math.max(window.innerHeight, 480);
    particlesCanvas.width = Math.floor(width * dpr);
    particlesCanvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize);

  window.addEventListener('pointermove', (e) => {
    pointerOffsetX = ((e.clientX / Math.max(width, 1)) - 0.5) * 18;
    pointerOffsetY = ((e.clientY / Math.max(height, 1)) - 0.5) * 14;
    flowSurge = Math.min(2.6, flowSurge + 0.14);
  }, { passive: true });

  window.addEventListener('pointerdown', (e) => {
    flowSurge = 3.0;
    ripples.push({ x: e.clientX, y: e.clientY, r: 4, alpha: 0.55 });
  }, { passive: true });

  window.addEventListener('keydown', () => {
    flowSurge = 2.6;
    ripples.push({ x: width * 0.5, y: height * 0.3, r: 8, alpha: 0.45 });
  }, { passive: true });

  function frame() {
    ctx.clearRect(0, 0, width, height);
    const palette = currentTheme === 'dark' ? DARK_COLORS : LIGHT_COLORS;
    const cx = width * 0.5 + pointerOffsetX;
    const cy = height * 0.3 + pointerOffsetY;
    const maxR = Math.hypot(width, height) * 0.55;
    const speedMult = (isListening ? 2.4 : 1.0) + flowSurge;

    for (const p of particles) {
      if (!prefersReduced) {
        p.radiusRatio += p.speed * speedMult;
        p.angle += p.drift * (0.4 + flowSurge * 0.45);
        if (p.radiusRatio > 1.06) p.radiusRatio = 0.12;
      }
      const r = p.radiusRatio * maxR;
      const x = cx + Math.cos(p.angle) * r;
      const y = cy + Math.sin(p.angle) * r * 0.82;
      const edgeFade = p.radiusRatio < 0.2 ? (p.radiusRatio - 0.1) / 0.1 : 1;
      const streak = p.length + flowSurge * 2.0;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(p.angle);
      ctx.globalAlpha = Math.max(0, Math.min(1, (currentTheme === 'dark' ? 0.34 : 0.46) * edgeFade));
      ctx.fillStyle = palette[p.idx % palette.length];
      ctx.beginPath();
      ctx.roundRect(-streak * 0.5, -p.thickness * 0.5, streak, p.thickness, p.thickness * 0.5);
      ctx.fill();
      ctx.restore();
    }

    for (let i = ripples.length - 1; i >= 0; i--) {
      const rp = ripples[i];
      rp.r += 5.5;
      rp.alpha *= 0.91;
      if (rp.alpha < 0.03 || rp.r > 130) {
        ripples.splice(i, 1);
        continue;
      }
      ctx.save();
      ctx.strokeStyle = currentTheme === 'dark' ? '#2F71E3' : '#2F75C3';
      ctx.globalAlpha = rp.alpha;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(rp.x, rp.y, rp.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    flowSurge *= 0.92;
    if (!prefersReduced) {
      requestAnimationFrame(frame);
    }
  }
  frame();
}

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
  subEl.textContent = 'Press Alt + D + T or tap the orb to speak.';
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

if (themeToggleBtn) {
  themeToggleBtn.addEventListener('click', () => {
    const next = currentTheme === 'dark' ? 'light' : 'dark';
    applyExtensionTheme(next);
    try {
      chrome.storage?.local?.set({ dopeTheme: next });
    } catch {
      // Ignore storage error
    }
  });
}

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

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === 'dope_activate_now') {
    startListening(false);
  }
});

try {
  chrome.storage?.local?.get(['dopeTheme'], (data) => {
    if (data?.dopeTheme) applyExtensionTheme(data.dopeTheme);
  });
} catch {
  // Ignore
}

initAntigravityParticles();

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
