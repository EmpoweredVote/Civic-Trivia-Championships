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
