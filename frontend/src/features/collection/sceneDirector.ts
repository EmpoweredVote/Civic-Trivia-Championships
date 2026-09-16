/**
 * Runs scenes. Pure, seedable, and ignorant of canvases and React.
 *
 * Three jobs, and only three: cast agents into a scene's roles, interpolate between its beats,
 * and make sure two scenes never claim the same ground. Everything it produces is a plain
 * description of where somebody is and what they are doing; painting it is somebody else's
 * problem.
 */
import type { Beat, Scene, SceneLayer } from './scenes/types';
import type { Rand } from '../../components/bobbits/wanderReducer';

export interface Actor {
  role: string;
  /** The agent playing this role. Roles with no agent are positioned by their beats alone. */
  agentId: string | null;
  x: number;
  /** px from the field top. Equal to the ground line unless the actor is in the air. */
  y: number;
  pose: string;
  hand?: 'R' | 'L';
  layer: SceneLayer;
  hidden: boolean;
}

export interface RunningScene {
  scene: Scene;
  t: number;
  /** Reserved floor, in px. */
  left: number;
  right: number;
  cast: Record<string, string>;
}

export interface DirectorEffect {
  id: string;
  kind: 'smoke' | 'flash';
  x: number;
  y: number;
  /** Seconds since it started. */
  t: number;
  spread: number;
  color?: string;
}

export interface DirectorProp {
  id: string;
  kind: 'cannon';
  x: number;
  groundY: number;
  angle: number;
  flip: boolean;
}

/**
 * An agent the director has just let go of, and the x his scene left him standing at.
 *
 * The crowd seeds an agent for a new resident at the centre of the band, because at the moment
 * it is created there is nowhere better to put him. While a scene owns him that is invisible --
 * he is drawn from his ACTOR. The frame the scene ends, he is drawn from his agent again, and
 * without this handoff he snaps from wherever his entrance finished to the middle of the room.
 */
export interface ReleasedActor {
  agentId: string;
  x: number;
}

export interface DirectorState {
  running: RunningScene[];
  props: DirectorProp[];
  effects: DirectorEffect[];
  /** Released by the most recent `directorStep`, and only by that one. */
  released: ReleasedActor[];
}

/**
 * Seconds a smoke puff or a flash lives. BobitField fades them over the same two numbers --
 * if they drifted apart an effect would either vanish mid-fade or linger fully transparent.
 */
export const SMOKE_DUR = 1.0;
export const FLASH_DUR = 0.22;

export function directorInit(): DirectorState {
  return { running: [], props: [], effects: [], released: [] };
}

/** Every agent the director currently owns. `crowdAgents` must not advance these. */
export function castIds(state: DirectorState): Set<string> {
  const out = new Set<string>();
  for (const r of state.running) for (const id of Object.values(r.cast)) out.add(id);
  return out;
}

/**
 * Find a disjoint stretch of floor for a scene of this span, or null.
 *
 * Scenes run concurrently -- the design chose overlap over queueing -- so this is the only
 * thing stopping two of them happening on top of each other.
 */
export function canStage(
  state: DirectorState, span: number, width: number, anchor: 'left' | 'right' = 'left',
): { left: number; right: number } | null {
  const need = Math.min(width, Math.max(1, span * width));
  const taken = state.running
    .map(r => ({ left: r.left, right: r.right }))
    .sort((a, b) => a.left - b.left);

  // Right-anchored scenes scan inward from the far edge. A scene whose choreography points at
  // something fixed -- the tree on the right border -- has to be staged beside it, not merely
  // somewhere that fits.
  if (anchor === 'right') {
    let cursor = width;
    for (let i = taken.length - 1; i >= 0; i--) {
      const t = taken[i];
      if (cursor - t.right >= need) return { left: cursor - need, right: cursor };
      cursor = Math.min(cursor, t.left);
    }
    if (cursor >= need) return { left: cursor - need, right: cursor };
    return null;
  }

  let cursor = 0;
  for (const t of taken) {
    if (t.left - cursor >= need) return { left: cursor, right: cursor + need };
    cursor = Math.max(cursor, t.right);
  }
  if (width - cursor >= need) return { left: cursor, right: cursor + need };
  return null;
}

/**
 * Begin a scene.
 *
 * The caller is expected to have checked `canStage`. One that did not gets the scene at 0
 * anyway rather than silence, because a visible overlap is a better bug report than a set
 * piece that mysteriously never fires.
 */
export function startScene(
  state: DirectorState, scene: Scene, newcomerId: string, width: number, rand: Rand,
  castOverrides: Record<string, string> = {},
): DirectorState {
  const slot = canStage(state, scene.span, width, scene.anchor)
    ?? { left: 0, right: scene.span * width };
  const cast: Record<string, string> = { newcomer: newcomerId };
  for (const role of scene.roles) {
    if (role === 'newcomer') continue;
    cast[role] = castOverrides[role] ?? `${scene.id}:${role}:${Math.floor(rand() * 1e6)}`;
  }
  return {
    ...state,
    running: [...state.running, { scene, t: 0, left: slot.left, right: slot.right, cast }],
  };
}

/**
 * The leg of a role's journey that is active at time `t`.
 *
 * EVERY field on a beat means "from this beat onward" -- pose, layer, hidden AND movement. A
 * beat carrying `moveTo` starts a journey there, arriving by that role's next beat.
 *
 * The first draft split these: pose was "from here" while `moveTo` was "arrive by here". Two
 * opposite conventions in one format is a trap, and it caught its own author immediately --
 * the cannon's `layer: 'air'` would have taken effect at the instant the bobit LANDED, because
 * that was the beat that named the destination.
 */
function legOf(beats: Beat[], role: string, t: number, duration: number) {
  const mine = beats.filter(b => b.role === role).sort((a, b) => a.at - b.at);
  let prevIdx = -1;
  for (let i = 0; i < mine.length; i++) {
    if (mine[i].at <= t) prevIdx = i;
    else break;
  }
  const prev = prevIdx >= 0 ? mine[prevIdx] : null;
  const next = prevIdx + 1 < mine.length ? mine[prevIdx + 1] : null;

  // Where this leg begins: the last destination committed BEFORE the active beat.
  let start = 0;
  for (let i = 0; i < prevIdx; i++) {
    if (mine[i].moveTo !== undefined) start = mine[i].moveTo as number;
  }
  const ends = next ? next.at : duration;
  return { prev, next, start, span: Math.max(0, ends - (prev?.at ?? 0)) };
}

/** Accumulated pose/layer/hidden for a role at time t: later beats override earlier ones. */
function settledAt(beats: Beat[], role: string, t: number) {
  let pose = 'standstill';
  let hand: 'R' | 'L' | undefined;
  let layer: SceneLayer = 'ground';
  let hidden = false;
  const mine = beats.filter(x => x.role === role && x.at <= t).sort((a, b) => a.at - b.at);
  for (const b of mine) {
    if (b.pose) pose = b.pose;
    if (b.hand) hand = b.hand;
    if (b.layer) layer = b.layer;
    if (b.hidden !== undefined) hidden = b.hidden;
  }
  return { pose, hand, layer, hidden };
}

/** Where a role is, as a 0-1 fraction of the scene's own span. */
function fracAt(beats: Beat[], role: string, t: number, duration: number): number {
  const { prev, start, span } = legOf(beats, role, t, duration);
  if (!prev) return 0;
  const end = prev.moveTo ?? start;
  if (prev.path === undefined || prev.path === 'snap' || span <= 0) return end;
  const k = Math.min(1, Math.max(0, (t - prev.at) / span));
  return start + (end - start) * k;
}

/** Height above the ground line at time t, for a role whose active leg is an arc. */
function liftAt(beats: Beat[], role: string, t: number, duration: number): number {
  const { prev, span } = legOf(beats, role, t, duration);
  if (!prev || prev.path !== 'arc' || span <= 0) return 0;
  const k = Math.min(1, Math.max(0, (t - prev.at) / span));
  return Math.sin(Math.PI * k) * (prev.arcPeak ?? 0);
}

export function directorStep(
  state: DirectorState, dt: number, groundY: number,
): DirectorState {
  const running: RunningScene[] = [];
  const released: ReleasedActor[] = [];
  let props = [...state.props];
  let effects = state.effects.map(e => ({ ...e, t: e.t + dt }));

  for (const r of state.running) {
    const t0 = r.t;
    const t1 = r.t + dt;

    // A beat's one-shot side effects fire when the frame crosses its `at`, so each fires
    // exactly once however the frames happen to land.
    //
    // On a scene's FIRST step the window has to include its own start. A half-open window that
    // begins at 0 silently drops every beat written at `at: 0` -- which is where an entrance
    // puts the puff of smoke that announces it. `pool-stumble` shipped with no poof at all for
    // exactly this reason, and the swirl and the cannon each lost the first of their puffs.
    const from = t0 === 0 ? -1 : t0;

    for (const b of r.scene.beats) {
      if (!(b.at > from && b.at <= t1)) continue;
      const x = r.left
        + fracAt(r.scene.beats, b.role, b.at, r.scene.duration) * (r.right - r.left);
      const y = groundY - liftAt(r.scene.beats, b.role, b.at, r.scene.duration);

      if (b.smoke) {
        effects.push({
          id: `${r.scene.id}:${b.role}:${b.at}:smoke`,
          kind: 'smoke', x, y, t: 0, spread: b.smoke.spread, color: b.smoke.color,
        });
      }
      if (b.flash) {
        effects.push({
          id: `${r.scene.id}:${b.role}:${b.at}:flash`,
          kind: 'flash', x, y, t: 0, spread: b.smoke?.spread ?? 40,
        });
      }
      if (b.prop === null) {
        props = props.filter(p => !p.id.startsWith(`${r.scene.id}:`));
      } else if (b.prop) {
        props = [...props, {
          id: `${r.scene.id}:${b.role}:prop`, kind: b.prop.kind,
          x, groundY, angle: b.prop.angle, flip: false,
        }];
      }
    }

    if (t1 >= r.scene.duration) {
      // The scene's props leave with it, so a cannon can never outlive the scene that placed
      // it -- including when the scene forgot to clear it.
      props = props.filter(p => !p.id.startsWith(`${r.scene.id}:`));

      // Hand every cast member back where the scene actually left him, measured at the
      // scene's own end rather than at t1, which may have overshot it by part of a frame.
      for (const role of r.scene.roles) {
        const agentId = r.cast[role];
        if (!agentId) continue;
        const frac = fracAt(r.scene.beats, role, r.scene.duration, r.scene.duration);
        released.push({ agentId, x: r.left + frac * (r.right - r.left) });
      }
      continue;
    }
    running.push({ ...r, t: t1 });
  }

  effects = effects.filter(e => e.t < (e.kind === 'flash' ? FLASH_DUR : SMOKE_DUR));

  return { running, props, effects, released };
}

/** Everything the director currently wants drawn, as positions and poses. */
export function actorsOf(state: DirectorState, groundY: number): Actor[] {
  const out: Actor[] = [];
  for (const r of state.running) {
    for (const role of r.scene.roles) {
      const { pose, hand, layer, hidden } = settledAt(r.scene.beats, role, r.t);
      const frac = fracAt(r.scene.beats, role, r.t, r.scene.duration);
      out.push({
        role,
        agentId: r.cast[role] ?? null,
        x: r.left + frac * (r.right - r.left),
        y: groundY - liftAt(r.scene.beats, role, r.t, r.scene.duration),
        pose, hand, layer, hidden,
      });
    }
  }
  return out;
}
