/**
 * Ported from empowered.vote's leremy-rig.js — the actual "Bobbit" stick-figure
 * engine used on the main marketing site. Same forward-kinematics skeleton and
 * capsule rendering; this file keeps only the geometry/pose math (no DOM/canvas
 * lifecycle, no scene-casting logic — that lives in BobbitCanvas/BobbitScene).
 *
 * A pose is 12 numbers, angles in degrees relative to the torso's own lean, so
 * leaning naturally carries the limbs with it. 0° points straight down; +ve
 * rotates toward the viewer's right.
 */

const D = Math.PI / 180;

export interface Pose {
  lean: number;
  headTilt: number;
  bob: number;
  hunch: number;
  armRU: number; armRF: number;
  armLU: number; armLF: number;
  legRU: number; legRF: number;
  legLU: number; legLF: number;
}

export interface Point { x: number; y: number; }

export interface Joints {
  P: Point; M: Point; N: Point; H: Point; shoulderC: Point;
  sR: Point; sL: Point; eR: Point; hR: Point; eL: Point; hL: Point;
  hipR: Point; hipL: Point; kR: Point; kL: Point; fR: Point; fL: Point;
  lean: number; spineA: number;
}

/** Proportions tuned to the reference figure: big head, short wide torso, long thick limbs. */
export const CFG = {
  R: 30,
  gap: 9,
  torsoLen: 74,
  torsoW: 24,
  armW: 12,
  upperArm: 42,
  foreArm: 40,
  legW: 14,
  thigh: 56,
  shin: 54,
  shoulderHalf: 5,
  hipHalf: 4,
};

/**
 * The exact brand-derived figure palette from ev-figures.js — 6 tones, tuned separately per
 * theme for legibility (0 teal · 1 coral · 2 gold · 3 green · 4 purple · 5 orange).
 */
export const FIG_COLORS = {
  light: ['#007D99', '#FF5740', '#B8860B', '#2E9E5B', '#7A4FD0', '#E0641C'],
  dark: ['#1DA8C6', '#FF6B52', '#FFD740', '#43D07E', '#B49BFF', '#FF9A4D'],
};

export function figColor(i: number, darkMode: boolean): string {
  const pal = darkMode ? FIG_COLORS.dark : FIG_COLORS.light;
  return pal[i % pal.length];
}

export const REST: Pose = {
  lean: 0, headTilt: 0, bob: 0, hunch: 0,
  armRU: 15, armRF: 11, armLU: -15, armLF: -11,
  legRU: 7, legRF: 3, legLU: -7, legLF: -3,
};

function vec(a: number): Point { const r = a * D; return { x: Math.sin(r), y: Math.cos(r) }; }
function add(p: Point, v: Point, l: number): Point { return { x: p.x + v.x * l, y: p.y + v.y * l }; }

export function clonePose(p: Pose): Pose { return { ...p }; }
export function wave(t: number, f: number, ph = 0): number { return Math.sin(t * f * Math.PI * 2 + ph); }

export function computePose(pose: Pose, cfg = CFG, origin: Point = { x: 0, y: 0 }): Joints {
  const lean = pose.lean || 0;
  const hunch = pose.hunch || 0;
  const spineA = 180 + lean;
  const P = { x: origin.x, y: origin.y + (pose.bob || 0) };

  const M = add(P, vec(spineA + hunch * 0.4), cfg.torsoLen * 0.55);
  const upA = spineA + hunch;
  const N = add(M, vec(upA), cfg.torsoLen * 0.45);
  const shoulderC = add(M, vec(upA), cfg.torsoLen * 0.35);
  const H = add(N, vec(upA + (pose.headTilt || 0)), cfg.gap + cfg.R);

  const perpR = upA - 90, perpL = upA + 90;
  const sR = add(shoulderC, vec(perpR), cfg.shoulderHalf);
  const sL = add(shoulderC, vec(perpL), cfg.shoulderHalf);

  const ub = lean + hunch;
  const eR = add(sR, vec(ub + pose.armRU), cfg.upperArm);
  const hR = add(eR, vec(ub + pose.armRF), cfg.foreArm);
  const eL = add(sL, vec(ub + pose.armLU), cfg.upperArm);
  const hL = add(eL, vec(ub + pose.armLF), cfg.foreArm);

  const pperpR = spineA - 90, pperpL = spineA + 90;
  const hipR = add(P, vec(pperpR), cfg.hipHalf);
  const hipL = add(P, vec(pperpL), cfg.hipHalf);
  const kR = add(hipR, vec(lean + pose.legRU), cfg.thigh);
  const fR = add(kR, vec(lean + pose.legRF), cfg.shin);
  const kL = add(hipL, vec(lean + pose.legLU), cfg.thigh);
  const fL = add(kL, vec(lean + pose.legLF), cfg.shin);

  return { P, M, N, H, shoulderC, sR, sL, eR, hR, eL, hL, hipR, hipL, kR, kL, fR, fL, lean, spineA };
}

function capsule(ctx: CanvasRenderingContext2D, a: Point, b: Point, w: number) {
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
}

function drawTorso(ctx: CanvasRenderingContext2D, j: Joints, cfg: typeof CFG) {
  ctx.lineCap = 'round';
  ctx.lineWidth = cfg.torsoW;
  ctx.beginPath();
  ctx.moveTo(j.P.x, j.P.y);
  ctx.quadraticCurveTo(j.M.x, j.M.y, j.shoulderC.x, j.shoulderC.y);
  ctx.stroke();
}

/** A small open book held between the hands — this app's stand-in for the rig's own book prop. */
function drawQuizCard(ctx: CanvasRenderingContext2D, x: number, y: number, _color: string, rot: number) {
  const yellow = '#FFD426';
  const yellowDark = '#C99A00';
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = yellow;
  ctx.strokeStyle = yellowDark;
  ctx.lineWidth = 1.6;
  ctx.lineJoin = 'round';

  // left page
  ctx.beginPath();
  ctx.moveTo(0, -3); ctx.lineTo(-17, -11); ctx.lineTo(-17, 13); ctx.lineTo(0, 20);
  ctx.closePath();
  ctx.fill(); ctx.stroke();

  // right page
  ctx.beginPath();
  ctx.moveTo(0, -3); ctx.lineTo(17, -9); ctx.lineTo(17, 15); ctx.lineTo(0, 20);
  ctx.closePath();
  ctx.fill(); ctx.stroke();

  // spine
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(0, -3); ctx.lineTo(0, 20);
  ctx.stroke();

  ctx.restore();
}

export interface DrawOpts {
  color?: string;
  /** Draw a trivia question card held between the hands (this app's "read" prop). */
  card?: boolean;
  cardRot?: number;
}

export function draw(ctx: CanvasRenderingContext2D, j: Joints, cfg = CFG, opts: DrawOpts = {}) {
  const color = opts.color || '#172B4D';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = color;
  ctx.fillStyle = color;

  // back leg + back arm first (viewer-left = back by convention)
  capsule(ctx, j.hipL, j.kL, cfg.legW);
  capsule(ctx, j.kL, j.fL, cfg.legW);
  capsule(ctx, j.sL, j.eL, cfg.armW);
  capsule(ctx, j.eL, j.hL, cfg.armW);

  drawTorso(ctx, j, cfg);

  // front leg + front arm
  capsule(ctx, j.hipR, j.kR, cfg.legW);
  capsule(ctx, j.kR, j.fR, cfg.legW);
  capsule(ctx, j.sR, j.eR, cfg.armW);
  capsule(ctx, j.eR, j.hR, cfg.armW);

  // head
  ctx.beginPath();
  ctx.arc(j.H.x, j.H.y, cfg.R, 0, Math.PI * 2);
  ctx.fill();

  if (opts.card) {
    const mx = (j.hR.x + j.hL.x) / 2, my = (j.hR.y + j.hL.y) / 2;
    drawQuizCard(ctx, mx, my, color, opts.cardRot != null ? opts.cardRot : -0.24);
  }
}

const TROPHY_GOLD = '#FFD426';
const TROPHY_TEAL_DARK = '#59B0C4';
const TROPHY_TEAL_LIGHT = '#AAE7F5';

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function quadPath(ctx: CanvasRenderingContext2D, pts: [number, number][]) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
}

function drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const outerA = -Math.PI / 2 + i * (2 * Math.PI / 5);
    const innerA = outerA + Math.PI / 5;
    const ox = cx + Math.cos(outerA) * r, oy = cy + Math.sin(outerA) * r;
    const ix = cx + Math.cos(innerA) * r * 0.45, iy = cy + Math.sin(innerA) * r * 0.45;
    if (i === 0) ctx.moveTo(ox, oy); else ctx.lineTo(ox, oy);
    ctx.lineTo(ix, iy);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/**
 * The Civic Trivia Championship logo's own trophy — a faceted teal ribbon (two dark-teal
 * facets behind, two light-teal facets in front) under a gold star, on a two-tier gold
 * pedestal. Geometry ported directly from civic-trivia-logo-dark.svg's trophy paths
 * (right-aligned decoration, ~x:587-674 y:0-166 in the source), re-centered so x=0 is the
 * pedestal's own center and y=0 is its bottom edge, then scaled by 166 units -> ~48 raw
 * units so it sits correctly among the Bobbit figures (head radius 30, standing height ~195).
 * `s` is the same raw-unit scale factor used for the figures.
 */
export function drawTrophy(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.lineJoin = 'round';

  // two-tier gold pedestal (wider bottom step, narrower top step)
  ctx.fillStyle = TROPHY_GOLD;
  roundRectPath(ctx, -12.5 * s, -4.4 * s, 25 * s, 4.4 * s, 0.6 * s);
  ctx.fill();
  roundRectPath(ctx, -9.9 * s, -8.76 * s, 19.8 * s, 4.36 * s, 0.6 * s);
  ctx.fill();

  // faceted ribbon body — dark-teal facets behind, light-teal facets layered in front
  ctx.fillStyle = TROPHY_TEAL_DARK;
  quadPath(ctx, [[-0.51 * s, -8.77 * s], [-0.51 * s, -36.89 * s], [-9.88 * s, -41.89 * s], [-4.05 * s, -8.77 * s]]);
  ctx.fill();
  quadPath(ctx, [[-2.38 * s, -8.70 * s], [-2.38 * s, -29.92 * s], [-10.16 * s, -33.70 * s], [-5.32 * s, -8.70 * s]]);
  ctx.fill();

  ctx.fillStyle = TROPHY_TEAL_LIGHT;
  quadPath(ctx, [[-4.05 * s, -8.70 * s], [-4.05 * s, -33.70 * s], [6.50 * s, -29.15 * s], [1.40 * s, -8.70 * s]]);
  ctx.fill();
  quadPath(ctx, [[-2.38 * s, -8.70 * s], [-2.38 * s, -25.36 * s], [7.06 * s, -22.33 * s], [2.49 * s, -8.70 * s]]);
  ctx.fill();

  // gold star on top, offset slightly left of center to match the source logo
  drawStar(ctx, -5.19 * s, -42.49 * s, 5.66 * s, TROPHY_GOLD);

  ctx.restore();
}

export function drawShadow(ctx: CanvasRenderingContext2D, cx: number, groundY: number, w: number, color = 'rgba(23,43,77,0.10)') {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(cx, groundY, w, w * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export interface Animation {
  frame(t: number, v?: { hand?: 'L' | 'R'; hz?: number }): Pose;
}

/** Curated subset of the marketing site's ~35 poses — the ones that fit a trivia landing scene. */
export const ANIMATIONS: Record<string, Animation> = {
  standstill: {
    frame(t) {
      const p = clonePose(REST);
      p.bob = wave(t, 0.3) * 1.5;
      p.headTilt = wave(t, 0.08) * 6;
      return p;
    },
  },
  friendly: {
    frame(t) {
      const p = clonePose(REST);
      p.bob = wave(t, 0.9) * 2.5 + 1;
      p.headTilt = -6 + wave(t, 0.9) * 3;
      p.armRU = 150;
      p.armRF = 152 + wave(t, 1.6) * 24;
      p.armLU = -18; p.armLF = -14;
      return p;
    },
  },
  sit: {
    frame(t) {
      const p = clonePose(REST);
      const br = wave(t, 0.3);
      p.lean = 3;
      p.hunch = -(8 + br * 2);
      p.bob = br * 1.5;
      const peek = Math.max(0, wave(t, 0.07, 1)) ** 6;
      p.hunch -= peek * 18;
      p.headTilt = wave(t, 0.09) * 16 + peek * 12;
      p.armRU = 26 + br * 2; p.armRF = 10;
      p.armLU = -22 - br * 2; p.armLF = -8;
      p.legRU = 82; p.legRF = 6 + wave(t, 0.45) * 14;
      p.legLU = 74; p.legLF = 4 + wave(t, 0.45, Math.PI) * 14;
      return p;
    },
  },
  read: {
    frame(t) {
      const p = clonePose(REST);
      const br = wave(t, 0.28);
      p.lean = 4;
      p.hunch = -(22 + br * 3);
      p.bob = br * 1.5;
      p.headTilt = -(12 + br * 2);
      const flip = Math.max(0, wave(t, 0.18)) ** 10;
      p.armRU = 62 + br * 2; p.armRF = 132 + flip * 26;
      p.armLU = 42 - br * 2; p.armLF = 108 + br * 3;
      p.legRU = 78; p.legRF = 12 + wave(t, 0.3) * 6;
      p.legLU = 70; p.legLF = 5;
      return p;
    },
  },
  // cheer/offer/ponder are layered on top of `present` in the source (var base = A.present),
  // inheriting its lean/bob/hand-on-hip before overriding specific fields — not built from REST.
  cheer: {
    frame(t) {
      const p = ANIMATIONS.present.frame(t);
      const s = wave(t, 1.05);
      p.armRU = 150 + s * 6; p.armRF = 150 + s * 9;
      p.armLU = -150 - s * 6; p.armLF = -150 - s * 9;
      p.headTilt = -7;
      p.bob = p.bob - 1.5 - Math.abs(s) * 2;
      return p;
    },
  },
  // Not in the source rig — an original addition. Hands stay up (same silhouette as cheer)
  // but the whole body sways and steps side to side with a bouncy beat, and the arms pump
  // out of sync with each other, so it reads as dancing rather than a held celebration pose.
  dance: {
    frame(t) {
      const p = clonePose(REST);
      const sway = wave(t, 1.1);
      const pumpR = wave(t, 2.2);
      const pumpL = wave(t, 2.2, Math.PI * 0.6);
      p.lean = sway * 12;
      p.bob = -Math.abs(wave(t, 2.2)) * 5 + 3;
      p.hunch = -4;
      p.headTilt = sway * 10 + pumpR * 4;
      p.armRU = 150 + pumpR * 14;
      p.armRF = 150 + pumpR * 22;
      p.armLU = -150 - pumpL * 14;
      p.armLF = -150 - pumpL * 22;
      p.legRU = 10 + sway * 20;
      p.legLU = -10 - sway * 20;
      p.legRF = -Math.max(0, sway) * 22;
      p.legLF = Math.max(0, -sway) * 22;
      return p;
    },
  },
  greet: {
    frame(t, v) {
      v = v || {};
      const hz = v.hz || 1.6;
      const p = clonePose(REST);
      const look = Math.min(1, t / 0.35);
      p.bob = 1 + wave(t, 0.9) * 1.5;
      p.hunch = -4 * look;
      p.headTilt = -12 * look + wave(t, 0.5) * 3;
      const wv = Math.min(1, Math.max(0, (t - 0.55) / 0.3));
      const osc = t > 0.9 ? wave(t, hz) * 24 : 0;
      if (v.hand === 'L') { p.armLU = -15 - 137 * wv; p.armLF = -11 - 143 * wv - osc; }
      else { p.armRU = 15 + 137 * wv; p.armRF = 11 + 143 * wv + osc; }
      return p;
    },
  },
  // Seated variant of greet — sitting on an edge with legs dangling, waving hello.
  greetseat: {
    frame(t, v) {
      v = v || {};
      const hz = v.hz || 1.6;
      const p = clonePose(REST);
      const look = Math.min(1, t / 0.35);
      p.bob = wave(t, 0.9) * 1.2;
      p.hunch = -6 * look;
      p.headTilt = -16 * look + wave(t, 0.5) * 3;
      const wv = Math.min(1, Math.max(0, (t - 0.55) / 0.3));
      const osc = t > 0.9 ? wave(t, hz) * 24 : 0;
      if (v.hand === 'L') { p.armLU = -26 - 126 * wv; p.armLF = -10 - 144 * wv - osc; p.armRU = 22; p.armRF = 8; }
      else { p.armRU = 26 + 126 * wv; p.armRF = 10 + 144 * wv + osc; p.armLU = -22; p.armLF = -8; }
      p.legRU = 82; p.legRF = 10;
      p.legLU = 74; p.legLF = 6;
      return p;
    },
  },
  present: {
    frame(t) {
      const p = clonePose(REST);
      p.lean = -3;
      p.bob = wave(t, 0.5) * 2;
      p.headTilt = -6;
      p.armRU = 88 + wave(t, 0.5) * 6;
      p.armRF = 94 + wave(t, 0.5) * 8;
      p.armLU = -52; p.armLF = 132;
      return p;
    },
  },
  offer: {
    frame(t) {
      const p = ANIMATIONS.present.frame(t);
      const s = wave(t, 0.7);
      p.armRU = 78 + s * 3; p.armRF = 92 + s * 3;
      p.headTilt = -3;
      return p;
    },
  },
  ponder: {
    frame(t) {
      const p = ANIMATIONS.present.frame(t);
      const s = wave(t, 0.45);
      p.armRU = 34; p.armRF = -162 + s * 3;
      p.headTilt = 11 + s * 2;
      p.hunch = p.hunch - 2;
      return p;
    },
  },
  // Lateral walk cycle: legs scissor front/back in profile, hunch carries the upper body.
  // Ported from makeGait() in leremy-rig.js — same sine-driven stride/knee-bend math.
  stroll: makeGait({ speed: 2.0, stride: 24, hunch: -7, knee: 30, arm: 14, bob: 3, head: -5 }),
  // Same gait, arms locked low and fixed (hands occupied holding something between two carriers).
  carry: (() => {
    const g = makeGait({ speed: 1.8, stride: 18, hunch: -14, knee: 22, arm: 0, bob: 2.5, head: -6 });
    const base = g.frame;
    return { frame: (t: number) => { const p = base(t); p.armRU = 16; p.armRF = 6; p.armLU = -16; p.armLF = -6; return p; } };
  })(),
  // Straight-back hinge: folds deep at the hips so the reach goes down toward hand height,
  // then straightens back up. bend (see heaveBend) goes 0 -> 1 over t:[0,0.6], 1 -> 0 over
  // t:[0.6,1.2] — callers drive t directly to control which half of the motion plays.
  heave: {
    frame(t) {
      const p = clonePose(REST);
      const bend = heaveBend(t);
      p.hunch = -42 * bend;
      p.bob = 10 * bend;
      p.headTilt = -18 * bend;
      p.legRU = 10 * bend; p.legRF = 8 * bend;
      p.legLU = -10 * bend; p.legLF = -8 * bend;
      p.armRU = 16 + 44 * bend; p.armRF = 6 + 34 * bend;
      p.armLU = -16 - 44 * bend; p.armLF = -6 - 34 * bend;
      return p;
    },
  },
};

/** The bend fraction (0 = upright, 1 = fully folded) `heave` reaches at a given t. */
export function heaveBend(t: number): number {
  return Math.sin(Math.min(1, t / 1.2) * Math.PI);
}

interface GaitParams {
  speed: number; stride: number; hunch: number; knee: number; arm: number; bob: number; head: number;
}

function makeGait(g: GaitParams): Animation {
  return {
    frame(t) {
      const p = clonePose(REST);
      const sw = Math.sin(t * g.speed * Math.PI);
      p.bob = -Math.abs(sw) * g.bob + 2;
      p.lean = -2;
      p.hunch = g.hunch + wave(t, g.speed / 4) * 3;
      p.headTilt = g.head + wave(t, g.speed / 2) * 3;
      p.legRU = sw * g.stride;
      p.legLU = -sw * g.stride;
      p.legRF = p.legRU - Math.max(0, sw) * g.knee;
      p.legLF = p.legLU - Math.max(0, -sw) * g.knee;
      p.armRU = 4 - sw * g.arm; p.armRF = 2 - sw * g.arm * 0.6;
      p.armLU = -4 + sw * g.arm; p.armLF = -2 + sw * g.arm * 0.6;
      return p;
    },
  };
}
