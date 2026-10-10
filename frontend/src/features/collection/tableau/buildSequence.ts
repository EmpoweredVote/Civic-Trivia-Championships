import type { TableauLine, StackSide } from './blueprint';
import { lineEndpoints } from './tableauGeometry';
import type { JobRole } from '../crowdAgents';

/**
 * How a line gets from nowhere to standing.
 *
 * SCRIPTED, not simulated. An emergent worksite would produce better accidents and worse
 * software: this codebase's primary defence is the contact sheet, and you cannot screenshot-
 * verify a scene that is different every time. A script samples identically on every run, so
 * `bobit-tableau.mjs` can show the same raise at the same ten instants forever.
 *
 * The clock is the worksite's OWN and is not gated on game phase. The crew keeps working
 * while the timer runs -- that is what makes the margin a place rather than an event.
 */
export type BuildPhase = 'fetch' | 'haul' | 'raise' | 'lash' | 'payout' | 'curl' | 'done';

export const BUILD_SEC = {
  fetch: 3,
  haul: 4,
  raise: 3.5,
  lash: 3.5,
  payout: 4.5,
  curl: 6,
} as const;

/** A line lashed above this height is hoisted rather than carried in flat and pivoted. */
const GROUND_JOINT_UNITS = 1;

function isGroundLine(line: TableauLine): boolean {
  return line.y1 <= GROUND_JOINT_UNITS;
}

export function buildDuration(line: TableauLine): number {
  if (line.kind === 'string') return BUILD_SEC.fetch + BUILD_SEC.payout + BUILD_SEC.curl;
  return isGroundLine(line)
    ? BUILD_SEC.fetch + BUILD_SEC.haul + BUILD_SEC.raise + BUILD_SEC.lash
    : BUILD_SEC.fetch + BUILD_SEC.raise + BUILD_SEC.lash;
}

/** Which phase the clock is in, and how far through it. */
export function phaseAt(line: TableauLine, t: number): { phase: BuildPhase; k: number } {
  const order: Array<[BuildPhase, number]> = line.kind === 'string'
    ? [['fetch', BUILD_SEC.fetch], ['payout', BUILD_SEC.payout], ['curl', BUILD_SEC.curl]]
    : isGroundLine(line)
      ? [['fetch', BUILD_SEC.fetch], ['haul', BUILD_SEC.haul],
         ['raise', BUILD_SEC.raise], ['lash', BUILD_SEC.lash]]
      : [['fetch', BUILD_SEC.fetch], ['raise', BUILD_SEC.raise], ['lash', BUILD_SEC.lash]];

  let left = Math.max(0, t);
  for (const [phase, dur] of order) {
    if (left < dur) return { phase, k: dur > 0 ? left / dur : 1 };
    left -= dur;
  }
  return { phase: 'done', k: 1 };
}

/** Ease in and out, so the line leans into the lift and settles out of it. */
function smoothstep(k: number): number {
  const c = Math.min(1, Math.max(0, k));
  return c * c * (3 - 2 * c);
}

/**
 * Where the line is drawn this frame, or null while it does not exist yet.
 *
 * THE PIVOT IS ENDPOINT 1, always, because endpoint 1 is the joint -- the end that is lashed.
 * Pivoting about the free end would swing the joint through the air and plant the wrong end on
 * the wood. `blueprint.test.ts` guarantees endpoint 1 touches the anchor; this is what cashes
 * that guarantee in.
 *
 * At `t >= buildDuration` the result is EXACTLY `lineEndpoints`, not an approximation of it. A
 * line that settles three pixels off its own joint is the same defect that once sank a sitter
 * into a branch, and `buildSequence.test.ts` holds it for all 24 sticks.
 */
export function lineAt(
  line: TableauLine, t: number, ox: number, floorY: number, scale: number,
): { x1: number; y1: number; x2: number; y2: number } | null {
  const final = lineEndpoints(line, ox, floorY, scale);
  const { phase, k } = phaseAt(line, t);
  if (phase === 'fetch') return null;
  if (phase === 'done' || phase === 'lash' || phase === 'curl') return final;

  const len = Math.hypot(final.x2 - final.x1, final.y2 - final.y1);
  // Lying flat, pointing away from the stack's centre so it is not inside the structure.
  const dir = final.x2 >= final.x1 ? 1 : -1;

  if (phase === 'haul') {
    // Dragged in along the floor from off the canvas's near edge to the joint's x.
    const from = dir > 0 ? -len : ox + len;
    const x1 = from + (final.x1 - from) * smoothstep(k);
    return { x1, y1: floorY, x2: x1 + dir * len, y2: floorY };
  }

  if (phase === 'payout') {
    // A string does not pivot: it follows the climber up, from the floor to the crown.
    const y1 = floorY + (final.y1 - floorY) * smoothstep(k);
    return { x1: final.x1, y1, x2: final.x1, y2: y1 };
  }

  // raise: rotate about endpoint 1, from flat to final.
  //
  // A GROUND line's joint also rises -- it is lifted off the floor onto its footing as it goes
  // up. A line lashed ABOVE the ground was hoisted to its joint during `fetch`, so its joint is
  // already where it belongs and only the angle changes.
  const e = smoothstep(k);
  const y1 = isGroundLine(line) ? floorY + (final.y1 - floorY) * e : final.y1;
  const a0 = 0;                                                   // flat, pointing `dir`
  const a1 = Math.atan2(final.y2 - final.y1, final.x2 - final.x1);
  const a = dir > 0 ? a0 + (a1 - a0) * e : Math.PI + (a1 - Math.PI) * e;
  return {
    x1: final.x1,
    y1,
    x2: final.x1 + Math.cos(a) * len,
    y2: y1 + Math.sin(a) * len,
  };
}

/** One worker on a job, positioned in the MARGIN CANVAS's coordinates. */
export interface Worker {
  role: JobRole;
  x: number;
  /** The worker's ground-contact line. */
  groundY: number;
  anim: string;
  flip: boolean;
}

/**
 * Who a line needs.
 *
 * A ground line is carried and pivoted by two. Anything lashed above head height needs a third
 * on the structure to receive it -- which is the whole point of the upward rule: a bobit has to
 * climb in order to work, because he is building above his own head.
 */
export function crewRolesFor(line: TableauLine): JobRole[] {
  return isGroundLine(line) || line.kind === 'string'
    ? ['hauler', 'steadier']
    : ['hauler', 'steadier', 'lasher'];
}

/**
 * Where the crew gathers ON THE BAND, in band px.
 *
 * NOT the joint's x. The joint is in the margin canvas's coordinates and the crew walks on the
 * band, which is a different box -- the left canvas starts at the shell's content edge and the
 * right one ends at it. Handing `assignJob` a canvas x would send the crew to a point in the
 * middle of the question column. They gather at the band's own edge, under the stack.
 */
export function siteX(side: StackSide, bandWidth: number): number {
  return side === 'left' ? bandWidth * 0.04 : bandWidth * 0.96;
}

/**
 * Where each worker stands this frame, in the MARGIN CANVAS's coordinates.
 *
 * The canvas's bottom edge IS the band's floor line, and the canvas abuts the band, so a
 * worker handed over from the band at the end of `fetch` continues from where he was standing
 * rather than jumping. That continuity is the reason `canvasOf` moves him at the phase change
 * and not at the claim.
 *
 * Poses are chosen by what their frame function DOES, never by name -- `fall` is a seated
 * sprawl and `peek` looks down, and both have shipped wrong here once. `hefty` is the heavy
 * haul with a measured sag onto the weight-bearing leg; `heave` is a straight-back hinge that
 * folds deep and lifts; `offer` holds something out at arm's length; `climb` ratchets limbs
 * upward.
 */
export function crewAt(
  line: TableauLine, t: number, ox: number, floorY: number, scale: number,
): Worker[] {
  const { phase } = phaseAt(line, t);
  if (phase === 'fetch' || phase === 'done') return [];

  const e = lineAt(line, t, ox, floorY, scale);
  if (!e) return [];
  const final = lineEndpoints(line, ox, floorY, scale);
  const toward = final.x2 >= final.x1 ? 1 : -1;
  const onFloor = phase === 'haul' || phase === 'payout';

  // The steadier holds the joint true for the whole job.
  const out: Worker[] = [{
    role: 'steadier',
    x: e.x1 - toward * 14 * scale,
    groundY: onFloor ? floorY : Math.min(floorY, e.y1),
    anim: phase === 'haul' ? 'hefty' : 'offer',
    flip: toward < 0,
  }];

  // The hauler is at the moving end: dragging it in, then heaving it up.
  out.push({
    role: 'hauler',
    x: e.x2,
    groundY: onFloor ? floorY : Math.min(floorY, e.y2),
    anim: phase === 'haul' ? 'hefty' : phase === 'payout' ? 'climb' : 'heave',
    flip: toward > 0,
  });

  // The lasher waits at the joint to receive the line. Only a line lashed above the ground
  // has one -- a ground line is set on its own footing by the two on the floor.
  if (crewRolesFor(line).includes('lasher')) {
    out.push({
      role: 'lasher',
      x: final.x1 + toward * 10 * scale,
      groundY: final.y1,
      anim: phase === 'lash' ? 'offer' : 'climb',
      flip: toward < 0,
    });
  }
  return out;
}
