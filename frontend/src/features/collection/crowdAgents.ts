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
import { CROWD_CAP } from './crowdLayout';
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

export function initAgents(ids: string[], opts: AgentOpts): AgentState {
  const { width, rand } = opts;
  // Spread across the width rather than stacking at 0: a room that starts as a pile takes
  // several seconds of separation pressure to look like a room.
  const seeds = ids.map((id, i) => ({
    id,
    x: ((i + 0.5) / Math.max(1, ids.length)) * width,
    dir: (i % 2 === 0 ? 1 : -1) as 1 | -1,
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

  const step = MOVE_UNITS_PER_SEC * opts.band.scale * dt;

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

    // 'moving': walk toward the target, then settle into the ranks or onto the stage.
    if (opts.greeting.has(id)) { out[id] = a; continue; }

    const dx = a.targetX - a.x;
    const ddepth = a.targetDepth - a.depth;
    if (Math.abs(dx) <= step) {
      out[id] = {
        ...a,
        x: a.targetX,
        depth: a.targetDepth,
        // targetDepth 1 is the ranks; anything shallower is a return to the stage.
        activity: a.targetDepth >= 1 ? 'rank' : 'wander',
        t: 0,
      };
      continue;
    }
    const dir: 1 | -1 = dx > 0 ? 1 : -1;
    const progress = step / Math.abs(dx);
    out[id] = {
      ...a,
      x: a.x + dir * step,
      depth: a.depth + ddepth * progress,
      dir,
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
export function homeSlot(id: string, residents: string[], band: CrowdBand, ranked?: string[]) {
  const pool = ranked ?? residents;
  const order = slotOrder(pool).slice(0, CROWD_CAP);
  const index = Math.max(0, order.indexOf(id));
  // Spread over the full width: half-step inset so nobody stands flush against an edge.
  const x = ((index + 0.5) / Math.max(1, order.length)) * band.width;
  return { x, depth: 1 };
}

/** The `moving`/`rank` target fields for a home slot, as a spreadable fragment. */
function homeSlotTarget(id: string, residents: string[], band: CrowdBand, ranked: string[]) {
  const home = homeSlot(id, residents, band, ranked);
  return { x: home.x, targetX: home.x, targetDepth: home.depth };
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
        ? { ...born, activity: 'rank', depth: 1, ...homeSlotTarget(id, residents, opts.band, rank) }
        : born;
      continue;
    }

    const wantsRank = inRank.has(id);
    const isRanked = a.activity === 'rank' || (a.activity === 'moving' && a.targetDepth >= 1);

    if (wantsRank && !isRanked) {
      const home = homeSlot(id, residents, opts.band, rank);
      out[id] = { ...a, activity: 'moving', targetX: home.x, targetDepth: home.depth };
      continue;
    }

    if (onStage.has(id) && isRanked) {
      out[id] = { ...a, activity: 'moving', targetX: a.x, targetDepth: opts.rand() * 0.9 };
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

  return {
    ...state,
    [up]: { ...state[up], activity: 'moving', targetX: state[up].x, targetDepth: opts.rand() * 0.9 },
    [down]: { ...state[down], activity: 'moving', targetX: state[down].x, targetDepth: 1 },
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
