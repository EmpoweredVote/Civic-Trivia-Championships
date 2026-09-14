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

/** How many owned bobits are not being rendered because of the cap. */
export function overflowCount(state: CrowdState): number {
  return Math.max(0, state.residents.length - CROWD_CAP);
}

/** How close two bobits must be to slap hands, in rig units. */
const HIGHFIVE_REACH_UNITS = 160;

/**
 * Agents plus match state, rendered.
 *
 * Position now comes from the agent -- the fixed slot layout survives only as the home a
 * ranked bobit walks back to (see crowdAgents.homeSlot). What is left here is genuinely
 * translation: pick a pose, resolve a colour, and get out of the way.
 */
export function crowdFigures(
  state: CrowdState, agents: AgentState, band: CrowdBand, darkMode: boolean,
): FieldFigure[] {
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
  for (const id of ids) {
    const a = agents[id];
    const victim = state.loss?.id === id;

    // He holds his place but stops being drawn the moment the burst takes him.
    if (victim && !state.residents.includes(id)) continue;

    const place = agentPlacement(a.depth, band);
    let anim = agentAnim(a);
    // Pose VARIANT, not a prop: highfive reaches with the named arm. See FieldFigure.vars.
    let vars: FieldFigure['vars'];

    if (victim) {
      anim = 'fall';                                   // limp, being lifted
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
      scale: place.scale,
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
