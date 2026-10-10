/**
 * The tableau, as data.
 *
 * TWENTY-FIVE LINES, six structures, two stacks. Rig units: x runs -200..200 from the stack's
 * own centre line, y runs 0..1000 UP from the floor the crowd walks on. Both margins use the
 * same rig; the left stack is the right stack's mirror in placement, not in authoring.
 *
 * ENDPOINT 1 IS THE JOINT. Every line is lashed to its anchor at (x1, y1), and the build
 * sequence pivots the line about that point when it is raised. Authoring a line the other way
 * round makes it rise from the wrong end, which is the sort of thing that looks deliberate in
 * a diff and absurd on screen. `blueprint.test.ts` holds it: endpoint 1 must physically touch
 * the anchor.
 *
 * ANCHOR 0 MEANS THE GROUND. Otherwise an anchor is a lower line number -- never a higher one,
 * because nothing may be lashed to something that is not up yet.
 */

export type LineKind = 'stick' | 'string';
export type StackSide = 'left' | 'right';

export interface TableauLine {
  /** 1-based position in the build order. Also the line's identity. */
  n: number;
  kind: LineKind;
  side: StackSide;
  /** Which structure this belongs to, for grouping and for test messages. */
  structure: string;
  /** The joint. Lies on the anchor. The raise pivots about this point. */
  x1: number;
  y1: number;
  /** The free end. */
  x2: number;
  y2: number;
  /** Thickness at endpoint 1, in rig units. */
  w: number;
  /** Thickness at endpoint 2. Defaults to `w`; set it lower to taper. */
  w2?: number;
  /** Line number this is lashed to, or 0 for the ground. */
  anchor: number;
  /** A bobit may sit on this line's top edge. Level sticks only. */
  perch?: boolean;
}

export interface TableauStructure {
  key: string;
  label: string;
  side: StackSide;
  /** Inclusive line range. */
  from: number;
  to: number;
}

export const TOTAL_LINES = 25;

export const STRUCTURES: readonly TableauStructure[] = [
  { key: 'cabin',     label: 'Cabin',         side: 'left',  from: 1,  to: 4 },
  { key: 'tree',      label: 'Tree',          side: 'right', from: 5,  to: 9 },
  { key: 'scaffold',  label: 'Scaffold',      side: 'left',  from: 10, to: 13 },
  { key: 'treehouse', label: 'Treehouse',     side: 'right', from: 14, to: 17 },
  { key: 'lookout',   label: 'Lookout',       side: 'left',  from: 18, to: 21 },
  { key: 'mast',      label: 'Mast and flag', side: 'right', from: 22, to: 25 },
];

export const BLUEPRINT: readonly TableauLine[] = [
  // ── ① CABIN, on the ground. A post-and-rafter frame with a peaked roof. ───────────────
  { n: 1,  kind: 'stick', side: 'left',  structure: 'cabin', anchor: 0,
    x1: -80, y1: 0,   x2: -80, y2: 150, w: 16 },
  { n: 2,  kind: 'stick', side: 'left',  structure: 'cabin', anchor: 0,
    x1:  80, y1: 0,   x2:  80, y2: 150, w: 16 },
  { n: 3,  kind: 'stick', side: 'left',  structure: 'cabin', anchor: 1,
    x1: -80, y1: 150, x2:   0, y2: 225, w: 14 },
  { n: 4,  kind: 'stick', side: 'left',  structure: 'cabin', anchor: 2,
    x1:  80, y1: 150, x2:   0, y2: 225, w: 14 },

  // ── ② TREE, on the ground. Branch heights are the shipped margin tree's, verbatim. ────
  { n: 5,  kind: 'stick', side: 'right', structure: 'tree', anchor: 0,
    x1: 0, y1: 0,   x2: 0,    y2: 760, w: 44, w2: 26 },
  { n: 6,  kind: 'stick', side: 'right', structure: 'tree', anchor: 5, perch: true,
    x1: 0, y1: 230, x2: -158, y2: 230, w: 17, w2: 9 },
  { n: 7,  kind: 'stick', side: 'right', structure: 'tree', anchor: 5, perch: true,
    x1: 0, y1: 430, x2:  142, y2: 430, w: 17, w2: 9 },
  { n: 8,  kind: 'stick', side: 'right', structure: 'tree', anchor: 5, perch: true,
    x1: 0, y1: 640, x2: -112, y2: 640, w: 17, w2: 9 },
  // The green curl. Its endpoints are the crown and the nominal top of the loops; the loops
  // themselves come from `curl.ts`, because a scribble is not a segment.
  { n: 9,  kind: 'string', side: 'right', structure: 'tree', anchor: 5,
    x1: 0, y1: 760, x2: 0, y2: 940, w: 11 },

  // ── ③ SCAFFOLD, straddling the cabin roof. Feet sit ON the rafters. ───────────────────
  { n: 10, kind: 'stick', side: 'left', structure: 'scaffold', anchor: 3,
    x1: -50, y1: 178, x2: -50, y2: 560, w: 14 },
  { n: 11, kind: 'stick', side: 'left', structure: 'scaffold', anchor: 4,
    x1:  50, y1: 178, x2:  50, y2: 560, w: 14 },
  { n: 12, kind: 'stick', side: 'left', structure: 'scaffold', anchor: 10, perch: true,
    x1: -50, y1: 370, x2:  50, y2: 370, w: 13 },
  { n: 13, kind: 'stick', side: 'left', structure: 'scaffold', anchor: 10, perch: true,
    x1: -50, y1: 540, x2:  50, y2: 540, w: 13 },

  // ── ④ TREEHOUSE, lashed into the tree's lowest branch, reaching away from the card. ───
  { n: 14, kind: 'stick', side: 'right', structure: 'treehouse', anchor: 6, perch: true,
    x1: -10,  y1: 245, x2: -160, y2: 245, w: 18 },
  { n: 15, kind: 'stick', side: 'right', structure: 'treehouse', anchor: 14,
    x1: -150, y1: 245, x2: -150, y2: 330, w: 12 },
  { n: 16, kind: 'stick', side: 'right', structure: 'treehouse', anchor: 14,
    x1: -25,  y1: 245, x2: -25,  y2: 330, w: 12 },
  { n: 17, kind: 'stick', side: 'right', structure: 'treehouse', anchor: 15, perch: true,
    x1: -150, y1: 330, x2: -25,  y2: 330, w: 12 },

  // ── ⑤ LOOKOUT, a hut on the scaffold's top brace. Echoes the cabin on purpose. ────────
  { n: 18, kind: 'stick', side: 'left', structure: 'lookout', anchor: 13,
    x1: -50, y1: 540, x2: -50, y2: 650, w: 13 },
  { n: 19, kind: 'stick', side: 'left', structure: 'lookout', anchor: 13,
    x1:  50, y1: 540, x2:  50, y2: 650, w: 13 },
  { n: 20, kind: 'stick', side: 'left', structure: 'lookout', anchor: 18,
    x1: -50, y1: 650, x2:   0, y2: 712, w: 13 },
  { n: 21, kind: 'stick', side: 'left', structure: 'lookout', anchor: 19,
    x1:  50, y1: 650, x2:   0, y2: 712, w: 13 },

  // ── ⑥ MAST AND FLAG, rising from the treehouse rail, clear of the canopy. ─────────────
  { n: 22, kind: 'stick', side: 'right', structure: 'mast', anchor: 17,
    x1: -150, y1: 330, x2: -150, y2: 880, w: 13, w2: 8 },
  { n: 23, kind: 'stick', side: 'right', structure: 'mast', anchor: 22,
    x1: -150, y1: 790, x2:    0, y2: 560, w: 7 },
  { n: 24, kind: 'stick', side: 'right', structure: 'mast', anchor: 22,
    x1: -150, y1: 838, x2: -190, y2: 838, w: 10, w2: 6 },
  // The pennant: a stick that tapers to a point, which is all a flag needs to be at this size.
  { n: 25, kind: 'stick', side: 'right', structure: 'mast', anchor: 22,
    x1: -150, y1: 872, x2:  -80, y2: 856, w: 26, w2: 2 },
];

/** That side's lines, up to and including line `built`. */
export function linesFor(side: StackSide, built: number): TableauLine[] {
  const upTo = Math.max(0, Math.min(TOTAL_LINES, Math.floor(built)));
  return BLUEPRINT.filter(l => l.side === side && l.n <= upTo);
}
