import { ANIMATIONS, clonePose, wave, REST, drawQuizCard, roundRectPath } from './leremyRig';
import type { Animation } from './leremyRig';

export { drawQuizCard };

/**
 * CTC-only additions to the Leremy rig.
 *
 * `leremyRig.ts` is a faithful mirror of empowered.vote's `leremy-rig.js` so re-syncing it
 * stays a clean overwrite. Anything this app invents lives here instead: four extra poses,
 * the trophy prop, and the brand-derived figure palette.
 *
 * Consumers should import ALL_ANIMATIONS from this file rather than ANIMATIONS from the rig
 * -- the rig alone does not know about cheer, dance, offer or ponder.
 */

/**
 * The brand-derived figure palette -- 6 tones, tuned separately per theme for legibility
 * (0 teal | 1 coral | 2 gold | 3 green | 4 purple | 5 orange).
 */
export const FIG_COLORS = {
  light: ['#007D99', '#FF5740', '#B8860B', '#2E9E5B', '#7A4FD0', '#E0641C'],
  dark: ['#1DA8C6', '#FF6B52', '#FFD740', '#43D07E', '#B49BFF', '#FF9A4D'],
};

export function figColor(i: number, darkMode: boolean): string {
  const pal = darkMode ? FIG_COLORS.dark : FIG_COLORS.light;
  return pal[i % pal.length];
}

/** Poses this app added to the rig. Built on the ported ones where it makes sense. */
export const EXTRA_ANIMATIONS: Record<string, Animation> = {
  cheer: {
    label: "Cheer", mood: "yes! got it!",
    frame(t: number) {
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
    label: "Dance", mood: "five for five, baby",
    frame(t: number) {
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
  offer: {
    label: "Offer", mood: "pick a collection, any collection",
    frame(t: number) {
      const p = ANIMATIONS.present.frame(t);
      const s = wave(t, 0.7);
      p.armRU = 78 + s * 3; p.armRF = 92 + s * 3;
      p.headTilt = -3;
      return p;
    },
  },
  ponder: {
    label: "Ponder", mood: "hmm… is it the mayor or the council?",
    frame(t: number) {
      const p = ANIMATIONS.present.frame(t);
      const s = wave(t, 0.45);
      p.armRU = 34; p.armRF = -162 + s * 3;
      p.headTilt = 11 + s * 2;
      p.hunch = p.hunch - 2;
      return p;
    },
  },
};

/**
 * The full catalogue: the 41 ported poses plus the walk alias, plus CTC's four.
 * Every consumer wants this, not the rig's bare ANIMATIONS.
 */
export const ALL_ANIMATIONS: Record<string, Animation> = { ...ANIMATIONS, ...EXTRA_ANIMATIONS };

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
