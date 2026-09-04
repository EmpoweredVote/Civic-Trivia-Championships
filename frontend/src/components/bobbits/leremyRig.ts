/**
 * Leremy Rig — articulated stick-figure engine.
 *
 * Ported from empowered.vote's `leremy-rig.js`, which is the source of truth for this
 * engine across EV products. A skeleton of joints (forward kinematics) rendered as thick
 * round-capped capsules plus a filled head, matching the "leremy" Noun Project pictogram
 * style. Poses are procedural functions of time, so every loop stays perfectly on-model.
 *
 * A pose is 12 numbers, angles in degrees relative to the torso's own lean, so leaning
 * naturally carries the limbs with it. 0° points straight down; +ve rotates toward the
 * viewer's right.
 *
 * Keep this file a faithful mirror of the landing page's rig so re-syncing stays a clean
 * overwrite. CTC-only additions (extra animations, the brand palette) live in `rigExtras.ts`.
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

/**
 * Proportions tuned to the reference figure: big head, short wide torso block, long thick
 * limbs. Everything scales from head radius R.
 *
 * `neckW` is carried across from the landing page's rig for fidelity but is referenced
 * nowhere — the torso is drawn as an untapered capsule in both implementations.
 */
export const CFG = {
  R: 30,          // head radius
  gap: 9,         // neck gap between head and torso
  torsoLen: 74,   // shoulder -> hip
  torsoW: 24,     // torso bar width (slim rounded capsule)
  neckW: 22,      // narrower at the neck (taper) — unused, kept for parity
  armW: 12,       // limb thickness
  upperArm: 42,
  foreArm: 40,
  legW: 14,
  thigh: 56,
  shin: 54,
  shoulderHalf: 5,  // limbs attach inside the torso capsule (no shoulder bumps)
  hipHalf: 4,
};

/**
 * REST pose. Convention: RIGHT limb (viewer-right) splays with +angle (rightward), LEFT
 * limb with -angle. Straight up is ±180.
 */
export const REST: Pose = {
  lean: 0, headTilt: 0, bob: 0, hunch: 0,
  armRU: 15, armRF: 11, armLU: -15, armLF: -11,
  legRU: 7, legRF: 3, legLU: -7, legLF: -3,
};

// angle convention: 0° points straight DOWN. +ve rotates toward the viewer's right
// (clockwise on screen). vec returns a unit direction.
function vec(a: number): Point { const r = a * D; return { x: Math.sin(r), y: Math.cos(r) }; }
function add(p: Point, v: Point, l: number): Point { return { x: p.x + v.x * l, y: p.y + v.y * l }; }

export function clonePose(p: Pose): Pose { return { ...p }; }
export function wave(t: number, f: number, ph = 0): number { return Math.sin(t * f * Math.PI * 2 + ph); }

/**
 * Compute all joint world positions from a pose. Pose angles are RELATIVE to the torso
 * lean, so leaning carries the limbs.
 */
export function computePose(pose: Pose, cfg = CFG, origin: Point = { x: 0, y: 0 }): Joints {
  const lean = pose.lean || 0;
  const hunch = pose.hunch || 0;             // forward spine curl (deg)
  const spineA = 180 + lean;                 // pelvis -> up
  const P = { x: origin.x, y: origin.y + (pose.bob || 0) };  // pelvis

  // curved spine: lower half curls a little, upper half curls fully
  const M = add(P, vec(spineA + hunch * 0.4), cfg.torsoLen * 0.55);  // mid spine
  const upA = spineA + hunch;                // upper-body direction
  const N = add(M, vec(upA), cfg.torsoLen * 0.45);          // neck
  const shoulderC = add(M, vec(upA), cfg.torsoLen * 0.35);
  const H = add(N, vec(upA + (pose.headTilt || 0)), cfg.gap + cfg.R); // head center

  const perpR = upA - 90, perpL = upA + 90;
  const sR = add(shoulderC, vec(perpR), cfg.shoulderHalf); // viewer-right shoulder
  const sL = add(shoulderC, vec(perpL), cfg.shoulderHalf); // viewer-left shoulder

  const ub = lean + hunch;                   // arms hang from the curled upper body
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
  // curved spine: rounded capsule bent through the mid-spine point
  ctx.lineCap = 'round';
  ctx.lineWidth = cfg.torsoW;
  ctx.beginPath();
  ctx.moveTo(j.P.x, j.P.y);
  ctx.quadraticCurveTo(j.M.x, j.M.y, j.shoulderC.x, j.shoulderC.y);
  ctx.stroke();
}

export interface DrawOpts {
  color?: string;
  /** Which arm holds the prop — that arm is drawn as the FRONT arm. */
  arm?: 'R' | 'L';
  mega?: boolean;
  megaColor?: string;
  book?: boolean;
  phone?: boolean;
  phoneRot?: number;
  swirl?: boolean;
  laptop?: boolean;
  chair?: boolean;
  chairColor?: string;
  desk?: boolean;
  deskColor?: string;
  screenColor?: string;
  cane?: boolean;
  paddle?: boolean;
  /** Seconds, for props that animate independently of the pose (swirl, paddleball). */
  time?: number;
  /** CTC's own prop: a trivia question card held between the hands. */
  card?: boolean;
  cardRot?: number;
}

export function draw(ctx: CanvasRenderingContext2D, j: Joints, cfg = CFG, opts: DrawOpts = {}) {
  const color = opts.color || '#172B4D';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = color;
  ctx.fillStyle = color;

  // which arm holds the prop -> draw it as the FRONT arm
  const megaArm = opts.arm || 'R';

  // office chair sits BEHIND the figure (draw first so the body occludes it)
  if (opts.chair) drawChair(ctx, j, opts.chairColor || color);

  // back leg + back arm first (viewer-left = back by convention)
  capsule(ctx, j.hipL, j.kL, cfg.legW);
  capsule(ctx, j.kL, j.fL, cfg.legW);
  if (megaArm !== 'L') { capsule(ctx, j.sL, j.eL, cfg.armW); capsule(ctx, j.eL, j.hL, cfg.armW); }

  drawTorso(ctx, j, cfg);

  // front leg
  capsule(ctx, j.hipR, j.kR, cfg.legW);
  capsule(ctx, j.kR, j.fR, cfg.legW);

  // front arm
  if (megaArm === 'L') { capsule(ctx, j.sL, j.eL, cfg.armW); capsule(ctx, j.eL, j.hL, cfg.armW); }
  else { capsule(ctx, j.sR, j.eR, cfg.armW); capsule(ctx, j.eR, j.hR, cfg.armW); }

  // head
  ctx.beginPath();
  ctx.arc(j.H.x, j.H.y, cfg.R, 0, Math.PI * 2);
  ctx.fill();

  // megaphone in the prop hand
  if (opts.mega) {
    const hand = megaArm === 'L' ? j.hL : j.hR;
    const elb = megaArm === 'L' ? j.eL : j.eR;
    drawMegaphone(ctx, hand, elb, j.H, opts.megaColor || '#FFD426');
  }

  // open book between the hands, tilted for a reading perspective
  if (opts.book) {
    const mx = (j.hR.x + j.hL.x) / 2, my = (j.hR.y + j.hL.y) / 2;
    drawBook(ctx, mx, my, color, -0.24);
  }

  // CTC's quiz card, held the same way the book is
  if (opts.card) {
    const mx = (j.hR.x + j.hL.x) / 2, my = (j.hR.y + j.hL.y) / 2;
    drawQuizCard(ctx, mx, my, color, opts.cardRot != null ? opts.cardRot : -0.24);
  }

  // smartphone cupped low in both hands (doomscrolling)
  if (opts.phone) {
    const mx = (j.hR.x + j.hL.x) / 2, my = (j.hR.y + j.hL.y) / 2;
    drawPhone(ctx, mx, my, color, opts.phoneRot != null ? opts.phoneRot : -0.16);
  }

  // Charlie Brown exhaustion swirl over the head
  if (opts.swirl) drawSwirl(ctx, j.H, cfg.R, color, opts.time || 0);

  // laptop resting on the knees
  if (opts.laptop) drawLaptop(ctx, j.kR, j.kL, color);

  // desk in FRONT of the figure (draw last so it sits over the legs)
  if (opts.desk) drawDesk(ctx, j, opts.deskColor || color, opts.screenColor);

  // walking cane in the right hand
  if (opts.cane) drawCane(ctx, j, color);
  if (opts.paddle) drawPaddleball(ctx, j, color, opts.time || 0);
}

// paddleball toy in the right hand: a flat paddle held face-up, with a small ball
// bouncing on a string above it — synced to the `paddleball` animation via opts.time.
function drawPaddleball(ctx: CanvasRenderingContext2D, j: Joints, color: string, time: number) {
  const h = j.hR, e = j.eR;
  const dx = h.x - e.x, dy = h.y - e.y, len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len;              // forearm direction (hand points this way)
  const cx = h.x + ux * 6, cy = h.y + uy * 6;      // paddle face just past the grip
  ctx.save();
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineCap = 'round';
  // short handle from the hand to the paddle face
  ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(h.x, h.y); ctx.lineTo(cx, cy); ctx.stroke();
  // paddle face — a flat horizontal oval (seen edge-on)
  ctx.beginPath(); ctx.ellipse(cx, cy - 2, 16, 4.5, 0, 0, Math.PI * 2); ctx.fill();
  // ball bounces above the paddle: d = 0 at each tap, up to A between taps
  const f = 1.5, A = 34;
  const d = A * Math.abs(Math.sin(time * f * Math.PI));
  const bx = cx, by = cy - 6 - d;
  ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(cx, cy - 6); ctx.lineTo(bx, by); ctx.stroke();   // string
  ctx.beginPath(); ctx.arc(bx, by, 5, 0, Math.PI * 2); ctx.fill();             // ball
  ctx.restore();
}

// rigid cane from the right hand, extended along the forearm direction: when the hand is low
// it reaches all the way to the ground; when raised it's a brandished stick.
function drawCane(ctx: CanvasRenderingContext2D, j: Joints, color: string) {
  const hR = j.hR;
  const groundY = Math.max(j.fR.y, j.fL.y) + 8;
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = 4.5; ctx.lineCap = 'round';
  if (hR.y < j.N.y - 4) {
    // hand raised → brandished stick, rigid along the forearm
    const eR = j.eR, dx = hR.x - eR.x, dy = hR.y - eR.y, len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len, L = 90;
    ctx.beginPath(); ctx.moveTo(hR.x, hR.y); ctx.lineTo(hR.x + ux * L, hR.y + uy * L); ctx.stroke();
    const px = -uy, py = ux;
    ctx.beginPath();
    ctx.moveTo(hR.x - ux * 6, hR.y - uy * 6);
    ctx.quadraticCurveTo(hR.x - ux * 12, hR.y - uy * 12, hR.x - ux * 10 + px * 9, hR.y - uy * 10 + py * 9);
    ctx.stroke();
  } else {
    // walking → cane straight down, PERPENDICULAR to the ground, planted at the foot line
    ctx.beginPath(); ctx.moveTo(hR.x, hR.y); ctx.lineTo(hR.x, groundY); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(hR.x, hR.y); ctx.quadraticCurveTo(hR.x - 3, hR.y - 10, hR.x - 11, hR.y - 8); ctx.stroke();  // crook handle
  }
  ctx.restore();
}

// office swivel chair, seen in profile behind a seated figure facing right.
// backrest rises up-and-back (left); a post drops to a splayed castor base.
function drawChair(ctx: CanvasRenderingContext2D, j: Joints, color: string) {
  const P = j.P;                       // pelvis = seat center
  ctx.save();
  ctx.strokeStyle = color; ctx.fillStyle = color;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // seat pad
  ctx.lineWidth = 7;
  ctx.beginPath(); ctx.moveTo(P.x - 26, P.y + 12); ctx.lineTo(P.x + 20, P.y + 12); ctx.stroke();
  // backrest, reclined slightly back
  ctx.lineWidth = 9;
  ctx.beginPath(); ctx.moveTo(P.x - 22, P.y + 10); ctx.lineTo(P.x - 34, P.y - 52); ctx.stroke();
  // gas post
  ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(P.x - 3, P.y + 14); ctx.lineTo(P.x - 3, P.y + 46); ctx.stroke();
  // splayed base legs to castors
  ctx.lineWidth = 5;
  const base = { x: P.x - 3, y: P.y + 46 };
  const cast: Array<[number, number]> = [[-34, 60], [2, 64], [34, 60]];
  cast.forEach(function (c) {
    ctx.beginPath(); ctx.moveTo(base.x, base.y); ctx.lineTo(P.x + c[0], P.y + c[1]); ctx.stroke();
    ctx.beginPath(); ctx.arc(P.x + c[0], P.y + c[1], 4, 0, Math.PI * 2); ctx.fill();
  });
  ctx.restore();
}

// a desk in front of a seated figure (facing right): tabletop over the knees,
// a front leg to the floor, and a monitor angled back toward the figure.
function drawDesk(ctx: CanvasRenderingContext2D, j: Joints, color: string, screenColor?: string) {
  const kneeY = Math.min(j.kR.y, j.kL.y);
  const topY = kneeY - 10;
  const x0 = 40, x1 = 98;               // desk spans out in front of the figure
  const groundY = Math.max(j.fR.y, j.fL.y) + 6;
  ctx.save();
  ctx.strokeStyle = color; ctx.fillStyle = color;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // tabletop
  ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(x0, topY); ctx.lineTo(x1, topY); ctx.stroke();
  // front leg
  ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(x1 - 4, topY + 3); ctx.lineTo(x1 - 4, groundY); ctx.stroke();
  // monitor: stand + screen tilted back toward the figure
  const mx = x0 + 30;
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(mx, topY); ctx.lineTo(mx, topY - 14); ctx.stroke();
  ctx.save();
  ctx.translate(mx, topY - 14);
  ctx.rotate(-0.18);
  ctx.fillStyle = screenColor || '#FFFFFF';
  ctx.strokeStyle = color; ctx.lineWidth = 3.5;
  roundRectPath(ctx, -6, -30, 34, 30, 4);
  ctx.fill(); ctx.stroke();
  ctx.restore();
  ctx.restore();
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawSwirl(ctx: CanvasRenderingContext2D, H: Point, R: number, color: string, t: number) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 3.2;
  ctx.lineCap = 'round';
  const cx = H.x, cy = H.y - R - 24;
  const rot = t * 1.1;
  ctx.beginPath();
  for (let a = 0; a <= Math.PI * 4.6; a += 0.14) {
    const r = 3 + a * 1.5;
    const x = cx + Math.cos(a + rot) * r;
    const y = cy + Math.sin(a + rot) * r * 0.55;   // squashed scribble-spiral
    if (a === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.restore();
}

function drawLaptop(ctx: CanvasRenderingContext2D, kR: Point, kL: Point, color: string) {
  const x = (kR.x + kL.x) / 2, y = Math.min(kR.y, kL.y) - 6;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  // base on the knees
  ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(x - 18, y); ctx.lineTo(x + 24, y); ctx.stroke();
  // screen tilted away from the figure
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(x + 22, y); ctx.lineTo(x + 32, y - 38); ctx.stroke();
  ctx.restore();
}

function drawBook(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, rot: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot || 0);
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = color;
  ctx.lineWidth = 3.5;
  ctx.lineJoin = 'round';
  // near page slightly larger — cheap perspective
  ctx.beginPath();
  ctx.moveTo(0, -2); ctx.lineTo(-21, -12); ctx.lineTo(-21, 4); ctx.lineTo(0, 13); ctx.closePath();
  ctx.moveTo(0, -2); ctx.lineTo(27, -9); ctx.lineTo(27, 8); ctx.lineTo(0, 13); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.restore();
}

function drawPhone(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, rot: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot || 0);
  // slim portrait body — coloured bezel (50% larger, held upright)
  ctx.fillStyle = color;
  ctx.fillRect(-11.25, -17.25, 22.5, 34.5);
  // lit screen
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(-8.25, -13.5, 16.5, 27);
  ctx.restore();
}

function drawMegaphone(ctx: CanvasRenderingContext2D, hand: Point, _elbow: Point, head: Point, color: string) {
  // orient the cone from the hand toward the mouth (near head)
  const dx = head.x - hand.x, dy = (head.y + 6) - hand.y;
  const ang = Math.atan2(dy, dx);
  ctx.save();
  ctx.translate(hand.x, hand.y);
  ctx.rotate(ang);
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineJoin = 'round';
  // handle stub
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(-6, -7, 14, 14, 4); else ctx.rect(-6, -7, 14, 14);
  ctx.fill();
  // cone opening away from mouth (bell points out, mouth end small)
  const L = 40, r0 = 7, r1 = 22;
  ctx.beginPath();
  ctx.moveTo(6, -r0);
  ctx.lineTo(6 + L, -r1);
  ctx.lineTo(6 + L, r1);
  ctx.lineTo(6, r0);
  ctx.closePath();
  ctx.lineWidth = 3; ctx.stroke(); ctx.fill();
  ctx.restore();
}

/** A small open card held between the hands — CTC's stand-in for the rig's own book prop. */
export function drawQuizCard(ctx: CanvasRenderingContext2D, x: number, y: number, _color: string, rot: number) {
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

/**
 * A puff of smoke: soft grey blobs scattered around (x, y), growing with `spread` and fading
 * with `alpha`. One function serves both the slow build-up under a doomed Bobit and the burst
 * when he goes — only spread and alpha differ. The scatter is derived from `seed` rather than
 * Math.random so a given frame is reproducible in tests; `t` (seconds) drifts the puffs so the
 * cloud churns instead of sitting still. Grey #8A8F98 reads against both themes' grounds.
 */
export function drawSmoke(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  spread: number, alpha: number,
  seed: number, t: number,
) {
  if (!(alpha > 0) || !(spread > 0)) return;
  const N = 9;
  ctx.save();
  ctx.fillStyle = '#8A8F98';
  for (let i = 0; i < N; i++) {
    const ang = ((seed * 37 + i * 61) % 360) * D;          // deterministic angle
    const rad = 0.35 + (((seed * 13 + i * 29) % 100) / 100) * 0.65;
    const drift = Math.sin(t * (0.7 + i * 0.13) + i) * spread * 0.14;
    const px = x + Math.cos(ang) * spread * rad + drift;
    const py = y - Math.abs(Math.sin(ang)) * spread * rad * 0.85 - spread * 0.2;
    const pr = spread * (0.26 + rad * 0.3);
    ctx.globalAlpha = Math.min(1, alpha) * (0.4 + rad * 0.45);
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * The brand-derived figure palette — 6 tones, tuned separately per theme for legibility
 * (0 teal · 1 coral · 2 gold · 3 green · 4 purple · 5 orange).
 *
 * NOTE: CTC-only. Moves to rigExtras.ts in the next commit; kept here for now so the
 * existing components keep compiling mid-port.
 */
export const FIG_COLORS = {
  light: ['#007D99', '#FF5740', '#B8860B', '#2E9E5B', '#7A4FD0', '#E0641C'],
  dark: ['#1DA8C6', '#FF6B52', '#FFD740', '#43D07E', '#B49BFF', '#FF9A4D'],
};

export function figColor(i: number, darkMode: boolean): string {
  const pal = darkMode ? FIG_COLORS.dark : FIG_COLORS.light;
  return pal[i % pal.length];
}

const TROPHY_GOLD = '#FFD426';
const TROPHY_TEAL_DARK = '#59B0C4';
const TROPHY_TEAL_LIGHT = '#AAE7F5';


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
