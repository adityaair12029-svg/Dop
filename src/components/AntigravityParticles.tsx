import React, { useEffect, useRef } from 'react';

interface AntigravityParticlesProps {
  theme: 'light' | 'dark';
  active?: boolean;
  className?: string;
}

interface Particle {
  angle: number;
  radiusRatio: number;
  speed: number;
  drift: number;
  length: number;
  thickness: number;
  color: string;
  alpha: number;
}

const LIGHT_COLORS = [
  '#2F75C3',
  '#4285F4',
  '#6366F1',
  '#8B5CF6',
  '#EA4335',
  '#FBBC05',
  '#1E40AF',
];

const DARK_COLORS = [
  '#2F71E3',
  '#60A5FA',
  '#818CF8',
  '#A78BFA',
  '#F87171',
  '#FBBF24',
  '#93C5FD',
];

export const AntigravityParticles: React.FC<AntigravityParticlesProps> = ({
  theme,
  active = false,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const activeRef = useRef(active);
  activeRef.current = active;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const palette = theme === 'dark' ? DARK_COLORS : LIGHT_COLORS;
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    const particles: Particle[] = Array.from({ length: 88 }, (_, idx) => ({
      angle: ((idx * 137.508) % 360) * (Math.PI / 180),
      radiusRatio: 0.14 + ((idx * 19) % 100) / 105,
      speed: 0.00075 + (idx % 7) * 0.00022,
      drift: (idx % 11) * 0.00045,
      length: 3.2 + (idx % 4) * 1.4,
      thickness: 1.7 + (idx % 2) * 0.6,
      color: palette[idx % palette.length],
      alpha: theme === 'dark' ? 0.3 + (idx % 5) * 0.08 : 0.44 + (idx % 4) * 0.1,
    }));

    let rafId: number | null = null;
    let width = 0;
    let height = 0;
    let flowSurge = 0;
    let pointerNormX = 0;
    let pointerNormY = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(rect.width, 320);
      height = Math.max(rect.height, 220);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener('resize', resize);

    const onPointerMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        pointerNormX = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
        pointerNormY = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
      }
      flowSurge = Math.min(3.0, flowSurge + 0.12);
    };

    const onBurst = () => {
      flowSurge = 3.2;
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerdown', onBurst, { passive: true });
    window.addEventListener('keydown', onBurst, { passive: true });

    const drawFrame = () => {
      ctx.clearRect(0, 0, width, height);
      const cx = width * 0.5 + pointerNormX * 14;
      const cy = height * 0.42 + pointerNormY * 10;
      const maxR = Math.hypot(width, height) * 0.52;
      const speedMult = (activeRef.current ? 2.4 : 1.0) + flowSurge;

      for (const p of particles) {
        if (!prefersReduced) {
          p.radiusRatio += p.speed * speedMult;
          p.angle += p.drift * (0.45 + flowSurge * 0.45);
          if (p.radiusRatio > 1.08) {
            p.radiusRatio = 0.12;
          }
        }

        const r = p.radiusRatio * maxR;
        const x = cx + Math.cos(p.angle) * r;
        const y = cy + Math.sin(p.angle) * r * 0.78;

        const edgeFade =
          p.radiusRatio < 0.22
            ? (p.radiusRatio - 0.12) / 0.1
            : p.radiusRatio > 0.92
              ? (1.08 - p.radiusRatio) / 0.16
              : 1;

        const streakLength = p.length + flowSurge * 2.2;

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(p.angle);
        ctx.globalAlpha = Math.max(0, Math.min(1, p.alpha * edgeFade * (1 + flowSurge * 0.15)));
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.roundRect(
          -streakLength * 0.5,
          -p.thickness * 0.5,
          streakLength,
          p.thickness,
          p.thickness * 0.5
        );
        ctx.fill();
        ctx.restore();
      }

      flowSurge *= 0.92;
      if (!prefersReduced) {
        rafId = requestAnimationFrame(drawFrame);
      }
    };

    drawFrame();

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerdown', onBurst);
      window.removeEventListener('keydown', onBurst);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [theme]);

  return (
    <canvas
      ref={canvasRef}
      data-testid="antigravity-particles"
      aria-hidden="true"
      className={`pointer-events-none select-none ${className}`}
    />
  );
};
