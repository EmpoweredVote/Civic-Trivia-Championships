import type { FieldFigure, Surface } from '../../components/bobbits/fieldGeometry';
import { figColor } from '../../components/bobbits/rigExtras';
import { toneOf, hashId, slotOrder } from './crowdIdentity';
import { agentPlacement, CROWD_CAP, HEADROOM_UNITS } from './crowdLayout';
import type { CrowdBand } from './crowdLayout';
import { agentAnim, climbProgress, CLIMB_MIN_SEC } from './crowdAgents';
import type { AgentState, Agent } from './crowdAgents';
import { celebrationPose, ripplePose, pairUp, reactionOffset } from './crowdReactions';
import { isStunned, LOSS_RISE } from './crowdReducer';
import type { CrowdState } from './crowdReducer';
import { actorsOf } from './sceneDirector';
import type { DirectorState } from './sceneDirector';

/** How many owned bobits are not being rendered because of the cap. */
export function overflowCount(state: CrowdState): number {
  return Math.max(0, state.residents.length - CROWD_CAP);
}

/** Clearance left above a clamped figure's head. */
const TOP_MARGIN = 2;

/**
 * Highest a clamped-to-band figure's FEET may go.
 *
 * `groundY` is the feet line and the body is drawn upward from it, so clamping the feet to the
 * top of the canvas draws the entire figure above it. The previous clamp did exactly that: for
 * most of a cannon flight with the sky closed the bobit was pinned at y=2 and invisible --
 * precisely the "vanish in flight, reappear on landing" the fallback exists to prevent. He now
 * arcs as high as the band can actually show and no higher.
 */
function highestFeet(band: CrowdBand): number {
  return TOP_MARGIN + HEADROOM_UNITS * band.scale;
}

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
 *
 * Takes the same `allowAir` gate `crowdFigures` does, and for the same reason it is a
 * parameter rather than something the caller applies afterwards: the two functions PARTITION
 * the airborne actors between them, and a partition only holds if both are answering the same
 * question. The component used to gate this one with the `aerialAllowed` prop and the other
 * with a ref, and the two could disagree for a frame.
 */
export function aerialFigures(
  director: DirectorState, band: CrowdBand, darkMode: boolean, allowAir = true,
): FieldFigure[] {
  if (!allowAir) return [];
  return actorsOf(director, sceneGroundY(band), band.scale)
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

/**
 * Is this agent the TREE canvas's business this frame?
 *
 * THE partition predicate. `crowdFigures` and `treeFigures` both call it, so the two cannot
 * disagree about who they are drawing -- which is exactly how an airborne bobit came to be
 * painted on two canvases at once. One question, one answer, both readers.
 *
 * A perched agent whose Surface is NOT in the list is NOT the tree's: the tree has gone (a
 * resize below MIN_TREE_MARGIN, a different collection), and he falls back to the floor.
 */
function onTheTree(a: Agent, surfaces: readonly Surface[]): boolean {
  if (!a.perchId) return false;
  if (!surfaces.some(sf => sf.id === a.perchId)) return false;
  return a.activity === 'perch' || a.activity === 'climbing' || a.activity === 'descending';
}

/**
 * The tree canvas's figures: everyone perched on it, climbing it or coming down it.
 *
 * Coordinates are the TREE CANVAS's, not the band's -- the Surfaces are already in them, since
 * CollectionCrowd builds them from `marginTreeX(marginBox.width, scale)`. Figures are drawn at
 * BAND scale on a tree-scale canvas, so a climber reads as a normal bobit in a big tree rather
 * than as a giant. `FieldFigure.scale` is per figure, which is what makes that free.
 */
export function treeFigures(
  state: CrowdState,
  agents: AgentState,
  band: CrowdBand,
  darkMode: boolean,
  surfaces: readonly Surface[],
  treeScale: number | null,
): FieldFigure[] {
  if (surfaces.length === 0 || treeScale === null) return [];
  void state;

  const out: FieldFigure[] = [];
  for (const id of Object.keys(agents)) {
    const a = agents[id];
    if (!onTheTree(a, surfaces)) continue;
    const sf = surfaces.find(s => s.id === a.perchId) as Surface;

    if (a.activity === 'perch') {
      out.push({
        id,
        anim: 'sit',
        color: figColor(toneOf(id), darkMode),
        // He sits along the branch's middle rather than wherever he happened to stop.
        x: (sf.left + sf.right) / 2,
        groundY: sf.y,
        scale: band.scale * heightFactor(id),
        // Phase from the id, so neighbours never breathe in lockstep -- the same derivation
        // crowdFigures uses, so a bobit's rhythm does not change when he leaves the band.
        phase: (hashId(id) % 1000) / 250,
        flip: a.dir === -1,
        poofable: false,
        greetable: true,
        // A seated figure MUST carry a seated hoverAnim: bounds measure from the BASE anim
        // while paint positions with the RESOLVED one.
        hoverAnim: 'greetseat',
      });
      continue;
    }

    // Climbing or descending. Position comes from the climb's own recorded endpoints, NOT from
    // the Surface -- reading the Surface here is what made the old transition a teleport. And
    // not from `band` either: these are the TREE canvas's coordinates, where the floor is ~868
    // rather than 90, so a band-derived fallback would start him 770px from his own feet.
    const dur = a.climbDur ?? CLIMB_MIN_SEC;
    const { up, out: along } = climbProgress(dur > 0 ? (a.climbT ?? 0) / dur : 1);
    const fromY = a.climbFromY as number;
    const toY = a.climbToY as number;
    const fromX = a.climbFromX as number;
    const toX = a.climbToX as number;

    out.push({
      id,
      anim: 'climb',
      color: figColor(toneOf(id), darkMode),
      x: fromX + (toX - fromX) * along,
      groundY: fromY + (toY - fromY) * up,
      scale: band.scale * heightFactor(id),
      phase: (hashId(id) % 1000) / 250,
      // Facing the trunk he is clinging to, rather than climbing it back-first.
      flip: (sf.rootX ?? (sf.left + sf.right) / 2) < fromX,
      poofable: false,
      // No greeting mid-climb, and NO hoverAnim: `climb` is standing, and a seated hover pose
      // on a standing base is drawn ~104 units from where this put him.
      greetable: false,
    });
  }
  return out;
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
  /**
   * Surfaces a bobit may be sitting on. Empty when the room has no tree.
   *
   * A perched agent whose Surface is NOT in this list falls back to the floor rather than to
   * nothing: scenery can disappear -- a narrower viewport, a different collection, a tree that
   * belongs to a room this player has left -- and a bobit must not go with it.
   */
  surfaces: readonly Surface[] = [],
  /**
   * Surfaces belonging to the TREE CANVAS, not to the band.
   *
   * NOT drawn here -- `treeFigures` has them. They are passed in only so anybody sitting on
   * one, or climbing to one, can be left out of the band entirely. Two stages, two lists, and
   * an agent's `perchId` belongs to exactly one of them: the in-band fallback tree's branch
   * arrives as `surfaces` and is drawn here, the margin tree's three arrive as this and are
   * not. Conflating the two made the fallback tree's occupant disappear, because he was
   * excluded from the band and handed to a canvas that is not mounted in that case.
   */
  treeSurfaces: readonly Surface[] = [],
): FieldFigure[] {
  // Actors the director owns, indexed by the agent playing them. A cast agent is drawn from
  // its ACTOR -- pose and position both -- so the director and wanderAdvance can never fight
  // over where it is.
  const staged = new Map<string, ReturnType<typeof actorsOf>[number]>();
  const orphans: ReturnType<typeof actorsOf>[number][] = [];
  /**
   * Agents the OVERLAY is drawing this frame. They must be left out of the band entirely.
   *
   * Handing an airborne actor to the overlay is not the same as having nobody to draw: his
   * agent still exists, and simply skipping the actor left the agent to be drawn the ordinary
   * way -- so the bobit appeared twice for the whole flight, once arcing over the question card
   * and once standing wherever his agent happened to be. The design forbids that double-paint
   * explicitly, and it was visible in a screenshot of every cannon shot.
   */
  const onOverlay = new Set<string>();
  if (director) {
    for (const raw of actorsOf(director, sceneGroundY(band), band.scale)) {
      let a = raw;
      if (a.layer === 'air') {
        if (allowAir) {                                  // the overlay's business
          if (a.agentId) onOverlay.add(a.agentId);
          continue;
        }
        // Grounded fallback: keep him inside the band rather than letting him fly off it.
        a = { ...a, y: Math.max(highestFeet(band), a.y) };
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
    if (onOverlay.has(id)) continue;
    const a = agents[id];
    // The TREE canvas has this one, not the band: perched on it, climbing it, or coming down.
    // One predicate, both readers -- see `onTheTree`.
    if (onTheTree(a, treeSurfaces)) continue;
    const victim = state.loss?.id === id;
    // Sitting on a BAND surface -- the in-band fallback tree's single branch. `perchId` is
    // claimed the moment he sets off walking, so only an agent who has actually ARRIVED
    // (activity 'perch') is drawn off the floor.
    const perch = a.activity === 'perch' && a.perchId
      ? surfaces.find(sf => sf.id === a.perchId)
      : undefined;

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
      // The band's own branch decides both, and he sits along its middle rather than at the x
      // he happened to walk in from. Anybody on the MARGIN tree left through `onTheTree` above
      // and is positioned by `treeFigures` from his climb instead.
      x: perch ? (perch.left + perch.right) / 2 : a.x,
      groundY: perch ? perch.y : groundY,
      scale: place.scale * heightFactor(id),
      // Phase from the id, so neighbours never breathe in lockstep. The stun rides on top.
      phase: (hashId(id) % 1000) / 250 - rewind,
      flip: a.dir === -1,
      poofable: false,
      greetable: true,
      // A seated figure MUST carry a seated hoverAnim. fieldGeometry documents the trap:
      // bounds measure from the BASE anim and paint positions with the RESOLVED one, so a
      // standing greet on a seated pose draws ~104 units from its own hit box.
      ...(perch ? { hoverAnim: 'greetseat' } : {}),
      vars,
    });
  }
  return out;
}
