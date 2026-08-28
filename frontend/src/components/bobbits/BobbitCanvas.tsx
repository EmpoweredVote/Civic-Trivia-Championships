import { useEffect, useRef } from 'react';
import type { CSSProperties, MouseEvent } from 'react';
import { ANIMATIONS, CFG, computePose, draw, drawShadow } from './leremyRig';

export interface BobbitFigureSpec {
  anim: keyof typeof ANIMATIONS;
  color: string;
  /** 0–1 fraction of the canvas width. */
  x: number;
  /** px from the canvas's bottom edge up to this figure's ground-contact line (feet, or seat for sitting poses). */
  bottom: number;
  scale: number;
  flip?: boolean;
  card?: boolean;
  /** Seconds added to the shared clock so figures don't move in lockstep. */
  phase?: number;
  shadow?: boolean;
  /** If set, this figure becomes clickable (a rough bounding box around its standing height). */
  onClick?: () => void;
}

// Pelvis height above the ground-contact point, in the rig's own units (at scale 1) — standing
// poses plant their feet ~112 units below the pelvis; seated poses barely lift off the seat.
// Ported from the same constants ev-figures.js uses to place figures on a line.
const PELVIS_OFFSET: Partial<Record<keyof typeof ANIMATIONS, number>> = {
  standstill: 112, friendly: 112, cheer: 112, dance: 112, greet: 112, present: 112, offer: 112, ponder: 112,
  sit: 8, read: 8, greetseat: 8,
};

interface BobbitCanvasProps {
  figures: BobbitFigureSpec[];
  height: number;
  animate?: boolean;
  className?: string;
  style?: CSSProperties;
}

/**
 * Canvas renderer for the ported Leremy rig. Sized to its own CSS width (parent controls
 * layout via flex/grid), fixed pixel height. Redraws once and stops when `animate` is false.
 */
export function BobbitCanvas({ figures, height, animate = true, className, style }: BobbitCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const widthRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      const w = canvas.clientWidth;
      widthRef.current = w;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const renderFrame = (tSec: number) => {
      const w = widthRef.current;
      ctx.clearRect(0, 0, w, height);
      for (const f of figures) {
        const anim = ANIMATIONS[f.anim];
        if (!anim) continue;
        const pose = anim.frame(tSec + (f.phase || 0));
        const x = f.x * w;
        const groundY = height - f.bottom;
        if (f.shadow !== false) drawShadow(ctx, x, groundY, 16 * f.scale);
        const pelvisOffset = PELVIS_OFFSET[f.anim] ?? 112;
        ctx.save();
        ctx.translate(x, groundY - pelvisOffset * f.scale);
        ctx.scale(f.flip ? -f.scale : f.scale, f.scale);
        const j = computePose(pose, CFG, { x: 0, y: 0 });
        draw(ctx, j, CFG, { color: f.color, card: f.card });
        ctx.restore();
      }
    };

    if (!animate) {
      renderFrame(0);
      return () => ro.disconnect();
    }

    let rafId: number;
    const start = performance.now();
    const tick = (now: number) => {
      renderFrame((now - start) / 1000);
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    return () => {
      ro.disconnect();
      cancelAnimationFrame(rafId);
    };
  }, [figures, height, animate]);

  const clickable = figures.some(f => f.onClick);

  const handleClick = (e: MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const w = widthRef.current;
    for (const f of figures) {
      if (!f.onClick) continue;
      const x = f.x * w;
      const groundY = height - f.bottom;
      const pelvisOffset = PELVIS_OFFSET[f.anim] ?? 112;
      const top = groundY - (pelvisOffset + 90) * f.scale;
      const halfWidth = 30 * f.scale;
      if (cx >= x - halfWidth && cx <= x + halfWidth && cy >= top && cy <= groundY + 10) {
        f.onClick();
        return;
      }
    }
  };

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={className}
      onClick={clickable ? handleClick : undefined}
      style={{
        display: 'block', width: '100%', height,
        // Overrides an ancestor's pointer-events:none (BobbitScene's wrapper is otherwise
        // fully decorative) only when a figure actually needs to be clickable.
        pointerEvents: clickable ? 'auto' : 'none',
        cursor: clickable ? 'pointer' : undefined,
        ...style,
      }}
    />
  );
}
