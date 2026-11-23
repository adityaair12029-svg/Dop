import React, { useEffect, useRef } from 'react';

interface AntigravityFlowWaveProps {
  className?: string;
}

interface Ripple {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
  color: string;
}

/**
 * High-performance 60fps flowing 3D dotted wave particle mesh + oceanic mist
 * matching the Antigravity login screen. Uses pre-baked offscreen mist canvas
 * and batched dot draw paths (~3 canvas draw calls/frame) so CPU rendering is
 * ultra-smooth.
 */
export const AntigravityFlowWave: React.FC<AntigravityFlowWaveProps> = ({ className = '' }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    let width = 1280;
    let height = 720;
    let rafId: number | null = null;
    let time = 0;
    let energyBoost = 0;
    let pointerX = 0.5;
    let pointerY = 0.72;
    const ripples: Ripple[] = [];

    const mistCanvas = document.createElement('canvas');
    const mistCtx = mistCanvas.getContext('2d');

    const bakeMist = () => {
      if (!mistCtx) return;
      mistCanvas.width = width;
      mistCanvas.height = height;
      mistCtx.clearRect(0, 0, width, height);

      const mistA = mistCtx.createRadialGradient(
        width * 0.65,
        height * 0.9,
        10,
        width * 0.65,
        height * 0.9,
        Math.max(width, height) * 0.54
      );
      mistA.addColorStop(0, 'rgba(62, 138, 136, 0.36)');
      mistA.addColorStop(0.45, 'rgba(32, 82, 128, 0.22)');
      mistA.addColorStop(1, 'rgba(5, 5, 7, 0)');
      mistCtx.fillStyle = mistA;
      mistCtx.fillRect(0, 0, width, height);

      const mistB = mistCtx.createRadialGradient(
        width * 0.32,
        height * 0.94,
        10,
        width * 0.32,
        height * 0.94,
        Math.max(width, height) * 0.46
      );
      mistB.addColorStop(0, 'rgba(47, 113, 227, 0.25)');
      mistB.addColorStop(0.6, 'rgba(20, 48, 86, 0.14)');
      mistB.addColorStop(1, 'rgba(5, 5, 7, 0)');
      mistCtx.fillStyle = mistB;
      mistCtx.fillRect(0, 0, width, height);
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(Math.floor(rect.width || window.innerWidth), 320);
      height = Math.max(Math.floor(rect.height || window.innerHeight), 320);
      canvas.width = width;
      canvas.height = height;
      bakeMist();
    };

    resize();
    window.addEventListener('resize', resize);

    const onPointerMove = (e: PointerEvent) => {
      pointerX = e.clientX / Math.max(width, 1);
      pointerY = e.clientY / Math.max(height, 1);
      energyBoost = Math.min(1.4, energyBoost + 0.04);
    };

    const onPointerDown = (e: PointerEvent) => {
      energyBoost = 1.8;
      ripples.push({
        x: e.clientX,
        y: e.clientY,
        radius: 6,
        maxRadius: 220,
        alpha: 0.65,
        color: '#3275F4',
      });
    };

    const onKeyDown = () => {
      energyBoost = 1.5;
      ripples.push({
        x: width * 0.5,
        y: height * 0.45,
        radius: 14,
        maxRadius: 260,
        alpha: 0.42,
        color: '#4FD1C5',
      });
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerdown', onPointerDown, { passive: true });
    window.addEventListener('keydown', onKeyDown, { passive: true });

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(mistCanvas, (pointerX - 0.5) * 18, 0);

      // Batched 3D dotted wave clusters (4 draw calls total instead of 1500+)
      const cols = width < 640 ? 34 : 52;
      const rows = 14;
      const baseY = height * 0.62;
      const spanY = height * 0.38;
      const px = pointerX * width;
      const py = pointerY * height;

      const bluePath = new Path2D();
      const tealPath = new Path2D();

      for (let r = 0; r < rows; r++) {
        const depth = r / (rows - 1);
        const rowY = baseY + Math.pow(depth, 1.15) * spanY;
        const size = 1.6 + depth * 1.8;

        for (let c = 0; c < cols; c++) {
          const u = c / (cols - 1);
          const x = u * width;

          const wave1 = Math.sin(u * 5.2 + time * 1.1 + r * 0.34) * (15 + energyBoost * 9);
          const wave2 = Math.cos(u * 3.1 - time * 0.75 + r * 0.24) * 12;
          const clusterMask = Math.sin(u * 3.9 + r * 0.16 + time * 0.25) * 0.5 + 0.5;
          if (clusterMask < 0.22) continue;

          const dx = x - px;
          const rawY = rowY + wave1 + wave2;
          const dy = rawY - py;
          const distSq = dx * dx + dy * dy;
          const offset = distSq < 28000 ? (1 - Math.sqrt(distSq) / 168) * 14 : 0;
          const y = rawY + (dy > 0 ? offset : -offset);

          if (clusterMask > 0.6) {
            bluePath.rect(x, y, size, size);
          } else {
            tealPath.rect(x, y, size * 0.9, size * 0.9);
          }
        }
      }

      ctx.fillStyle = 'rgba(147, 197, 253, 0.42)';
      ctx.fill(bluePath);
      ctx.fillStyle = 'rgba(110, 210, 215, 0.28)';
      ctx.fill(tealPath);

      for (let i = ripples.length - 1; i >= 0; i--) {
        const rp = ripples[i];
        rp.radius += 7.5;
        rp.alpha *= 0.92;
        if (rp.alpha <= 0.02 || rp.radius >= rp.maxRadius) {
          ripples.splice(i, 1);
          continue;
        }
        ctx.save();
        ctx.strokeStyle = rp.color;
        ctx.globalAlpha = rp.alpha;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(rp.x, rp.y, rp.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      if (!prefersReduced) {
        time += 0.015 + energyBoost * 0.016;
        energyBoost *= 0.94;
        rafId = requestAnimationFrame(draw);
      }
    };

    draw();

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      data-testid="antigravity-flow-wave"
      aria-hidden="true"
      className={`pointer-events-none select-none ${className}`}
    />
  );
};
