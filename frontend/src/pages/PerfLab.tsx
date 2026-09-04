import { useEffect, useRef } from 'react';
import { CFG, computePose, draw, drawShadow } from '../components/bobbits/leremyRig';
import { ALL_ANIMATIONS, figColor } from '../components/bobbits/rigExtras';
import { pelvisOffset, sortByDepth } from '../components/bobbits/fieldGeometry';
import type { FieldFigure } from '../components/bobbits/fieldGeometry';
import {
  buildTileSet, tileAt, blit, tileKey, DEFAULT_BUCKETS, drawBatched,
} from '../components/bobbits/poseCache';
import type { TileSet } from '../components/bobbits/poseCache';

/**
 * THROWAWAY performance harness for the Stage 2 spike. Not a product route.
 *
 * Driven entirely by Playwright through `window.__perf`. Deliberately does NOT reuse
 * BobitField: the field also runs hover hit-testing, the poof machine and bubble lifetimes,
 * and mixing those into the numbers would measure the wrong thing. This renders the same
 * figures the same way, and nothing else, so the result is the cost of drawing a crowd.
 */

export type SceneKind = 'idle' | 'wave' | 'unique';
export type RenderMode = 'naive' | 'cached' | 'batched';

export interface RunOpts {
  scene: SceneKind;
  mode: RenderMode;
  count: number;
  seconds?: number;
  scale?: number;
  dprCap?: number;
  buckets?: number;
}

export interface RunResult extends RunOpts {
  frames: number;
  /**
   * Median time spent INSIDE the draw loop, in ms. This is the number that matters.
   *
   * Frame-to-frame delta is useless here: requestAnimationFrame is locked to the display
   * refresh, so every configuration that fits inside the budget reports exactly 16.7ms and
   * the interesting differences vanish. Timing the drawing itself shows the real cost and how
   * much headroom is left against a 16.7ms budget.
   */
  drawMedian: number;
  drawP95: number;
  drawWorst: number;
  /** Observed frame delta -- kept only to confirm when work actually starts dropping frames. */
  frameMedian: number;
  fps: number;
  /** ms spent building tiles before the first frame (cached mode only). */
  warmupMs: number;
  tileCount: number;
}

// A pool of poses for the 'unique' scene. Every figure gets its own, which is what defeats
// the tile cache: no two figures can share a tile.
const UNIQUE_POOL = [
  'cheer', 'dance', 'jump', 'shrug', 'confused', 'sassy', 'bored', 'friendly',
  'present', 'offer', 'ponder', 'exhausted', 'scold', 'painhop', 'toddle',
  'march', 'strut', 'scurry', 'sneak', 'trudge', 'stroll', 'shuffle',
];

function buildCast(scene: SceneKind, count: number, scale: number, w: number, h: number): FieldFigure[] {
  const out: FieldFigure[] = [];
  const cols = Math.ceil(Math.sqrt(count * (w / Math.max(1, h))));
  const rows = Math.ceil(count / cols);
  for (let i = 0; i < count; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = ((col + 0.5) / cols) * w;
    const groundY = ((row + 0.85) / rows) * h;

    let anim = 'standstill';
    let phase = 0;
    if (scene === 'idle') {
      // Random phases: the crowd mills independently, the cache's ordinary case.
      phase = (i * 0.6180339887) % 1 * 4;
    } else if (scene === 'wave') {
      // Phase is a function of x -- a stadium wave. Same tile set, blitted in x order.
      anim = 'cheer';
      phase = (x / Math.max(1, w)) * 1.2;
    } else {
      anim = UNIQUE_POOL[i % UNIQUE_POOL.length];
      // A per-figure phase offset that is never a bucket boundary, so no two figures can
      // share a tile even within one animation.
      phase = i * 0.0137;
    }

    out.push({
      id: `f${i}`,
      anim,
      color: figColor(i % 6, false),
      x, groundY, scale, phase,
      flip: i % 3 === 0,
    });
  }
  return out;
}

/**
 * Module-level so a remount cannot disturb a run in flight. The app's auth bootstrap fails
 * CORS on localhost, re-renders, and remounts this route; with the loop owned by an effect
 * that set `stop = true` on cleanup, every measurement was silently cancelled and the result
 * never arrived.
 */
let liveCanvas: HTMLCanvasElement | null = null;
let installed = false;

function run(opts: RunOpts): Promise<RunResult> {
  return new Promise((resolve) => {
    const canvas = liveCanvas!;
    const seconds = opts.seconds ?? 4;
    const scale = opts.scale ?? 0.28;
    const dprCap = opts.dprCap ?? 1.5;
    const buckets = opts.buckets ?? DEFAULT_BUCKETS;

    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, dprCap);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const cast = sortByDepth(buildCast(opts.scene, opts.count, scale, w, h));

    // Warm-up: build every tile set the cast needs, before the clock starts.
    const sets = new Map<string, TileSet>();
    const t0 = performance.now();
    if (opts.mode === 'cached') {
      for (const f of cast) {
        const key = tileKey(f.anim, f.color, scale, !!f.flip);
        if (!sets.has(key)) {
          sets.set(key, buildTileSet(f.anim, f.color, scale, !!f.flip, buckets, dpr));
        }
      }
    }
    const warmupMs = performance.now() - t0;
    const tileCount = [...sets.values()].reduce((n, s) => n + s.tiles.length, 0);

    const deltas: number[] = [];
    const draws: number[] = [];
    const start = performance.now();
    let last = start;

    const frame = (now: number) => {
      deltas.push(now - last);
      last = now;
      const t = (now - start) / 1000;

      const d0 = performance.now();
      ctx.clearRect(0, 0, w, h);
      for (const f of cast) {
        drawShadow(ctx, f.x, f.groundY, 16 * scale);
        if (opts.mode === 'cached') {
          const set = sets.get(tileKey(f.anim, f.color, scale, !!f.flip))!;
          blit(ctx, set, tileAt(set, t, f.phase || 0), f.x, f.groundY, f.anim, scale);
        } else {
          const pose = ALL_ANIMATIONS[f.anim].frame(t + (f.phase || 0));
          ctx.save();
          ctx.translate(f.x, f.groundY - pelvisOffset(f.anim) * scale);
          ctx.scale(f.flip ? -scale : scale, scale);
          const j = computePose(pose, CFG, { x: 0, y: 0 });
          if (opts.mode === 'batched') drawBatched(ctx, j, CFG, f.color);
          else draw(ctx, j, CFG, { color: f.color });
          ctx.restore();
        }
      }

      // getImageData forces the drawing to actually flush before the clock stops. Without it
      // canvas work is queued and the measurement reads as near-zero -- it would time how
      // fast we can ENQUEUE commands, not how long they take. Measured cost of the readback
      // itself is 0.2ms, small enough not to distort the comparison.
      ctx.getImageData(0, 0, 1, 1);
      draws.push(performance.now() - d0);

      if (now - start >= seconds * 1000) {
        // Drop the first few frames: they carry first-paint and layout costs that are not
        // part of steady-state rendering.
        const sortNum = (xs: number[]) => xs.slice(5).sort((a, b) => a - b);
        const q = (xs: number[], p: number) => xs[Math.min(xs.length - 1, Math.floor(xs.length * p))] ?? 0;
        const fr = sortNum(deltas);
        const dr = sortNum(draws);
        resolve({
          ...opts,
          frames: deltas.length,
          drawMedian: +q(dr, 0.5).toFixed(2),
          drawP95: +q(dr, 0.95).toFixed(2),
          drawWorst: +(dr[dr.length - 1] ?? 0).toFixed(2),
          frameMedian: +q(fr, 0.5).toFixed(2),
          fps: +(1000 / Math.max(0.01, q(fr, 0.5))).toFixed(1),
          warmupMs: +warmupMs.toFixed(1),
          tileCount,
        });
        return;
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
}

export function PerfLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    liveCanvas = canvasRef.current;
    if (installed) return;
    installed = true;
    const w = window as unknown as { __perf: unknown; __perfResult: RunResult | null };
    w.__perfResult = null;
    w.__perf = {
      run,
      start(opts: RunOpts) {
        w.__perfResult = null;
        run(opts).then(r => { w.__perfResult = r; });
      },
    };
  }, []);

  return (
    <div style={{ margin: 0, background: '#fff' }}>
      <canvas
        ref={canvasRef}
        id="perf-canvas"
        style={{ display: 'block', width: '1280px', height: '900px' }}
      />
    </div>
  );
}
