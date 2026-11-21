(() => {
  if (window.__dopeHotkeyInstalled) return;
  window.__dopeHotkeyInstalled = true;

  let hostEl = null;
  let recognition = null;
  let hideTimer = null;

  function playTone(notes) {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const now = ctx.currentTime;
      notes.forEach(([freq, delay, dur, gainPeak]) => {
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const g1 = ctx.createGain();
        const g2 = ctx.createGain();
        osc1.type = 'sine';
        osc2.type = 'triangle';
        osc1.frequency.setValueAtTime(freq, now + delay);
        osc2.frequency.setValueAtTime(freq * 2, now + delay);
        g1.gain.setValueAtTime(0.001, now + delay);
        g1.gain.exponentialRampToValueAtTime(gainPeak, now + delay + 0.018);
        g1.gain.exponentialRampToValueAtTime(0.0008, now + delay + dur);
        g2.gain.setValueAtTime(0.0005, now + delay);
        g2.gain.exponentialRampToValueAtTime(gainPeak * 0.28, now + delay + 0.015);
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
      // Ignore audio errors
    }
  }

  function playActivateSound() {
    playTone([
      [523.25, 0, 0.18, 0.13],
      [659.25, 0.06, 0.2, 0.12],
      [783.99, 0.12, 0.22, 0.12],
      [1174.66, 0.18, 0.3, 0.1],
    ]);
  }

  function playExecuteSound() {
    playTone([
      [659.25, 0, 0.1, 0.09],
      [880.0, 0.06, 0.14, 0.09],
    ]);
  }

  function playSuccessSound() {
    playTone([
      [783.99, 0, 0.14, 0.1],
      [987.77, 0.07, 0.16, 0.1],
      [1174.66, 0.14, 0.24, 0.11],
    ]);
  }

  function playErrorSound() {
    playTone([
      [293.66, 0, 0.15, 0.1],
      [261.63, 0.11, 0.22, 0.09],
    ]);
  }

  function speak(text) {
    try {
      if (!text || !('speechSynthesis' in window)) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-IN';
      u.rate = 1.04;
      window.speechSynthesis.speak(u);
    } catch {
      // Ignore
    }
  }

  function removeHud() {
    if (hideTimer) clearTimeout(hideTimer);
    try {
      recognition?.stop();
    } catch {
      // Ignore
    }
    recognition = null;
    if (hostEl) {
      hostEl.remove();
      hostEl = null;
    }
  }

  function openFloatingOverlay() {
    removeHud();
    playActivateSound();

    hostEl = document.createElement('div');
    hostEl.id = 'dope-floating-overlay-host';
    const shadow = hostEl.attachShadow({ mode: 'closed' });

    const style = document.createElement('style');
    style.textContent = `
      .dope-hud {
        position: fixed;
        right: 20px;
        bottom: 20px;
        z-index: 2147483647;
        width: 320px;
        background: linear-gradient(145deg, #0f172a, #172554);
        color: #f8fafc;
        border: 1px solid rgba(96, 165, 250, 0.4);
        border-radius: 18px;
        padding: 14px 16px;
        box-shadow: 0 18px 40px rgba(2, 6, 23, 0.55);
        font-family: system-ui, -apple-system, sans-serif;
      }
      .top { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
      .brand { display: flex; align-items: center; gap: 10px; }
      .orb {
        width: 34px; height: 34px; border-radius: 999px;
        background: radial-gradient(circle at 30% 30%, #60a5fa, #2563eb);
        box-shadow: 0 0 0 5px rgba(59, 130, 246, 0.25);
        flex-shrink: 0;
      }
      .title { font-size: 14px; font-weight: 700; }
      .sub { font-size: 12px; color: #cbd5e1; margin-top: 2px; }
      .close {
        background: transparent; color: #94a3b8; border: 0;
        font-size: 16px; cursor: pointer; padding: 2px 6px;
      }
      .row { display: flex; gap: 6px; margin-top: 10px; }
      .inp {
        flex: 1; background: rgba(15, 23, 42, 0.85); color: #fff;
        border: 1px solid rgba(148, 163, 184, 0.35); border-radius: 10px;
        padding: 7px 10px; font-size: 12px; outline: none;
      }
      .go {
        background: #2563eb; color: #fff; border: 0; border-radius: 10px;
        padding: 7px 12px; font-size: 12px; font-weight: 600; cursor: pointer;
      }
    `;

    const card = document.createElement('div');
    card.className = 'dope-hud';

    const top = document.createElement('div');
    top.className = 'top';
    const brand = document.createElement('div');
    brand.className = 'brand';
    const orb = document.createElement('div');
    orb.className = 'orb';
    const txtWrap = document.createElement('div');
    const title = document.createElement('div');
    title.className = 'title';
    title.textContent = 'DOPE Listening (Alt + D + T)';
    const sub = document.createElement('div');
    sub.className = 'sub';
    sub.textContent = 'Speak a command or ask any question...';
    txtWrap.append(title, sub);
    brand.append(orb, txtWrap);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'close';
    closeBtn.type = 'button';
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', removeHud);
    top.append(brand, closeBtn);

    const form = document.createElement('form');
    form.className = 'row';
    const inp = document.createElement('input');
    inp.className = 'inp';
    inp.type = 'text';
    inp.placeholder = 'Ask AI or say: open YouTube...';
    const goBtn = document.createElement('button');
    goBtn.className = 'go';
    goBtn.type = 'submit';
    goBtn.textContent = 'Run';
    form.append(inp, goBtn);

    card.append(top, form);
    shadow.append(style, card);
    document.documentElement.appendChild(hostEl);

    function dispatch(text) {
      const clean = text.trim();
      if (!clean) return;
      playExecuteSound();
      title.textContent = 'Thinking & Executing...';
      sub.textContent = clean;
      chrome.runtime.sendMessage({ type: 'run_command', text: clean }, (res) => {
        if (chrome.runtime.lastError || !res) {
          playErrorSound();
          title.textContent = 'Could not execute';
          sub.textContent = chrome.runtime.lastError?.message || 'Extension busy.';
          hideTimer = setTimeout(removeHud, 3500);
          return;
        }
        if (res.ok) {
          playSuccessSound();
          title.textContent = res.action?.action === 'answer_question' ? 'DOPE AI Answer' : 'Done';
        } else {
          playErrorSound();
          title.textContent = 'Notice';
        }
        const reply = res.spoken_response || 'Executed.';
        sub.textContent = reply;
        speak(reply);
        const stayMs = reply.length > 70 ? 7500 : 3200;
        hideTimer = setTimeout(removeHud, stayMs);
      });
    }

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      dispatch(inp.value);
      inp.value = '';
    });

    const SpeechCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechCtor) {
      try {
        recognition = new SpeechCtor();
        recognition.lang = 'en-IN';
        recognition.interimResults = false;
        recognition.continuous = false;
        recognition.onresult = (ev) => {
          const t = ev.results?.[0]?.[0]?.transcript || '';
          if (t.trim()) dispatch(t);
        };
        recognition.onerror = () => {
          title.textContent = 'Type Command (Mic Busy)';
          sub.textContent = 'Press Enter or open DOPE Side Panel.';
          inp.focus();
        };
        recognition.start();
      } catch {
        inp.focus();
      }
    } else {
      inp.focus();
    }
  }

  const pressedKeys = new Set();
  let lastChordTrigger = 0;

  window.addEventListener('blur', () => pressedKeys.clear());
  window.addEventListener(
    'keyup',
    (e) => {
      pressedKeys.delete(e.key.toLowerCase());
    },
    true
  );

  window.addEventListener(
    'keydown',
    (e) => {
      const k = e.key.toLowerCase();
      pressedKeys.add(k);
      const isAltDT = e.altKey && pressedKeys.has('d') && pressedKeys.has('t');
      const isAltDOnly = e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && k === 'd';

      if (isAltDT) {
        e.preventDefault();
        e.stopPropagation();
        lastChordTrigger = Date.now();
        openFloatingOverlay();
      } else if (isAltDOnly && Date.now() - lastChordTrigger > 500) {
        // Brief wait allows Alt+D+T chord to complete without double-firing
        setTimeout(() => {
          if (!pressedKeys.has('t') && Date.now() - lastChordTrigger > 250 && !hostEl) {
            openFloatingOverlay();
          }
        }, 160);
      } else if (e.key === 'Escape' && hostEl) {
        removeHud();
      }
    },
    true
  );
})();
