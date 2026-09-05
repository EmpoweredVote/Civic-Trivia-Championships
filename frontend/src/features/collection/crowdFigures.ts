import type { FieldFigure } from '../../components/bobbits/fieldGeometry';
import { figColor } from '../../components/bobbits/rigExtras';
import { slotOrder, toneOf, hashId } from './crowdIdentity';
import { slotPosition, CROWD_CAP } from './crowdLayout';
import type { CrowdBand } from './crowdLayout';
import { isStunned, LOSS_RISE } from './crowdReducer';
import type { CrowdState } from './crowdReducer';

/**
 * The escalation ladder, as poses. Tier is the in-match streak, 1-5.
 *
 * Confetti is deliberately absent here: it fires only at a 5/5 finish, from the component,
 * so the top rung differs in kind and not merely in degree.
 */
export function animForTier(tier: number): string {
  switch (tier) {
    case 0: return 'standstill';
    case 1: return 'friendly';   // a nod and a wave
    case 2: return 'cheer';      // arms up
    case 3: return 'cheer';
    case 4: return 'jump';
    default: return 'dance';
  }
}

/** How many owned bobits are not being rendered because of the cap. */
export function overflowCount(state: CrowdState): number {
  return Math.max(0, state.residents.length - CROWD_CAP);
}

/**
 * `t` is the field's shared clock. Nothing here reads it directly -- pose timing reaches the
 * canvas through each figure's `phase`, and the stun's rewind is expressed against the stun's
 * own elapsed time rather than against wall time, which keeps it exact in floating point. It
 * stays in the signature because it is the field's per-frame contract and because the arrival
 * and celebration work that will read it lives one change away.
 */
export function crowdFigures(
  state: CrowdState, _t: number, band: CrowdBand, darkMode: boolean,
): FieldFigure[] {
  const ordered = slotOrder(state.residents);
  const shown = ordered.slice(0, CROWD_CAP);
  const total = shown.length;

  // While the room is stunned every figure holds its pose. The field paints a figure at
  // `t + phase`, so the freeze has to reach it through the phase: rewinding by exactly how
  // long the stun has run pins `t + phase` at the value it had the instant the stun began,
  // since the two advance together. Continuous at onset -- the stun's clock starts at zero.
  const rewind = isStunned(state) && state.loss ? state.loss.t : 0;

  const out: FieldFigure[] = [];
  for (let i = 0; i < total; i++) {
    const id = shown[i];
    const pos = slotPosition(i, total, band);
    const arriving = state.arriving[id] !== undefined;
    const victim = state.loss?.id === id;

    let anim: string;
    if (victim) anim = 'fall';                      // limp, being lifted
    else if (arriving) anim = 'friendly';           // walks in and waves
    else if (state.celebrant === id && state.celebrating > 0) {
      // Whoever this answer belongs to celebrates one rung harder than the room -- that is
      // what a repeat correct answer looks like when it spawns nobody.
      anim = animForTier(Math.min(5, state.celebrating + 1));
    } else anim = animForTier(state.celebrating);

    let groundY = pos.groundY;
    if (victim && state.loss?.phase === 'rising') {
      // Floats up, accelerating, over the rise. He is drawn until the burst takes him.
      const k = Math.min(1, state.loss.t / LOSS_RISE);
      groundY -= k * k * (band.height * 1.6);
    }

    out.push({
      id,
      anim,
      color: figColor(toneOf(id), darkMode),
      x: pos.x,
      groundY,
      scale: band.scale,
      // Phase from the id, so neighbours never move in lockstep and a given bobit always
      // breathes on his own beat. The stun's rewind rides on top of it.
      phase: (hashId(id) % 1000) / 250 - rewind,
      flip: hashId(id) % 2 === 0,
      poofable: false,
      greetable: false,
    });
  }
  return out;
}
