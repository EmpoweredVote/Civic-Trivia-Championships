import { useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import { CFG, computePose, draw, drawShadow, drawSmoke } from './leremyRig';
import { ALL_ANIMATIONS } from './rigExtras';
import { pelvisOffset, sortByDepth, figureBounds } from './fieldGeometry';
import type { FieldFigure } from './fieldGeometry';
import { figureAtPoint } from './hitTest';
import { greetReduce, isGreeting, greetClock } from './greetReducer';
import type { GreetState } from './greetReducer';
import { poofReduce, POOF_IDLE, POOF_HOLD, POOF_BURST } from './poofReducer';
import type { PoofState, PoofEvent } from './poofReducer';
import { gestureReduce, GESTURE_IDLE, shouldSuppressContextMenu } from './pointerGestures';
import { armFlee, fleeAdvance, allGone } from './fleeReducer';
import type { FleeState } from './fleeReducer';
import type { GestureState } from './pointerGestures';
import { useReducedMotion } from '../../hooks/useReducedMotion';

/**
 * One canvas, one clock, one rAF, for every Bobit on a screen.
 *
 * Replaces the old per-component BobbitCanvas, which was fine for two figures and wrong for
 * ninety: each instance owned a canvas AND its own animation loop, so nothing shared a clock
 * and nothing could be batched. Here every figure phases off one shared `t`, and paint order
 * is by ground line so overlap reads as depth.
 *
 * The hit test also gets cheaper rather than more expensive. ev-figures.js walks fourteen
 * canvases calling getBoundingClientRect + getImageData on each; on one field it is a bounds
 * filter plus at most one scratch render.
 */

interface BobitFieldProps {
  figures: FieldFigure[];
  height: number;
  animate?: boolean;
  /**
   * Attach pointer listeners for greet and poof. Off by default -- a purely decorative field
   * must not install a document-level mousemove handler.
   */
  interactive?: boolean;
  className?: string;
  style?: CSSProperties;
}

// ev-figures.js caps at 1.5 and CTC's old canvas capped at 2. 1.5 is the landing page's
// measured choice and one of the levers the stage 2 spike will revisit.
const DPR_CAP = 1.5;

/** Half-width of the alpha window sampled around the cursor, in css px. Matches ev-figures.js. */
const INK_PAD = 6;

export function BobitField({
  figures, height, animate = true, interactive = false, className, style,
}: BobitFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scratchRef = useRef<HTMLCanvasElement | null>(null);

  // The rAF closure reads these refs rather than closing over props, so a fresh `figures`
  // array on every parent render does not restart the animation clock at 0 and make every
  // figure visibly jump. (BobbitScene and BobbitCardGreeter both carried a comment about
  // exactly this hazard; here the fix lives in one place instead of at every call site.)
  const figuresRef = useRef(figures);
  const greetRef = useRef<GreetState>({});
  const poofRef = useRef<PoofState>(POOF_IDLE);
  const gestureRef = useRef<GestureState>(GESTURE_IDLE);
  const hoveredRef = useRef<string | null>(null);
  const pointerRef = useRef<{ x: number; y: number } | null>(null);
  const widthRef = useRef(0);
  const clockRef = useRef(0);
  const fleeRef = useRef<FleeState>({});
  // Frozen at the last pre-stun frame, so the room holds its pose rather than resetting to t=0.
  const stunClockRef = useRef(0);
  // Published by the render effect so the pointer handlers can hit-test with real ink.
  const probeRef = useRef<((f: FieldFigure, x: number, y: number) => boolean) | null>(null);

  useEffect(() => { figuresRef.current = figures; }, [figures]);

  const prefersReducedMotion = useReducedMotion();
  const running = animate && !prefersReducedMotion;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);

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

    /** Draw one figure at its own place on the field. */
    const paint = (
      c: CanvasRenderingContext2D, f: FieldFigure, t: number, greeting: boolean, gclock: number,
    ) => {
      const animKey = greeting
        ? (ALL_ANIMATIONS[f.anim]?.seated ? 'greetseat' : 'greet')
        : f.anim;
      const anim = ALL_ANIMATIONS[animKey] || ALL_ANIMATIONS[f.anim];
      if (!anim) return;

      const pose = anim.frame(greeting ? gclock : t + (f.phase || 0));
      const groundY = f.groundY;
      if (f.shadow !== false) drawShadow(c, f.x, groundY, 16 * f.scale);

      c.save();
      c.translate(f.x, groundY - pelvisOffset(animKey) * f.scale);
      c.scale(f.flip ? -f.scale : f.scale, f.scale);
      draw(c, computePose(pose, CFG, { x: 0, y: 0 }), CFG, {
        color: f.color,
        time: t,
        ...(anim.book ? { book: true } : {}),
        ...(anim.swirl ? { swirl: true } : {}),
        ...(anim.laptop ? { laptop: true } : {}),
        ...(anim.chair ? { chair: true } : {}),
        ...(anim.desk ? { desk: true } : {}),
        ...(anim.cane ? { cane: true } : {}),
        ...(anim.paddle ? { paddle: true } : {}),
        ...(anim.mega ? { mega: true } : {}),
        ...(anim.arm ? { arm: anim.arm } : {}),
        ...f.props,
      });
      c.restore();
    };

    /**
     * Is the point on painted ink for THIS figure? Renders the one candidate alone to a
     * scratch canvas and reads the alpha window around the point. Only ever called for a
     * bounds-matching candidate, and it stops at the first hit, so a crowded field costs one
     * scratch render per hit test rather than one per figure.
     */
    const probeInk = (f: FieldFigure, px: number, py: number): boolean => {
      let scratch = scratchRef.current;
      if (!scratch) {
        scratch = document.createElement('canvas');
        scratchRef.current = scratch;
      }
      const b = figureBounds(f);
      const w = Math.max(1, Math.ceil(b.right - b.left));
      const h = Math.max(1, Math.ceil(b.bottom - b.top));
      if (scratch.width !== w || scratch.height !== h) { scratch.width = w; scratch.height = h; }
      const sc = scratch.getContext('2d', { willReadFrequently: true });
      if (!sc) return false;

      sc.setTransform(1, 0, 0, 1, 0, 0);
      sc.clearRect(0, 0, w, h);
      sc.translate(-b.left, -b.top);
      const greeting = isGreeting(greetRef.current, f.id);
      paint(sc, f, clockRef.current, greeting, greetClock(greetRef.current, f.id));

      const lx = Math.round(px - b.left);
      const ly = Math.round(py - b.top);
      const x0 = Math.max(0, lx - INK_PAD);
      const y0 = Math.max(0, ly - INK_PAD);
      const bw = Math.min(w - x0, INK_PAD * 2 + 1);
      const bh = Math.min(h - y0, INK_PAD * 2 + 1);
      if (bw <= 0 || bh <= 0) return false;

      try {
        const d = sc.getImageData(x0, y0, bw, bh).data;
        for (let i = 3; i < d.length; i += 4) if (d[i] > 8) return true;
      } catch {
        return false; // vectors only, so this should never taint -- but never throw at a user
      }
      return false;
    };

    probeRef.current = probeInk;

    const renderFrame = (t: number, dt: number) => {
      clockRef.current = t;
      const w = widthRef.current;
      const all = figuresRef.current;
      const poof = poofRef.current;

      // Resolve hover before drawing, so a greeting figure is painted greeting this frame.
      if (interactive && poof.phase === 'idle') {
        const p = pointerRef.current;
        const hit = p ? figureAtPoint(all.filter(f => f.greetable !== false), p.x, p.y, probeInk) : null;
        hoveredRef.current = hit ? hit.id : null;
      } else {
        hoveredRef.current = null;
      }
      greetRef.current = greetReduce(greetRef.current, hoveredRef.current, dt);

      if (poof.phase !== 'idle') poofRef.current = poofReduce(poof, { type: 'tick', dt });
      const now = poofRef.current;

      // The room arms once, on entering 'fleeing'.
      if (now.phase === 'fleeing' && poof.phase !== 'fleeing') {
        fleeRef.current = armFlee(all, now.victimId, w);
      }
      if (now.phase === 'fleeing') {
        fleeRef.current = fleeAdvance(fleeRef.current, dt, w);
        if (allGone(fleeRef.current)) {
          poofRef.current = poofReduce(poofRef.current, { type: 'allGone' });
        }
      }

      ctx.clearRect(0, 0, w, height);

      // Nothing survives the exodus: the page stays empty until reload, as on the landing page.
      if (poofRef.current.phase === 'cleared') return;

      // The victim leaves the field the instant the burst fires; the smoke holds his spot.
      const visible = now.taken ? all.filter(f => f.id !== now.victimId) : all;

      // The stun pins everybody at dt = 0 for its full second. Deliberately a hard freeze:
      // in ev-figures.js the dropped props are the only thing moving through it, and that
      // stillness is what sells the shock.
      const frozen = now.phase === 'stunned';

      for (const f of sortByDepth(visible)) {
        const run = fleeRef.current[f.id];
        if (run) {
          if (run.gone) continue;
          paint(ctx, { ...f, x: run.x, anim: 'scurry', flip: run.dir > 0 }, t, false, 0);
          continue;
        }
        paint(
          ctx,
          f,
          frozen ? stunClockRef.current : t,
          !frozen && isGreeting(greetRef.current, f.id),
          greetClock(greetRef.current, f.id),
        );
      }
      if (!frozen) stunClockRef.current = t;

      drawPoofSmoke(ctx, now, all);
    };

    if (!running) {
      renderFrame(0, 0);
      return () => ro.disconnect();
    }

    let rafId = 0;
    const start = performance.now();
    let last = start;
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); // clamp, so a backgrounded tab does not lurch
      last = now;
      renderFrame((now - start) / 1000, dt);
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    return () => {
      ro.disconnect();
      cancelAnimationFrame(rafId);
    };
  }, [height, running, interactive]);

  // ── pointer wiring ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!interactive) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const local = (clientX: number, clientY: number) => {
      const r = canvas.getBoundingClientRect();
      return { x: clientX - r.left, y: clientY - r.top };
    };

    /** Where in this figure's own box the press landed, as a fraction. */
    const fraction = (f: FieldFigure, x: number, y: number) => {
      const b = figureBounds(f);
      const w = b.right - b.left, h = b.bottom - b.top;
      return { fx: w > 0 ? (x - b.left) / w : 0.5, fy: h > 0 ? (y - b.top) / h : 1 };
    };

    const apply = (emit: PoofEvent | null) => {
      if (emit) poofRef.current = poofReduce(poofRef.current, emit);
    };

    const poofableAt = (x: number, y: number) => {
      const candidates = figuresRef.current.filter(f => f.poofable !== false);
      const probe = probeRef.current;
      // Ink, not bounding box. Grabbing a figure you were not actually pointing at is the
      // one mistake this gesture cannot afford -- it destroys something.
      if (!probe) return null;
      return figureAtPoint(candidates, x, y, probe);
    };

    const onMove = (e: MouseEvent) => { pointerRef.current = local(e.clientX, e.clientY); };
    const onLeave = () => {
      pointerRef.current = null;
      const r = gestureReduce(gestureRef.current, { kind: 'cancel' });
      gestureRef.current = r.state; apply(r.emit);
    };

    const onDown = (e: MouseEvent) => {
      const p = local(e.clientX, e.clientY);
      const hit = poofableAt(p.x, p.y);
      const f = hit ? fraction(hit, p.x, p.y) : { fx: 0, fy: 0 };
      const r = gestureReduce(gestureRef.current, {
        kind: 'mousedown', button: e.button, x: p.x, y: p.y,
        id: hit ? hit.id : null, fx: f.fx, fy: f.fy,
      });
      gestureRef.current = r.state; apply(r.emit);
    };

    const onUp = (e: MouseEvent) => {
      const r = gestureReduce(gestureRef.current, { kind: 'mouseup', button: e.button });
      gestureRef.current = r.state; apply(r.emit);
    };

    const onContextMenu = (e: MouseEvent) => {
      if (shouldSuppressContextMenu(gestureRef.current)) e.preventDefault();
    };

    const onTouchStart = (e: TouchEvent) => {
      const t0 = e.touches[0];
      if (!t0) return;
      const p = local(t0.clientX, t0.clientY);
      const hit = poofableAt(p.x, p.y);
      const f = hit ? fraction(hit, p.x, p.y) : { fx: 0, fy: 0 };
      const r = gestureReduce(gestureRef.current, {
        kind: 'touchstart', touches: e.touches.length, x: p.x, y: p.y,
        id: hit ? hit.id : null, fx: f.fx, fy: f.fy, now: performance.now(),
      });
      gestureRef.current = r.state; apply(r.emit);
    };

    const onTouchMove = (e: TouchEvent) => {
      const t0 = e.touches[0];
      if (!t0) return;
      const p = local(t0.clientX, t0.clientY);
      const r = gestureReduce(gestureRef.current, {
        kind: 'touchmove', x: p.x, y: p.y, touches: e.touches.length, now: performance.now(),
      });
      gestureRef.current = r.state; apply(r.emit);
    };

    const onTouchEnd = () => {
      const r = gestureReduce(gestureRef.current, { kind: 'touchend' });
      gestureRef.current = r.state; apply(r.emit);
    };

    // The arming timer only advances on touchmove, and a finger held perfectly still fires
    // no move events -- so nudge it on an interval while a touch is pending.
    const armPoll = window.setInterval(() => {
      if (gestureRef.current.touchArmedAt === null || gestureRef.current.armed) return;
      const r = gestureReduce(gestureRef.current, {
        kind: 'touchmove',
        x: gestureRef.current.startX, y: gestureRef.current.startY,
        touches: 1, now: performance.now(),
      });
      gestureRef.current = r.state; apply(r.emit);
    }, 60);

    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('mouseleave', onLeave);
    canvas.addEventListener('mousedown', onDown);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('blur', onLeave);
    document.addEventListener('contextmenu', onContextMenu);
    canvas.addEventListener('touchstart', onTouchStart, { passive: true });
    canvas.addEventListener('touchmove', onTouchMove, { passive: true });
    canvas.addEventListener('touchend', onTouchEnd);
    canvas.addEventListener('touchcancel', onTouchEnd);

    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onLeave(); };
    document.addEventListener('keydown', onKey);

    return () => {
      window.clearInterval(armPoll);
      canvas.removeEventListener('mousemove', onMove);
      canvas.removeEventListener('mouseleave', onLeave);
      canvas.removeEventListener('mousedown', onDown);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('blur', onLeave);
      document.removeEventListener('contextmenu', onContextMenu);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
      canvas.removeEventListener('touchcancel', onTouchEnd);
      document.removeEventListener('keydown', onKey);
    };
  }, [interactive]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={className}
      style={{
        display: 'block', width: '100%', height,
        pointerEvents: interactive ? 'auto' : 'none',
        touchAction: interactive ? 'pan-y' : undefined,
        ...style,
      }}
    />
  );
}

/**
 * The smoke, drawn last so it sits over every figure. Radius envelopes are ev-figures.js's
 * measured ones: the build-up peaks at 34 and draws BACK to ~22 through the shimmy, because
 * an ever-growing cloud buried the figure right when his struggle is the whole point.
 */
function drawPoofSmoke(ctx: CanvasRenderingContext2D, poof: PoofState, figures: FieldFigure[]) {
  if (poof.phase === 'idle' || poof.phase === 'cleared' || poof.phase === 'stunned') return;
  if (poof.phase === 'fleeing') return;

  const victim = figures.find(f => f.id === poof.victimId);
  if (!victim && !poof.taken) return;

  // Follow him while he is still there; hold his last spot once he is taken.
  const anchor = victim
    ? (() => {
      const b = figureBounds(victim);
      return { x: b.left + poof.fx * (b.right - b.left), y: b.top + poof.fy * (b.bottom - b.top) };
    })()
    : null;
  if (!anchor) return;

  const seed = 11;
  if (poof.phase === 'holding') {
    const k = Math.min(1, poof.t / POOF_HOLD);
    let spread = 12 + k * k * 22;
    if (k > 0.7) spread *= 1 - (k - 0.7) * 1.2;
    drawSmoke(ctx, anchor.x, anchor.y, spread, 0.12 + k * 0.7, seed, poof.t);
  } else if (poof.phase === 'fizzle') {
    const f = Math.max(0, 1 - poof.t / 0.4);
    drawSmoke(ctx, anchor.x, anchor.y, 20 * f, 0.5 * f, seed, poof.t);
  } else if (poof.phase === 'poof') {
    const b = Math.min(1, poof.t / POOF_BURST);
    drawSmoke(ctx, anchor.x, anchor.y - 10, 58 + b * 70, 1 - b, seed, poof.t);
  }
}
