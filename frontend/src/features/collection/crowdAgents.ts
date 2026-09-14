/**
 * Per-bobit autonomous state for the living floor.
 *
 * Composes `wanderReducer` rather than replacing it: that module already owns the walk cycle,
 * the pause beat, the turn at the bounds and the pairwise separation, and all of it is tested.
 * What is added here is DEPTH (so the crowd is not a single line), an ACTIVITY (so the scene
 * director can take an agent off autopilot), and walked transitions between the stage and the
 * standing ranks.
 *
 * Pure and immutable, like every other reducer here. Randomness is injected so a room is
 * reproducible under test.
 */
import { initWander, wanderAdvance } from '../../components/bobbits/wanderReducer';
import type { Wanderer, WanderState, Rand } from '../../components/bobbits/wanderReducer';
import { slotOrder } from './crowdIdentity';
import { CROWD_CAP, stageBounds } from './crowdLayout';
import type { CrowdBand } from './crowdLayout';

/**
 * `wander` roams the stage. `rank` stands at a home slot. `moving` is walking between the two
 * -- the state that makes "no bobit ever teleports" true rather than merely intended.
 */
export type Activity = 'wander' | 'rank' | 'moving';

export interface Agent extends Wanderer {
  /** 0 = front of the stage (nearest), 1 = back. */
  depth: number;
  activity: Activity;
  /** Where a `moving` agent is walking to. Meaningless otherwise, but always defined. */
  targetX: number;
  targetDepth: number;
  /** Where the current move started, so it can be interpolated rather than chased. */
  fromX: number;
  fromDepth: number;
  /** Seconds elapsed into the current move, and how long it lasts. */
  moveT: number;
  moveDur: number;
}

export type AgentState = Record<string, Agent>;

export interface AgentOpts {
  band: CrowdBand;
  /** Measured field width in px. */
  width: number;
  /** Ids currently greeting -- hovered, or inside the greet linger. These hold still. */
  greeting: ReadonlySet<string>;
  /** The room is stunned: nothing moves, poses included. */
  frozen: boolean;
  rand: Rand;
}

/** px/s a transitioning agent walks at, matching the wander stroll so the gait reads right. */
const MOVE_UNITS_PER_SEC = 100;

/**
 * Shortest a station change may take, in seconds.
 *
 * A move used to advance by horizontal distance alone, which made a change of DEPTH with no
 * change of x complete on its first frame -- the agent snapped between the stage and the ranks
 * in one tick. On screen that is a figure jumping vertically, and it is what "odd watching them
 * walk up and down" was: not a walk at all, a teleport with a walk cycle either side of it.
 *
 * Moves are timed now rather than chased, and never finish faster than this, so even a purely
 * vertical change reads as somebody strolling upstage.
 */
export const MOVE_MIN_SEC = 1.4;

/** Ease in and out, so a bobit leans into a walk and settles out of it instead of snapping. */
function smoothstep(k: number): number {
  const c = Math.min(1, Math.max(0, k));
  return c * c * (3 - 2 * c);
}

/**
 * Begin a walk to a new station. Duration comes from the real 2D distance -- horizontal plus
 * the vertical the depth change actually covers -- so a long walk takes longer, with a floor.
 */
export function startMove(
  a: Agent, targetX: number, targetDepth: number, opts: AgentOpts,
): Agent {
  const { top, bottom } = stageBounds(opts.band);
  const dx = targetX - a.x;
  const dy = (targetDepth - a.depth) * (bottom - top);
  const dist = Math.hypot(dx, dy);
  const speed = MOVE_UNITS_PER_SEC * opts.band.scale;
  return {
    ...a,
    activity: 'moving',
    fromX: a.x,
    fromDepth: a.depth,
    targetX,
    targetDepth,
    moveT: 0,
    moveDur: Math.max(MOVE_MIN_SEC, speed > 0 ? dist / speed : MOVE_MIN_SEC),
    dir: dx >= 0 ? 1 : -1,
  };
}

export function initAgents(ids: string[], opts: AgentOpts): AgentState {
  const { width, rand } = opts;
  // Spread across the width rather than stacking at 0: a room that starts as a pile takes
  // several seconds of separation pressure to look like a room.
  // Direction is RANDOM per bobit, not alternating by index. Alternating makes every adjacent
  // pair walk straight at each other, so the room resolves into evenly spaced couples who meet,
  // yield and stand there -- fifteen little standoffs in a row. It was invisible while the
  // separation check was oscillating; fixing that made it obvious.
  const seeds = ids.map((id, i) => ({
    id,
    x: ((i + 0.5) / Math.max(1, ids.length)) * width,
    dir: (rand() < 0.5 ? -1 : 1) as 1 | -1,
  }));
  const wander = initWander(seeds, rand);

  const out: AgentState = {};
  for (const id of ids) {
    const w = wander[id];
    out[id] = {
      ...w,
      depth: rand(),
      activity: 'wander',
      targetX: w.x,
      targetDepth: 0,
      fromX: w.x,
      fromDepth: 0,
      moveT: 0,
      moveDur: MOVE_MIN_SEC,
    };
  }
  return out;
}

export function agentsAdvance(state: AgentState, dt: number, opts: AgentOpts): AgentState {
  if (opts.frozen) return state;

  const ids = Object.keys(state);
  const out: AgentState = {};

  // Only the wandering subset goes through wanderAdvance, which means separation is computed
  // among stage agents alone -- exactly right, since ranked agents stand behind them and a
  // rank is allowed to be shoulder to shoulder.
  const wanderIn: WanderState = {};
  for (const id of ids) if (state[id].activity === 'wander') wanderIn[id] = state[id];

  const wanderOut = wanderAdvance(wanderIn, dt, {
    width: opts.width,
    scale: opts.band.scale,
    greeting: opts.greeting,
    rand: opts.rand,
  });

  for (const id of ids) {
    const a = state[id];

    if (a.activity === 'wander') {
      out[id] = { ...a, ...wanderOut[id] };
      continue;
    }

    if (a.activity === 'rank') {
      out[id] = a;
      continue;
    }

    // 'moving': a TIMED walk between stations, interpolated from where it began. Timed rather
    // than chased so a change of depth alone still takes a walk's worth of seconds instead of
    // completing on its first frame.
    if (opts.greeting.has(id)) { out[id] = a; continue; }

    const moveT = a.moveT + dt;
    if (moveT >= a.moveDur) {
      out[id] = {
        ...a,
        x: a.targetX,
        depth: a.targetDepth,
        // targetDepth 1 is the ranks; anything shallower is a return to the stage.
        activity: a.targetDepth >= 1 ? 'rank' : 'wander',
        moveT: a.moveDur,
        t: 0,
      };
      continue;
    }
    const k = smoothstep(moveT / a.moveDur);
    out[id] = {
      ...a,
      moveT,
      x: a.fromX + (a.targetX - a.fromX) * k,
      depth: a.fromDepth + (a.targetDepth - a.fromDepth) * k,
    };
  }

  return out;
}

/** Which rig animation an agent plays from its own activity alone. */
export function agentAnim(a: Agent): string {
  if (a.activity === 'rank') return 'standstill';
  if (a.activity === 'moving') return 'stroll';
  return a.phase === 'walk' ? 'stroll' : 'standstill';
}

/**
 * Who wanders and who stands.
 *
 * Recency decides the stage: the bobits you most recently earned are the ones moving around,
 * which is what makes a big room feel like it is still about this match. Note this is the one
 * place grant order is used -- POSITIONS still come from the id-sorted order (see homeSlot),
 * so nothing reflows when a bobit is lost and re-earned.
 */
export function castFor(residents: string[], cast: number): { stage: string[]; rank: string[] } {
  const shown = residents.slice(0, CROWD_CAP);
  if (shown.length <= cast) return { stage: shown, rank: [] };
  return {
    stage: shown.slice(shown.length - cast),
    rank: shown.slice(0, shown.length - cast),
  };
}

/**
 * Where a ranked bobit stands. Depth 1 puts him at the back of the band, behind the stage.
 *
 * Indexed among the RANKED bobits, id-sorted -- not among all residents. Indexing over
 * everyone packs the ranks into the first N slots of a 34-wide row, which put six standing
 * bobits in a rigid line at the far left of the band while twenty-four milled about in the
 * rest of it. It read as a queue, not as a crowd with people at the back. Caught by looking
 * at a screenshot; the unit tests were all satisfied.
 *
 * Still id-sorted, so the ranks stay in a stable, legible order rather than shuffling. When
 * the ranked SET changes, homes shift -- and a bobit whose home moved walks to it, which is
 * what `moving` is for. Nobody teleports.
 */
export function homeSlot(id: string, residents: string[], width: number, ranked?: string[]) {
  const pool = ranked ?? residents;
  const order = slotOrder(pool).slice(0, CROWD_CAP);
  const index = Math.max(0, order.indexOf(id));
  // Spread over the MEASURED width, not band.width -- that is a nominal 1000 used for
  // proportional placement, and positioning real px against it put most of a phone's back row
  // off the right-hand edge of a 340px canvas and squeezed a desktop's into the left 70%.
  // Half-step inset so nobody stands flush against an edge.
  const x = ((index + 0.5) / Math.max(1, order.length)) * width;
  return { x, depth: 1 };
}

/**
 * A point to walk to that is a decent stroll away from where you are, and inside the band.
 * Used when a bobit changes station without a slot of its own to head for.
 */
function strollTarget(x: number, opts: AgentOpts): number {
  const margin = 34 * opts.band.scale;
  const reach = Math.max(60, opts.width * 0.18);
  const dir = x > opts.width / 2 ? -1 : 1;
  const wobble = (opts.rand() - 0.5) * reach;
  return Math.min(opts.width - margin, Math.max(margin, x + dir * reach + wobble));
}

/** The `moving`/`rank` target fields for a home slot, as a spreadable fragment. */
function homeSlotTarget(id: string, residents: string[], width: number, ranked: string[]) {
  const home = homeSlot(id, residents, width, ranked);
  return {
    x: home.x, targetX: home.x, targetDepth: home.depth,
    fromX: home.x, fromDepth: home.depth, moveT: 0, moveDur: MOVE_MIN_SEC,
  };
}

/**
 * Reconcile the agent set with the residents and the cast.
 *
 * Newcomers are born wandering. Anyone who left is dropped. Anyone on the wrong side of the
 * cast line is set WALKING to the right side -- never moved there.
 */
export function syncCast(
  state: AgentState, residents: string[], opts: AgentOpts, cast: number,
): AgentState {
  const { stage, rank } = castFor(residents, cast);
  const onStage = new Set(stage);
  const inRank = new Set(rank);
  const out: AgentState = {};

  for (const id of [...stage, ...rank]) {
    const a = state[id];

    if (!a) {
      // A resident with no agent yet: seed one wandering where he stands.
      const born = initAgents([id], opts)[id];
      out[id] = inRank.has(id)
        ? { ...born, activity: 'rank', depth: 1, ...homeSlotTarget(id, residents, opts.width, rank) }
        : born;
      continue;
    }

    const wantsRank = inRank.has(id);
    const isRanked = a.activity === 'rank' || (a.activity === 'moving' && a.targetDepth >= 1);

    if (wantsRank && !isRanked) {
      const home = homeSlot(id, residents, opts.width, rank);
      out[id] = startMove(a, home.x, home.depth, opts);
      continue;
    }

    if (onStage.has(id) && isRanked) {
      // Comes DOWN to somewhere with floor around it, not straight forward out of its slot:
      // a move with no horizontal travel reads as rising rather than as walking.
      out[id] = startMove(a, strollTarget(a.x, opts), opts.rand() * 0.9, opts);
      continue;
    }

    out[id] = a;
  }

  return out;
}

/** Seconds between cast rotations. Slow on purpose: this is background life, not an event. */
export const ROTATE_EVERY = 20;

/**
 * Swap one ranked bobit onto the stage and one stage bobit back into the ranks.
 *
 * Without this the same faces hold the stage forever and a 90-bobit room looks staffed rather
 * than populated. Both journeys are walked, like every other position change here.
 *
 * `elapsed` is seconds since the last rotation; the caller owns that clock. Returns the SAME
 * reference when nothing happens, so callers can skip work on identity.
 */
export function rotateCast(state: AgentState, elapsed: number, opts: AgentOpts): AgentState {
  if (elapsed < ROTATE_EVERY) return state;

  const ids = Object.keys(state).sort();          // sorted: deterministic under test
  const ranked = ids.filter(id => state[id].activity === 'rank');
  const roaming = ids.filter(id => state[id].activity === 'wander');
  if (!ranked.length || !roaming.length) return state;

  const up = ranked[Math.floor(opts.rand() * ranked.length) % ranked.length];
  const down = roaming[Math.floor(opts.rand() * roaming.length) % roaming.length];

  // Both journeys cross real ground. Sending someone to the x they already stand on makes the
  // walk purely vertical, which reads as floating up or down rather than as ambling somewhere.
  return {
    ...state,
    [up]: startMove(state[up], strollTarget(state[up].x, opts), opts.rand() * 0.9, opts),
    [down]: startMove(state[down], strollTarget(state[down].x, opts), 1, opts),
  };
}

/**
 * mulberry32 -- small, fast, dependency-free, and good enough for scattering a crowd.
 *
 * A null seed falls through to Math.random, which is what production wants. A seed makes a
 * room reproducible, which is what the bench and the screenshot sweep want: a verification
 * pass that cannot reproduce its own input is not a verification pass.
 */
export function makeRand(seed: string | null): Rand {
  if (!seed) return () => Math.random();
  let a = 0;
  for (let i = 0; i < seed.length; i++) a = Math.imul(a ^ seed.charCodeAt(i), 0x01000193) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
