import { CFG, computePose, draw } from './leremyRig';
import { ALL_ANIMATIONS } from './rigExtras';
import { pelvisOffset } from './fieldGeometry';

/**
 * Pre-rendered pose tiles.
 *
 * The naive path recomputes a pose and issues ~15 canvas path operations per figure per
 * frame. At 154 figures that is ~2,300 path ops every frame.
 *
 * The insight this exploits: if animation time is quantised into N buckets across one cycle,
 * the pose for bucket k is ALWAYS the pose at k * (cycle / N). It never changes. So the tiles
 * can be rendered once at startup and every subsequent frame is N `drawImage` blits and no
 * pose maths at all.
 *
 * A figure with phase p at time t wants bucket floor((((t + p) % cycle) / cycle) * N). As t
 * advances every figure walks through the same fixed tile set, which is why one set serves an
 * arbitrarily large crowd.
 *
 * The cost is memory and a startup pause: one tile per (animation x colour x flip x bucket).
 */

/** Buckets per cycle. 24 across a ~1s gait is ~42ms per step, below the flicker-fusion floor. */
export const DEFAULT_BUCKETS = 24;

/**
 * True cycle length per animation, in seconds. A wrong value does not cost performance, only
 * smoothness -- the loop visibly jumps where the cycle seam falls.
 */
const CYCLE: Record<string, number> = {
  standstill: 1 / 0.28,   // breathing at wave(t, 0.28)
  bored: 1 / 0.28,
  friendly: 2,
  stroll: 1, shuffle: 2 / 1.5, strut: 2 / 2.2, scurry: 2 / 4.6,
  march: 2 / 2.4, sneak: 2 / 1.3, trudge: 2 / 1.1,
  carry: 2 / 1.8, hefty: 2 / 1.5,
  dance: 1 / 1.1,
  cheer: 1 / 1.05,
};
const DEFAULT_CYCLE = 4;

export function cycleOf(anim: string): number {
  return CYCLE[anim] ?? DEFAULT_CYCLE;
}

export interface TileSet {
  tiles: HTMLCanvasElement[];
  /** Where the figure's pelvis sits inside a tile, in css px. */
  originX: number;
  originY: number;
  cycle: number;
  buckets: number;
  /** css px */
  width: number;
  height: number;
}

// Generous enough for a raised wave arm and a full splay. Measured against the widest poses
// (cheer, dance, jump) rather than the resting silhouette.
const TILE_W_UNITS = 200;
const TILE_H_UNITS = 300;
const PELVIS_IN_TILE_UNITS = 190;

export function buildTileSet(
  anim: string, color: string, scale: number, flip: boolean,
  buckets = DEFAULT_BUCKETS, dpr = 1,
): TileSet {
  const a = ALL_ANIMATIONS[anim];
  const cycle = cycleOf(anim);
  const width = TILE_W_UNITS * scale;
  const height = TILE_H_UNITS * scale;
  const originX = width / 2;
  const originY = PELVIS_IN_TILE_UNITS * scale;

  const tiles: HTMLCanvasElement[] = [];
  for (let k = 0; k < buckets; k++) {
    const c = document.createElement('canvas');
    c.width = Math.ceil(width * dpr);
    c.height = Math.ceil(height * dpr);
    const ctx = c.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.translate(originX, originY);
    ctx.scale(flip ? -scale : scale, scale);
    draw(ctx, computePose(a.frame((k / buckets) * cycle), CFG, { x: 0, y: 0 }), CFG, { color });
    tiles.push(c);
  }
  return { tiles, originX, originY, cycle, buckets, width, height };
}

/** The tile a figure wants right now. */
export function tileAt(set: TileSet, t: number, phase: number): HTMLCanvasElement {
  const cyc = set.cycle;
  const local = (((t + phase) % cyc) + cyc) % cyc;
  const k = Math.floor((local / cyc) * set.buckets) % set.buckets;
  return set.tiles[k];
}

/** Blit a cached figure so its ground-contact line lands on `groundY`. */
export function blit(
  ctx: CanvasRenderingContext2D, set: TileSet, tile: HTMLCanvasElement,
  x: number, groundY: number, anim: string, scale: number,
) {
  const pelvisY = groundY - pelvisOffset(anim) * scale;
  ctx.drawImage(
    tile,
    x - set.originX, pelvisY - set.originY,
    set.width, set.height,
  );
}

/** Cache key for a tile set. Colour and flip both change the pixels, so both are in the key. */
export function tileKey(anim: string, color: string, scale: number, flip: boolean): string {
  return `${anim}|${color}|${scale.toFixed(3)}|${flip ? 1 : 0}`;
}

/**
 * Batched figure draw: same geometry, a quarter of the canvas calls.
 *
 * `draw()` issues a beginPath/moveTo/lineTo/stroke per limb segment -- 15 or so per figure.
 * The spike measured the naive path as bound by that call count rather than by fill: shrinking
 * figures barely helped, which is not how a fill-bound cost behaves.
 *
 * The figure is drawn in exactly ONE colour, so the painter's-order the segments are issued in
 * has no visible effect -- overlapping strokes of the same colour are indistinguishable from
 * any other order. That frees us to group segments by line width instead of by body part:
 * one path for legs, one for arms, one for the torso, one fill for the head. Four calls.
 *
 * Only valid for a plain monochrome figure. Anything with a prop or a second colour must go
 * through `draw()`.
 */
export function drawBatched(
  ctx: CanvasRenderingContext2D,
  j: ReturnType<typeof computePose>,
  cfg = CFG,
  color = '#172B4D',
) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = color;
  ctx.fillStyle = color;

  // legs
  ctx.lineWidth = cfg.legW;
  ctx.beginPath();
  ctx.moveTo(j.hipL.x, j.hipL.y); ctx.lineTo(j.kL.x, j.kL.y); ctx.lineTo(j.fL.x, j.fL.y);
  ctx.moveTo(j.hipR.x, j.hipR.y); ctx.lineTo(j.kR.x, j.kR.y); ctx.lineTo(j.fR.x, j.fR.y);
  ctx.stroke();

  // arms
  ctx.lineWidth = cfg.armW;
  ctx.beginPath();
  ctx.moveTo(j.sL.x, j.sL.y); ctx.lineTo(j.eL.x, j.eL.y); ctx.lineTo(j.hL.x, j.hL.y);
  ctx.moveTo(j.sR.x, j.sR.y); ctx.lineTo(j.eR.x, j.eR.y); ctx.lineTo(j.hR.x, j.hR.y);
  ctx.stroke();

  // torso
  ctx.lineWidth = cfg.torsoW;
  ctx.beginPath();
  ctx.moveTo(j.P.x, j.P.y);
  ctx.quadraticCurveTo(j.M.x, j.M.y, j.shoulderC.x, j.shoulderC.y);
  ctx.stroke();

  // head
  ctx.beginPath();
  ctx.arc(j.H.x, j.H.y, cfg.R, 0, Math.PI * 2);
  ctx.fill();
}
