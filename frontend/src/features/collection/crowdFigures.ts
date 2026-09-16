import type { FieldFigure } from '../../components/bobbits/fieldGeometry';
import { figColor } from '../../components/bobbits/rigExtras';
import { toneOf, hashId, slotOrder } from './crowdIdentity';
import { agentPlacement, CROWD_CAP } from './crowdLayout';
import type { CrowdBand } from './crowdLayout';
import { agentAnim } from './crowdAgents';
import type { AgentState } from './crowdAgents';
import { celebrationPose, ripplePose, pairUp, reactionOffset } from './crowdReactions';
import { isStunned, LOSS_RISE } from './crowdReducer';
import type { CrowdState } from './crowdReducer';
import { actorsOf } from './sceneDirector';
import type { DirectorState } from './sceneDirector';

/** How many owned bobits are not being rendered because of the cap. */
export function overflowCount(state: CrowdState): number {
  return Math.max(0, state.residents.length - CROWD_CAP);
}

/** Highest a clamped-to-band figure's feet may go: keeps a whole figure on the canvas. */
const TOP_MARGIN = 2;

/** How close two bobits must be to slap hands, in rig units. */
const HIGHFIVE_REACH_UNITS = 160;

/**
 * How far a bobit's height may stray from standard, as a fraction of it.
 *
 * Depth was removed -- one ground line, one size -- because a bobit crossing the band on a
 * diagonal had no perspective gait and read as sliding. That fix cost the room its only cue
 * for telling one figure from another at a glance, which is why an entrance that is not a puff
 * of smoke currently fails to register at all in a crowd of thirty.
 *
 * Height gives that cue back and brings none of depth's problem with it: everybody still walks
 * the same line, so nothing slides. Kept modest on purpose -- past roughly a tenth the short
 * ones stop reading as short people and start reading as children.
 */
export const HEIGHT_SPREAD = 0.1;

/**
 * A bobit's own height, as a multiplier on the band's scale.
 *
 * Derived from `hashId`, the same source as his colour and his animation phase, so height is
 * stable for the life of his id and identical down every path that draws him. That matters
 * more than it looks: a newcomer is drawn from his ACTOR during an entrance and from his AGENT
 * the moment it ends, and a height that disagreed across those two would make him visibly
 * change size at the handoff.
 */
export function heightFactor(id: string): number {
  // A second, coarser slice of the hash than `toneOf` and the phase use, so height does not
  // correlate with colour -- all the tall ones coming out teal would read as a bug.
  const t = (Math.floor(hashId(id) / 1000) % 1000) / 999;
  return 1 - HEIGHT_SPREAD + t * 2 * HEIGHT_SPREAD;
}

/**
 * Agents plus match state, rendered.
 *
 * Position now comes from the agent -- the fixed slot layout survives only as the home a
 * ranked bobit walks back to (see crowdAgents.homeSlot). What is left here is genuinely
 * translation: pick a pose, resolve a colour, and get out of the way.
 */
/**
 * The ground line the director stages on. Matches `agentPlacement`'s, so a scene actor and a
 * wandering bobit stand on the same floor.
 */
export function sceneGroundY(band: CrowdBand): number {
  return agentPlacement(0, band).groundY;
}

/**
 * Figures the director wants on the OVERLAY, in band coordinates.
 *
 * Kept out of `crowdFigures` rather than filtered inside it, because the two go to different
 * canvases. An airborne actor drawn on both would be painted twice.
 */
export function aerialFigures(
  director: DirectorState, band: CrowdBand, darkMode: boolean,
): FieldFigure[] {
  return actorsOf(director, sceneGroundY(band))
    .filter(a => a.layer === 'air' && !a.hidden)
    .map(a => ({
      id: `air:${a.agentId ?? a.role}`,
      anim: a.pose,
      color: figColor(toneOf(a.agentId ?? a.role), darkMode),
      x: a.x,
      groundY: a.y,
      scale: band.scale * heightFactor(a.agentId ?? a.role),
      poofable: false,
      greetable: false,
      vars: a.hand ? { hand: a.hand } : undefined,
    }));
}

export function crowdFigures(
  state: CrowdState, agents: AgentState, band: CrowdBand, darkMode: boolean,
  director?: DirectorState,
  /**
   * Whether the overlay is available this frame. When it is NOT -- the timer is running and
   * nothing may pass in front of the question card -- airborne actors are drawn on the band
   * instead, clamped into it, rather than skipped. Skipping them made a bobit fired mid-answer
   * vanish in flight and reappear on landing.
   */
  allowAir = true,
): FieldFigure[] {
  // Actors the director owns, indexed by the agent playing them. A cast agent is drawn from
  // its ACTOR -- pose and position both -- so the director and wanderAdvance can never fight
  // over where it is.
  const staged = new Map<string, ReturnType<typeof actorsOf>[number]>();
  const orphans: ReturnType<typeof actorsOf>[number][] = [];
  if (director) {
    for (const raw of actorsOf(director, sceneGroundY(band))) {
      let a = raw;
      if (a.layer === 'air') {
        if (allowAir) continue;                          // the overlay's business
        // Grounded fallback: keep him inside the band rather than letting him fly off it.
        a = { ...a, y: Math.max(TOP_MARGIN, a.y) };
      }
      if (a.agentId && agents[a.agentId]) staged.set(a.agentId, a);
      else orphans.push(a);
    }
  }
  // The cap is defended HERE, not only in syncCast, because it is a measured performance
  // ceiling (Stage 2: 105 was the 60fps floor on a mid-tier phone) and this is the last gate
  // before paint. syncCast already respects it on the live path; relying on that alone would
  // make the ceiling a convention every future caller has to know about. Sliced in id order
  // so which bobits are dropped is stable rather than dependent on insertion.
  const all = Object.keys(agents);
  const ids = all.length <= CROWD_CAP ? all : slotOrder(all).slice(0, CROWD_CAP);

  // While the room is stunned every figure holds its pose. The field paints at `t + phase`,
  // so the freeze reaches it through the phase: rewinding by exactly how long the stun has
  // run pins `t + phase` at the value it had when the stun began, since the two advance
  // together. Continuous at onset -- the stun's clock starts at zero.
  const rewind = isStunned(state) && state.loss ? state.loss.t : 0;

  // Pairs are recomputed every frame from positions, which is safe because pairUp is
  // deterministic in id order: the same neighbours produce the same pairing, so partners do
  // not flicker between each other mid-slap.
  const celebrating = state.celebrating > 0;
  const pairs = celebrating
    ? pairUp(ids.map(id => ({ id, x: agents[id].x })), HIGHFIVE_REACH_UNITS * band.scale)
    : [];
  const hands = new Map<string, 'R' | 'L'>();
  for (const [left, right] of pairs) { hands.set(left, 'R'); hands.set(right, 'L'); }

  const rippleX = state.ripple ? agents[state.ripple.from]?.x ?? null : null;

  const out: FieldFigure[] = [];

  // Scene actors with no agent of their own: a bobit who has not joined the crowd yet.
  for (const a of orphans) {
    if (a.hidden) continue;
    out.push({
      id: `scene:${a.agentId ?? a.role}`,
      anim: a.pose,
      color: figColor(toneOf(a.agentId ?? a.role), darkMode),
      x: a.x,
      groundY: a.y,
      scale: band.scale * heightFactor(a.agentId ?? a.role),
      poofable: false,
      greetable: false,
      vars: a.hand ? { hand: a.hand } : undefined,
    });
  }

  for (const id of ids) {
    const a = agents[id];
    const victim = state.loss?.id === id;

    // The director has this one: it plays what the scene says, where the scene says.
    const act = staged.get(id);
    if (act) {
      if (act.hidden) continue;
      out.push({
        id,
        anim: act.pose,
        color: figColor(toneOf(id), darkMode),
        x: act.x,
        groundY: act.y,
        scale: band.scale * heightFactor(id),
        phase: (hashId(id) % 1000) / 250,
        flip: false,
        poofable: false,
        greetable: true,
        vars: act.hand ? { hand: act.hand } : undefined,
      });
      continue;
    }

    // He holds his place but stops being drawn the moment the burst takes him.
    if (victim && !state.residents.includes(id)) continue;

    const place = agentPlacement(a.depth, band);
    let anim = agentAnim(a);
    // Pose VARIANT, not a prop: highfive reaches with the named arm. See FieldFigure.vars.
    let vars: FieldFigure['vars'];

    if (victim) {
      anim = 'fall';                                   // limp, being lifted
    } else if (state.arriving[id] !== undefined) {
      // Just turned up: he waves hello rather than joining the applause for himself. The ROOM
      // celebrates him -- that is the difference between a new bobit and one you already had.
      //
      // The reducer has always tracked this window; the agents rewrite stopped reading it, so
      // newcomers simply appeared for a while. The proper entrances (smoke, the flash, the
      // cannon) replace this branch in plan 2 -- until then a wave beats materialising.
      anim = 'friendly';
    } else if (celebrating) {
      const pose = celebrationPose(
        state.celebrateT, state.celebrating, state.celebrant === id, hands.get(id) ?? null,
        reactionOffset(hashId(id)),
      );
      if (pose.anim) {
        anim = pose.anim;
        if (pose.hand) vars = { hand: pose.hand };
      }
    } else if (state.ripple && rippleX !== null) {
      const pose = ripplePose(Math.abs(a.x - rippleX), state.ripple.t, band.scale);
      if (pose) anim = pose;
    }

    let groundY = place.groundY;
    if (victim && state.loss?.phase === 'rising') {
      // Floats up, accelerating, over the rise. He is drawn until the burst takes him.
      const k = Math.min(1, state.loss.t / LOSS_RISE);
      groundY -= k * k * (band.height * 1.6);
    }

    out.push({
      id,
      anim,
      color: figColor(toneOf(id), darkMode),
      x: a.x,
      groundY,
      scale: place.scale * heightFactor(id),
      // Phase from the id, so neighbours never breathe in lockstep. The stun rides on top.
      phase: (hashId(id) % 1000) / 250 - rewind,
      flip: a.dir === -1,
      poofable: false,
      greetable: true,
      vars,
    });
  }
  return out;
}
