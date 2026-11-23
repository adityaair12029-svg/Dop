(() => {
  if (window.__dopeHotkeyInstalled) return;
  window.__dopeHotkeyInstalled = true;

  let hostEl = null;
  let recognition = null;
  let hideTimer = null;
  let particleRaf = null;

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
        g1.gain.exponentialRampToValueAtTime(gainPeak, now + delay + 0.016);
        g1.gain.exponentialRampToValueAtTime(0.0008, now + delay + dur);
        g2.gain.setValueAtTime(0.0005, now + delay);
        g2.gain.exponentialRampToValueAtTime(gainPeak * 0.28, now + delay + 0.014);
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
      setTimeout(() => ctx.close().catch(() => {}), 1050);
    } catch {
      // Ignore audio errors
    }
  }

  function playActivateSound() {
    playTone([
      [523.25, 0, 0.16, 0.13],
      [659.25, 0.05, 0.18, 0.12],
      [783.99, 0.1, 0.2, 0.12],
      [1174.66, 0.15, 0.28, 0.1],
    ]);
  }

  function playExecuteSound() {
    playTone([
      [659.25, 0, 0.09, 0.09],
      [880.0, 0.05, 0.12, 0.09],
    ]);
  }

  function playSuccessSound() {
    playTone([
      [783.99, 0, 0.12, 0.1],
      [987.77, 0.06, 0.14, 0.1],
      [1174.66, 0.12, 0.22, 0.11],
    ]);
  }

  function playErrorSound() {
    playTone([
      [293.66, 0, 0.14, 0.1],
      [261.63, 0.1, 0.2, 0.09],
    ]);
  }

  function speak(text) {
    try {
      if (!text || !('speechSynthesis' in window)) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US';
      u.rate = 1.06;
      window.speechSynthesis.speak(u);
    } catch {
      // Ignore
    }
  }

  function removeHud() {
    if (hideTimer) clearTimeout(hideTimer);
    if (particleRaf !== null) {
      cancelAnimationFrame(particleRaf);
      particleRaf = null;
    }
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
      @keyframes agHudLiftoff {
        from { opacity: 0; transform: translateY(10px) scale(0.97); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
      @keyframes agOrbPulse {
        0%, 100% { box-shadow: 0 0 0 0 rgba(47, 113, 227, 0.55); }
        50% { box-shadow: 0 0 0 9px rgba(47, 113, 227, 0); }
      }
      .dope-hud {
        position: fixed;
        right: 22px;
        bottom: 22px;
        z-index: 2147483647;
        width: 356px;
        overflow: hidden;
        background: #070708;
        color: #ffffff;
        border: 1px solid rgba(255, 255, 255, 0.14);
        border-radius: 18px;
        padding: 15px 16px;
        box-shadow: 0 20px 50px rgba(0, 0, 0, 0.7);
        font-family: 'Plus Jakarta Sans', 'DM Sans', system-ui, -apple-system, sans-serif;
        animation: agHudLiftoff 180ms cubic-bezier(0.16, 1, 0.3, 1) both;
      }
      .ag-bg-canvas {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 0;
      }
      .hud-body { position: relative; z-index: 1; }
      .top { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
      .brand { display: flex; align-items: center; gap: 10px; min-width: 0; }
      .orb {
        width: 36px; height: 36px; border-radius: 999px;
        background: #0b0c0f;
        border: 1.5px solid #2f71e3;
        animation: agOrbPulse 1.5s ease-in-out infinite;
        flex-shrink: 0;
        display: flex; align-items: center; justify-content: center;
        overflow: hidden;
      }
      .orb img {
        width: 22px;
        height: 22px;
        object-fit: contain;
        display: block;
      }
      .title { font-size: 13.5px; font-weight: 600; letter-spacing: -0.02em; color: #ffffff; }
      .sub { font-size: 12px; color: #9ca3af; margin-top: 2px; line-height: 1.4; word-break: break-word; }
      .close {
        background: transparent; color: #9ca3af; border: 0;
        font-size: 16px; cursor: pointer; padding: 2px 6px; border-radius: 8px;
      }
      .close:hover { color: #ffffff; background: rgba(255,255,255,0.08); }
      .row {
        display: flex; gap: 6px; margin-top: 12px;
        background: #0d0d10; border: 1px solid rgba(255,255,255,0.12);
        border-radius: 14px; padding: 4px 4px 4px 12px;
      }
      .row:focus-within { border-color: #2f71e3; }
      .inp {
        flex: 1; background: transparent; color: #ffffff;
        border: 0; font-size: 12.5px; outline: none;
      }
      .inp::placeholder { color: #6b7280; }
      .go {
        background: #ffffff; color: #070708; border: 0; border-radius: 999px;
        padding: 6px 13px; font-size: 12px; font-weight: 600; cursor: pointer;
      }
      .go:hover { opacity: 0.9; }
    `;

    const card = document.createElement('div');
    card.className = 'dope-hud';

    const bgCanvas = document.createElement('canvas');
    bgCanvas.className = 'ag-bg-canvas';
    bgCanvas.width = 356;
    bgCanvas.height = 148;

    const hudBody = document.createElement('div');
    hudBody.className = 'hud-body';

    const top = document.createElement('div');
    top.className = 'top';
    const brand = document.createElement('div');
    brand.className = 'brand';
    const orb = document.createElement('div');
    orb.className = 'orb';
    const logoImg = document.createElement('img');
    logoImg.alt = 'El Dorado logo';
    try {
      logoImg.src = chrome.runtime.getURL('icons/logo-white.png');
    } catch {
      // Fallback handled by onerror
    }
    logoImg.onerror = () => {
      try {
        logoImg.src = chrome.runtime.getURL('icons/icon128.png');
      } catch {
        logoImg.style.display = 'none';
      }
    };
    orb.appendChild(logoImg);

    const txtWrap = document.createElement('div');
    const title = document.createElement('div');
    title.className = 'title';
    title.textContent = 'El Dorado Listening (Alt + D + T)';
    const sub = document.createElement('div');
    sub.className = 'sub';
    sub.textContent = 'Speak a command ("scroll", "undo", "open ChatGPT and type hi")...';
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
    inp.placeholder = 'Type or speak any command...';
    const goBtn = document.createElement('button');
    goBtn.className = 'go';
    goBtn.type = 'submit';
    goBtn.textContent = 'Run';
    form.append(inp, goBtn);

    hudBody.append(top, form);
    card.append(bgCanvas, hudBody);
    shadow.append(style, card);
    document.documentElement.appendChild(hostEl);
    inp.focus();

    const ctx = bgCanvas.getContext('2d');
    if (ctx) {
      const colors = ['#2F71E3', '#60A5FA', '#818CF8', '#A78BFA', '#F87171', '#FBBF24'];
      const particles = Array.from({ length: 30 }, (_, i) => ({
        angle: ((i * 137.508) % 360) * (Math.PI / 180),
        r: 0.15 + ((i * 17) % 100) / 110,
        speed: 0.0022 + (i % 5) * 0.0005,
        color: colors[i % colors.length],
      }));
      let hudSurge = 0;
      const hudRipples = [];
      const boostHud = () => {
        hudSurge = 2.8;
        hudRipples.push({ r: 6, alpha: 0.55 });
      };
      inp.addEventListener('keydown', boostHud);
      card.addEventListener('pointerdown', boostHud);

      const animateHudParticles = () => {
        if (!hostEl) return;
        ctx.clearRect(0, 0, 356, 148);
        for (const p of particles) {
          p.r += p.speed * (1 + hudSurge);
          p.angle += 0.0018 * (1 + hudSurge);
          if (p.r > 1.05) p.r = 0.12;
          const x = 178 + Math.cos(p.angle) * (p.r * 195);
          const y = 70 + Math.sin(p.angle) * (p.r * 95);
          const len = 4 + hudSurge * 1.8;
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(p.angle);
          ctx.globalAlpha = Math.min(0.8, 0.34 + hudSurge * 0.08);
          ctx.fillStyle = p.color;
          ctx.fillRect(-len * 0.5, -0.8, len, 1.6);
          ctx.restore();
        }
        for (let i = hudRipples.length - 1; i >= 0; i--) {
          const rp = hudRipples[i];
          rp.r += 4.5;
          rp.alpha *= 0.9;
          if (rp.alpha < 0.03) {
            hudRipples.splice(i, 1);
            continue;
          }
          ctx.save();
          ctx.strokeStyle = '#2F71E3';
          ctx.globalAlpha = rp.alpha;
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.arc(178, 70, rp.r, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
        hudSurge *= 0.92;
        particleRaf = requestAnimationFrame(animateHudParticles);
      };
      particleRaf = requestAnimationFrame(animateHudParticles);
    }

    function dispatch(text) {
      const clean = text.trim();
      if (!clean) return;
      if (hideTimer) clearTimeout(hideTimer);
      playExecuteSound();
      title.textContent = 'Running...';
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
          title.textContent = res.action?.action === 'answer_question' ? 'El Dorado AI Answer' : 'Done';
        } else {
          playErrorSound();
          title.textContent = 'Notice';
        }
        const reply = res.spoken_response || 'Executed.';
        sub.textContent = reply;
        speak(reply);
        const stayMs = reply.length > 70 ? 7500 : 2800;
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
        recognition.lang = 'en-US';
        recognition.interimResults = true;
        recognition.continuous = false;
        recognition.onresult = (ev) => {
          let finalStr = '';
          let interimStr = '';
          for (let i = ev.resultIndex; i < ev.results.length; i++) {
            const piece = ev.results[i][0]?.transcript || '';
            if (ev.results[i].isFinal) finalStr += piece;
            else interimStr += piece;
          }
          if (interimStr.trim()) {
            sub.textContent = interimStr.trim();
          }
          if (finalStr.trim()) {
            dispatch(finalStr);
          }
        };
        recognition.onerror = () => {
          title.textContent = 'Type Command (Mic Busy)';
          sub.textContent = 'Press Enter or open El Dorado Side Panel.';
          inp.focus();
        };
        recognition.start();
      } catch {
        inp.focus();
      }
    }
  }

  const pressedKeys = new Set();
  let lastTriggerAt = 0;

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
      const isAltD = e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && k === 'd';

      if (isAltDT || isAltD) {
        e.preventDefault();
        e.stopPropagation();
        const now = Date.now();
        if (now - lastTriggerAt > 240) {
          lastTriggerAt = now;
          openFloatingOverlay();
        }
      } else if (e.key === 'Escape' && hostEl) {
        removeHud();
      }
    },
    true
  );
})();
