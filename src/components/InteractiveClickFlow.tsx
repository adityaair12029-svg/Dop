import React, { useEffect, useRef } from 'react';

interface InteractiveClickFlowProps {
  theme: 'light' | 'dark';
}

interface BurstRipple {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
  color: string;
}

interface BurstSpark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

const DARK_PALETTE = ['#2F71E3', '#60A5FA', '#818CF8', '#38BDF8'];
const LIGHT_PALETTE = ['#2F75C3', '#4285F4', '#6366F1', '#0284C7'];

/**
 * Full-screen pointer-events-none overlay that emits smooth 60fps Antigravity
 * flow ripples and micro-sparks whenever the user clicks a button or presses a key.
 * Automatically suspends its animation loop when idle (zero active ripples/sparks).
 */
export const InteractiveClickFlow: React.FC<InteractiveClickFlowProps> = ({ theme }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const themeRef = useRef(theme);
  themeRef.current = theme;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    const ripples: BurstRipple[] = [];
    const sparks: BurstSpark[] = [];
    let rafId: number | null = null;
    let width = window.innerWidth;
    let height = window.innerHeight;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener('resize', resize);

    const scheduleLoop = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(render);
    };

    const spawnBurst = (x: number, y: number, strength: 'click' | 'key') => {
      const palette = themeRef.current === 'dark' ? DARK_PALETTE : LIGHT_PALETTE;
      const color = palette[(ripples.length + sparks.length) % palette.length];
      ripples.push({
        x,
        y,
        radius: 4,
        maxRadius: strength === 'click' ? 92 : 68,
        alpha: strength === 'click' ? 0.55 : 0.38,
        color,
      });

      const count = strength === 'click' ? 8 : 5;
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.35;
        const speed = (strength === 'click' ? 2.4 : 1.7) + Math.random() * 1.4;
        sparks.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1,
          color: palette[i % palette.length],
        });
      }

      if (ripples.length > 18) ripples.splice(0, ripples.length - 18);
      if (sparks.length > 72) sparks.splice(0, sparks.length - 72);
      scheduleLoop();
    };

    const onPointerDown = (e: PointerEvent) => {
      spawnBurst(e.clientX, e.clientY, 'click');
    };

    const onKeyDown = () => {
      const active = document.activeElement as HTMLElement | null;
      if (active && active.getBoundingClientRect) {
        const rect = active.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          spawnBurst(rect.left + rect.width * 0.5, rect.top + rect.height * 0.5, 'key');
          return;
        }
      }
      spawnBurst(width * 0.5, height * 0.5, 'key');
    };

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      for (let i = ripples.length - 1; i >= 0; i--) {
        const r = ripples[i];
        r.radius += (r.maxRadius - r.radius) * 0.14 + 1.8;
        r.alpha *= 0.91;
        if (r.alpha < 0.02 || r.radius >= r.maxRadius) {
          ripples.splice(i, 1);
          continue;
        }
        ctx.save();
        ctx.strokeStyle = r.color;
        ctx.globalAlpha = r.alpha;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.x += s.vx;
        s.y += s.vy;
        s.vx *= 0.95;
        s.vy *= 0.95;
        s.life *= 0.91;
        if (s.life < 0.04) {
          sparks.splice(i, 1);
          continue;
        }
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(Math.atan2(s.vy, s.vx));
        ctx.globalAlpha = s.life * 0.72;
        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.roundRect(-3, -1.1, 6, 2.2, 1.1);
        ctx.fill();
        ctx.restore();
      }

      if (ripples.length > 0 || sparks.length > 0) {
        rafId = requestAnimationFrame(render);
      } else {
        rafId = null;
      }
    };

    window.addEventListener('pointerdown', onPointerDown, { passive: true });
    window.addEventListener('keydown', onKeyDown, { passive: true });

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      data-testid="interactive-click-flow"
      aria-hidden="true"
      className="fixed inset-0 z-50 pointer-events-none select-none w-full h-full"
    />
  );
};
