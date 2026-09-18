import type { Surface } from './fieldGeometry';

/**
 * Scene props: things that are not figures but stand on the same floor.
 *
 * Drawn by BobitField in the same pass as the figures so a bobit can walk in front of one.
 * Geometry is in the same rig units figures use, so a prop and a figure at the same `scale`
 * agree about how big the world is.
 */

/**
 * Barrel length in rig units, from the pivot. The muzzle is at its far end.
 *
 * SIZED BY SCREENSHOT, 2026-09-14. The first pass used 96/17/26, which is roughly a person's
 * arm span -- on the band, against a 42px bobit, it rendered as a dark speck you had to look
 * for. A cannon that fires a person should be bigger than the person, and the joke needs to be
 * legible at a glance, so it is about 1.5x a figure now.
 */
const BARREL_LEN = 150;
const BARREL_R = 26;
const WHEEL_R = 40;

/**
 * Everything below is sized against ONE constraint: the player sees this at `scale` 0.2, where
 * the whole cannon is about 38px wide and the wheel is 16px across. A detail thinner than ~8
 * rig units is under a pixel and a half there and may as well not exist -- which is what
 * happened to the first pass. Nothing here is smaller than that.
 */
const MUZZLE_LEN = 18;          // the flare at the mouth
const MUZZLE_R = BARREL_R * 1.32;
const BAND_W = 10;              // reinforcing rings
const TRAIL_W = 15;             // the beam from the axle back to the ground
const HUB_R = 10;
const SPOKE_W = 7;

/**
 * A detail colour that contrasts with the barrel, whichever theme is painting it.
 *
 * This was a hardcoded '#AAB2BF'. The field passes a light body in dark mode ('#9AA6B8'), so
 * the accent and the body were within a few percent of each other and every detail vanished --
 * a real part of why the prop read as a featureless tube rather than as a cannon.
 */
export function accentFor(body: string): string {
  const LIGHT = '#C9D2E0';
  const DARK = '#2B3440';
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(body.trim());
  if (!m) return LIGHT;
  const h = m[1].length === 3 ? m[1].split('').map(c => c + c).join('') : m[1];
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  // Rough perceptual luminance; exactness does not matter, only which side of the middle.
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.5 ? DARK : LIGHT;
}

/**
 * Where the barrel's mouth is, in field px.
 *
 * The cannon fires FROM here, so a flight has to start here -- otherwise the bobit appears out
 * of thin air beside the muzzle, which is precisely the thing the scene is trying not to do.
 */
export function cannonMuzzle(
  x: number, groundY: number, scale: number, angle: number, flip = false,
) {
  const a = (angle * Math.PI) / 180;
  const dir = flip ? -1 : 1;
  const pivotY = groundY - WHEEL_R * scale;
  return {
    x: x + dir * Math.cos(a) * BARREL_LEN * scale,
    y: pivotY + Math.sin(a) * BARREL_LEN * scale,
  };
}

/**
 * A stubby cartoon cannon: wheel and trail on the ground, barrel on the axle.
 *
 * `angle` is degrees from horizontal, NEGATIVE being nose-up, which matches `cannonMuzzle` --
 * the two must agree or the shot leaves from somewhere other than the barrel.
 *
 * The first version was a filled disc with a tapered tube on it, in one flat colour, and it
 * read as a magnifying glass: the wheel and the barrel merged into a single blob because they
 * were the same tone and touched. What makes the shape legible as a cannon, in rough order of
 * how much each one earns at 38px:
 *
 *   1. The WHEEL is a ring with spokes, not a disc -- background shows through it, so the wheel
 *      separates from the barrel instead of merging with it.
 *   2. A TRAIL running back to the ground. After the barrel this is the most cannon-defining
 *      line there is, and its absence was why the thing appeared to float.
 *   3. A FLARED muzzle and a swelled breech, so the barrel has a direction. A plain taper does
 *      not say which end fires.
 *   4. A cascabel knob and two reinforcing bands: cheap, and they read as "cannon" even when
 *      they are two pixels each.
 */
export function drawCannon(
  ctx: CanvasRenderingContext2D,
  x: number, groundY: number, scale: number, angle: number, flip = false,
  color = '#3F4854',
) {
  const a = (angle * Math.PI) / 180;
  const dir = flip ? -1 : 1;
  const accent = accentFor(color);

  ctx.save();
  ctx.translate(x, groundY);
  ctx.scale(dir * scale, scale);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // ── trail: axle back to the ground, drawn first so the wheel sits over its end ──────────
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-6, -WHEEL_R - TRAIL_W * 0.5);
  ctx.lineTo(-6, -WHEEL_R + TRAIL_W * 0.5);
  ctx.lineTo(-78, -2);
  ctx.lineTo(-78, -2 - TRAIL_W);
  ctx.closePath();
  ctx.fill();
  // A foot, so the trail rests on the floor rather than stabbing through it.
  ctx.beginPath();
  ctx.ellipse(-76, -4, 13, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  // ── barrel, pivoted at the axle ────────────────────────────────────────────────────────
  ctx.save();
  ctx.translate(0, -WHEEL_R);
  ctx.rotate(a);

  // Breech swell -> slight taper -> flare. Drawn as one path so the silhouette is unbroken.
  const taperEnd = BARREL_LEN - MUZZLE_LEN;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-20, -BARREL_R);
  ctx.lineTo(taperEnd, -BARREL_R * 0.78);
  ctx.lineTo(taperEnd, -MUZZLE_R);
  ctx.lineTo(BARREL_LEN, -MUZZLE_R);
  ctx.lineTo(BARREL_LEN, MUZZLE_R);
  ctx.lineTo(taperEnd, MUZZLE_R);
  ctx.lineTo(taperEnd, BARREL_R * 0.78);
  ctx.lineTo(-20, BARREL_R);
  ctx.closePath();
  ctx.fill();

  // Cascabel: the knob at the very back of a real gun. Reads as "this end does not fire".
  ctx.beginPath();
  ctx.arc(-26, 0, 11, 0, Math.PI * 2);
  ctx.fill();

  // Two reinforcing bands.
  ctx.fillStyle = accent;
  for (const bx of [16, 74]) {
    const halfH = BARREL_R * (bx < 40 ? 0.98 : 0.9);
    ctx.fillRect(bx, -halfH, BAND_W, halfH * 2);
  }

  // The bore: an accent ellipse INSIDE the flare, so the mouth reads as an opening rather than
  // as a highlight sitting on the end of a tube.
  ctx.beginPath();
  ctx.ellipse(BARREL_LEN - 2, 0, 5, MUZZLE_R * 0.66, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  // ── wheel: a RING, so the background separates it from the barrel ──────────────────────
  ctx.strokeStyle = color;
  ctx.lineWidth = 13;
  ctx.beginPath();
  ctx.arc(0, -WHEEL_R, WHEEL_R - 6, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = color;
  ctx.lineWidth = SPOKE_W;
  for (let i = 0; i < 6; i++) {
    const t = (i / 6) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(0, -WHEEL_R);
    ctx.lineTo(Math.cos(t) * (WHEEL_R - 8), -WHEEL_R + Math.sin(t) * (WHEEL_R - 8));
    ctx.stroke();
  }

  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(0, -WHEEL_R, HUB_R, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}


/**
 * The tree, in rig units, sized to a 96px band and nothing larger.
 *
 * 240 units is a standing bobit (~48px at scale 0.2) and the band is 480 units tall, so the
 * whole tree has to live in what is left after the crowd. That is why there is ONE branch: a
 * second ledge above this one would put its occupant's head through the top of the canvas.
 * See the spec's 2026-09-15 addendum.
 *
 *   480 ---- top of the band
 *   430 ---- canopy top
 *   300 ---- trunk top
 *   250 ---- the branch            <- a seated bobit reaches ~400 from here
 *   240 ---- a standing bobit's head, for scale
 *     0 ---- the floor line
 */
const TREE_TRUNK_W = 34;
export const TREE_TRUNK_H = 300;
/** Height of the branch above the ground line, in rig units. */
export const TREE_LEDGE_UP = 250;
/** Half the tree's total footprint, for the trunk's own placement. */
export const TREE_HALF_W = 90;
const BRANCH_LEN = 78;
const BRANCH_W = 16;
const CANOPY_R = 88;

/**
 * Total height of the MARGIN tree's rig, floor line to top of canopy.
 *
 * Distinct from `TREE_TRUNK_H` (300) above, which is frozen: that tree still ships as the
 * fallback under `MIN_TREE_MARGIN` and its constants must not move.
 */
export const MARGIN_TREE_RIG_H = 1000;

/** Half the margin tree's total ink footprint, in rig units. Its placement divides by this. */
export const MARGIN_TREE_HALF_W = 200;

/**
 * Where a bobit can sit. The first and only consumer of `Surface`, which has waited in
 * fieldGeometry.ts since Stage 1 for exactly this.
 *
 * The branch reaches LEFT out of the trunk, because the tree stands on the right border and a
 * branch reaching right would hang off the edge of the viewport.
 */
export function treeSurfaces(x: number, groundY: number, scale: number): Surface[] {
  return [{
    id: 'tree:branch',
    left: x - (TREE_TRUNK_W * 0.5 + BRANCH_LEN) * scale,
    right: x - TREE_TRUNK_W * 0.25 * scale,
    y: groundY - TREE_LEDGE_UP * scale,
  }];
}

/**
 * The tree.
 *
 * `grow` is 0-1. At 0 nothing is drawn at all, so a caller can animate it up out of the floor
 * with no special case; at 1 it is full height. Growth scales the HEIGHT only -- a tree that
 * also grew sideways read as a balloon inflating rather than as something sprouting.
 */
export function drawTree(
  ctx: CanvasRenderingContext2D,
  x: number, groundY: number, scale: number, grow = 1, color = '#3F4854',
) {
  const g = Math.max(0, Math.min(1, grow));
  if (g <= 0) return;
  const accent = accentFor(color);

  ctx.save();
  ctx.translate(x, groundY);
  ctx.scale(scale, scale * g);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // Canopy first, so the trunk and the branch read on top of it.
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(-10, -TREE_TRUNK_H - 40, CANOPY_R, CANOPY_R * 0.78, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(-70, -TREE_TRUNK_H + 6, CANOPY_R * 0.56, CANOPY_R * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(52, -TREE_TRUNK_H - 6, CANOPY_R * 0.5, CANOPY_R * 0.46, 0, 0, Math.PI * 2);
  ctx.fill();

  // Trunk: wider at the base, so it sits on the floor rather than balancing on it.
  ctx.beginPath();
  ctx.moveTo(-TREE_TRUNK_W * 0.8, 0);
  ctx.lineTo(-TREE_TRUNK_W * 0.42, -TREE_TRUNK_H);
  ctx.lineTo(TREE_TRUNK_W * 0.42, -TREE_TRUNK_H);
  ctx.lineTo(TREE_TRUNK_W * 0.8, 0);
  ctx.closePath();
  ctx.fill();

  // The branch `treeSurfaces` describes. A bobit sits ON this, so its top edge and the
  // Surface's `y` are the same line -- change one and you must change the other.
  ctx.fillRect(
    -(TREE_TRUNK_W * 0.5 + BRANCH_LEN), -TREE_LEDGE_UP - BRANCH_W,
    BRANCH_LEN + TREE_TRUNK_W * 0.5, BRANCH_W,
  );

  // Two accent notches on the trunk, the tree's equivalent of the cannon's bands: cheap, and
  // they stop it reading as a flat post at 60px.
  ctx.fillStyle = accent;
  ctx.fillRect(-TREE_TRUNK_W * 0.34, -TREE_TRUNK_H * 0.62, TREE_TRUNK_W * 0.68, 10);
  ctx.fillRect(-TREE_TRUNK_W * 0.3, -TREE_TRUNK_H * 0.34, TREE_TRUNK_W * 0.6, 9);

  ctx.restore();
}

/**
 * The MARGIN tree, in rig units, sized to the empty strip beside the question column.
 *
 * Separate from the in-band tree above, which is NOT re-authored: it still ships as the
 * fallback under `MIN_TREE_MARGIN` and its constants must not move. Two renderers is the
 * accepted cost (spec, section 2).
 *
 * The 96px band forced ONE branch -- a second ledge would have put its occupant's head through
 * the top of the canvas. That constraint is gone here, so the spec's original 2-3 branches come
 * back as three.
 *
 *  1000 ---- MARGIN_TREE_RIG_H, the budget
 *   967 ---- top of the canopy, with a little air under the ceiling
 *   760 ---- trunk top
 *   690 ---- branch 3   (reaches left)
 *   470 ---- branch 2   (reaches right)
 *   250 ---- branch 1   (reaches left, toward the card -- the closest ink to it)
 *   240 ---- a standing bobit's head, for scale. He is drawn at BAND scale, ~4.3x smaller
 *            than this rig, so he reads as a climber in a big tree rather than a giant.
 *     0 ---- the floor line, shared with the band
 *
 * Every number below is constrained by two budgets, and `marginTree.test.ts` holds both: the
 * ink box must fit inside +/- MARGIN_TREE_HALF_W horizontally, and inside MARGIN_TREE_RIG_H
 * vertically. Widening a branch or a canopy lobe without checking the other side of the tree
 * is how a canopy comes to be clipped flat against an edge.
 */
const MARGIN_TRUNK_W = 74;
const MARGIN_TRUNK_H = 760;
/** Branch heights above the floor, lowest first. Indices line up with `marginTreeSurfaces`. */
export const MARGIN_BRANCH_UP = [250, 470, 690];
/** Reach of each branch out from the trunk's surface, same order. */
const MARGIN_BRANCH_LEN = [160, 145, 115];
/** Which way each branch reaches. -1 is left, toward the question column. */
const MARGIN_BRANCH_DIR = [-1, 1, -1];
const MARGIN_BRANCH_W = 26;

/**
 * The canopy, as [cx, cy, r]. `cy` is measured up from the floor; the ellipse is r wide and
 * 0.78r tall, so a lobe's top is cy + 0.78r and that is what the height budget sees.
 */
const MARGIN_CANOPY: ReadonlyArray<readonly [number, number, number]> = [
  [-14, MARGIN_TRUNK_H + 70, 175],
  [-100, MARGIN_TRUNK_H + 5, 95],
  [95, MARGIN_TRUNK_H + 20, 92],
];

/** Leftmost ink the rig puts down, in rig units. The longest left branch, or the canopy. */
const MARGIN_INK_LEFT = Math.min(
  -(MARGIN_TRUNK_W * 0.8),
  ...MARGIN_BRANCH_UP.map((_, i) => (
    MARGIN_BRANCH_DIR[i] < 0 ? -(MARGIN_TRUNK_W * 0.5 + MARGIN_BRANCH_LEN[i]) : 0
  )),
  ...MARGIN_CANOPY.map(([cx, , r]) => cx - r),
);

/** Rightmost ink the rig puts down, in rig units. */
const MARGIN_INK_RIGHT = Math.max(
  MARGIN_TRUNK_W * 0.8,
  ...MARGIN_BRANCH_UP.map((_, i) => (
    MARGIN_BRANCH_DIR[i] > 0 ? MARGIN_TRUNK_W * 0.5 + MARGIN_BRANCH_LEN[i] : 0
  )),
  ...MARGIN_CANOPY.map(([cx, , r]) => cx + r),
);

/** Highest ink the rig puts down, in rig units above the floor. */
const MARGIN_INK_TOP = Math.max(
  MARGIN_TRUNK_H,
  ...MARGIN_CANOPY.map(([, cy, r]) => cy + r * 0.78),
);

/**
 * The trunk's x inside its own canvas.
 *
 * Placed so the RIGHTMOST ink is flush with the canvas's right edge, which is the container's
 * edge. Combined with `treeScale` taking the min of the height and width fits -- and with the
 * ink box being narrower than the nominal footprint it divides by -- that is what makes bound 1
 * hold by construction rather than by care.
 */
export function marginTreeX(canvasW: number, scale: number): number {
  return canvasW - MARGIN_INK_RIGHT * scale;
}

/** The leftmost pixel the tree puts ink on, in canvas coordinates. The bound-1 quantity. */
export function marginTreeLeftmost(canvasW: number, scale: number): number {
  return marginTreeX(canvasW, scale) + MARGIN_INK_LEFT * scale;
}

/** The rightmost pixel the tree puts ink on, in canvas coordinates. */
export function marginTreeRightmost(canvasW: number, scale: number): number {
  return marginTreeX(canvasW, scale) + MARGIN_INK_RIGHT * scale;
}

/** How tall the tree actually draws, in px above its floor line. */
export function marginTreeTop(scale: number): number {
  return MARGIN_INK_TOP * scale;
}

/**
 * The three branches a bobit can sit on, lowest first.
 *
 * Lowest first matters: `assignPerch` claims the first unclaimed surface, so the tree fills
 * from the bottom and a lone climber is never parked in the canopy.
 */
export function marginTreeSurfaces(x: number, groundY: number, scale: number): Surface[] {
  return MARGIN_BRANCH_UP.map((up, i) => {
    const dir = MARGIN_BRANCH_DIR[i];
    const tip = x + dir * (MARGIN_TRUNK_W * 0.5 + MARGIN_BRANCH_LEN[i]) * scale;
    const root = x + dir * MARGIN_TRUNK_W * 0.2 * scale;
    return {
      id: `margin-tree:branch${i}`,
      left: Math.min(tip, root),
      right: Math.max(tip, root),
      y: groundY - up * scale,
      // The trunk-side end. A branch is climbed at the trunk, not at its midpoint.
      rootX: root,
    };
  });
}

/**
 * The margin tree.
 *
 * `grow` is 0-1 exactly as `drawTree`'s is, and scales the HEIGHT only -- a tree that also grew
 * sideways read as a balloon inflating rather than as something sprouting.
 */
export function drawMarginTree(
  ctx: CanvasRenderingContext2D,
  x: number, groundY: number, scale: number, grow = 1, color = '#3F4854',
) {
  const g = Math.max(0, Math.min(1, grow));
  if (g <= 0) return;
  const accent = accentFor(color);

  ctx.save();
  ctx.translate(x, groundY);
  ctx.scale(scale, scale * g);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // Canopy first, so the trunk and the branches read on top of it.
  ctx.fillStyle = color;
  for (const [cx, cy, r] of MARGIN_CANOPY) {
    ctx.beginPath();
    ctx.ellipse(cx, -cy, r, r * 0.78, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Trunk: wider at the base, so it sits on the floor rather than balancing on it.
  ctx.beginPath();
  ctx.moveTo(-MARGIN_TRUNK_W * 0.8, 0);
  ctx.lineTo(-MARGIN_TRUNK_W * 0.4, -MARGIN_TRUNK_H);
  ctx.lineTo(MARGIN_TRUNK_W * 0.4, -MARGIN_TRUNK_H);
  ctx.lineTo(MARGIN_TRUNK_W * 0.8, 0);
  ctx.closePath();
  ctx.fill();

  // The three branches `marginTreeSurfaces` describes. A bobit sits ON these, so each one's
  // TOP edge and its Surface's `y` are the same line -- change one and you must change the
  // other, or he sits in mid-air or inside the wood.
  MARGIN_BRANCH_UP.forEach((up, i) => {
    const dir = MARGIN_BRANCH_DIR[i];
    const len = MARGIN_BRANCH_LEN[i] + MARGIN_TRUNK_W * 0.5;
    const x0 = dir < 0 ? -len : 0;
    ctx.fillRect(x0, -up - MARGIN_BRANCH_W, len, MARGIN_BRANCH_W);
  });

  // Accent notches, the tree's equivalent of the cannon's bands. Derived from the body colour,
  // never hardcoded: the field passes a LIGHT body in dark mode and a DARK one in light, and a
  // fixed light detail was invisible in dark mode on the cannon for exactly this reason.
  ctx.fillStyle = accent;
  for (const up of [MARGIN_TRUNK_H * 0.28, MARGIN_TRUNK_H * 0.58]) {
    ctx.fillRect(-MARGIN_TRUNK_W * 0.3, -up, MARGIN_TRUNK_W * 0.6, 22);
  }

  ctx.restore();
}
