import { useEffect, useMemo, useState } from 'react';
import { BobitField } from '../../components/bobbits/BobitField';
import type { FieldFigure } from '../../components/bobbits/fieldGeometry';
import { figColor } from '../../components/bobbits/rigExtras';
import { useAuthStore } from '../../store/authStore';
import { createLocalProgressStore, createServerProgressStore } from './bobitProgress';
import type { BobitProgressStore } from './bobitProgress';
import { toneOf, hashId, slotOrder } from './crowdIdentity';
import { heightFactor } from './crowdFigures';
import { pairUp } from './crowdReactions';
import {
  bandFor, CROWD_CAP, groundLineFromBottom, agentPlacement, bandHeadroomSpare,
} from './crowdLayout';
import { recapPose } from './recapPoses';

/**
 * The localStorage driver, shared across every signed-out mount: its state IS the browser's,
 * so there is nothing per-instance about it and rebuilding it would only re-read storage.
 */
const localStore = createLocalProgressStore();

/** How close two bobits must be to slap hands, in rig units. Matches crowdFigures. */
const HIGHFIVE_REACH_UNITS = 160;

/**
 * Most the band will pull itself up into the layout above it, in px.
 *
 * The recap page overflowed its viewport by 43px at 1280x800 once this band was added, and
 * the band is 96px of which only 54 can ever hold a figure. Rather than shrink the band or
 * restyle the panels, it reclaims the empty sky it is not using -- CLAMPED to
 * `bandHeadroomSpare`, so it can never rise far enough to clip a raised arm. On a phone the
 * spare is 18px, not the desktop's 42, and the clamp handles that without a breakpoint.
 */
export const MAX_LIFT_PX = 24;

interface RecapCrowdProps {
  /** Collection just played. Null renders nothing. */
  slug: string | null;
  darkMode: boolean;
  isMobile: boolean;
  /**
   * Bobits EARNED in the session just finished. These bow; everybody else is the audience.
   * Empty is a real and correct case -- a replay of familiar questions grants nobody.
   */
  newBobitIds: ReadonlySet<string>;
}

/**
 * The room, at the end of the match, celebrating.
 *
 * NOT `CollectionCrowd` with a mode flag. The recap needs none of that component's scene
 * director, entrances, aerial overlay, milestone latch, tree or answer reactions, and a flag
 * would leave five of its props dead while threading a mode through a file that is live in
 * production.
 *
 * It is not a fork either: colour, height, animation phase, band size, floor line and the
 * crowd cap all come from the same shared modules the play screen uses, so a bobit is
 * recognisably himself on both screens.
 *
 * Positions are STATIC -- there are no agents here at all. The celebration is the motion.
 */
export function RecapCrowd({ slug, darkMode, isMobile, newBobitIds }: RecapCrowdProps) {
  const userId = useAuthStore(s => s.user?.id ?? null);
  const [owned, setOwned] = useState<string[]>([]);

  const store: BobitProgressStore = useMemo(
    () => (userId ? createServerProgressStore() : localStore),
    [userId],
  );

  const band = useMemo(() => bandFor(isMobile), [isMobile]);

  // Seed from storage. Same shape as CollectionCrowd's: hydrate if the driver has one, and
  // seed either way, so a failed fetch leaves a definite (empty) room rather than an
  // indeterminate one.
  useEffect(() => {
    if (!slug) { setOwned([]); return; }
    let cancelled = false;
    const seed = () => {
      if (cancelled) return;
      setOwned(slotOrder([...store.load(slug)]));
    };
    const pending = store.hydrate?.(slug);
    if (pending) pending.then(seed, seed);
    else seed();
    return () => { cancelled = true; };
  }, [slug, store]);

  const shown = useMemo(() => owned.slice(0, CROWD_CAP), [owned]);
  const overflow = Math.max(0, owned.length - CROWD_CAP);

  const figuresFor = useMemo(() => (
    elapsed: number, _dt: number, width: number,
  ): FieldFigure[] => {
    // `elapsed` is BobitField's own shared clock, the same one every figure phases off.
    // Accumulating dt by hand here would be a second clock that could drift from it.
    const measured = width || band.width;
    const place = agentPlacement(0, band);

    // Static placement: index across the measured width, with the same half-step inset
    // `homeSlot` uses so nobody stands flush against an edge.
    const xs = new Map<string, number>();
    shown.forEach((id, i) => {
      xs.set(id, ((i + 0.5) / Math.max(1, shown.length)) * measured);
    });

    // Pairs are recomputed every frame, which is free here because nobody moves. pairUp walks
    // ids in sorted order, so partners never flicker between each other mid-slap, and it
    // returns each pair LEFT FIRST -- the left one reaches RIGHT and vice versa.
    //
    // Only the AUDIENCE is offered partners. A bower handed a `hand` would ignore it and his
    // partner would slap at nobody.
    const hands = new Map<string, 'R' | 'L'>();
    const audience = shown.filter(id => !newBobitIds.has(id));
    for (const [left, right] of pairUp(
      audience.map(id => ({ id, x: xs.get(id) as number })),
      HIGHFIVE_REACH_UNITS * band.scale,
    )) {
      hands.set(left, 'R');
      hands.set(right, 'L');
    }

    return shown.map(id => {
      const pose = recapPose(id, elapsed, newBobitIds.has(id), hands.get(id) ?? null);
      return {
        id,
        anim: pose.anim,
        color: figColor(toneOf(id), darkMode),
        x: xs.get(id) as number,
        groundY: place.groundY,
        scale: place.scale * heightFactor(id),
        // The SECOND offset -- this one spreads the clock inside a pose, where recapPose's
        // spreads which pose. Same derivation crowdFigures uses, so a bobit's rhythm does not
        // change between the play screen and this one.
        phase: (hashId(id) % 1000) / 250,
        poofable: false,
        greetable: true,
        vars: pose.hand ? { hand: pose.hand } : undefined,
      };
    });
  }, [shown, newBobitIds, band, darkMode]);

  if (!slug || owned.length === 0) return null;

  // Derived, never a magic number: the band cannot rise past the sky it is not using.
  const lift = Math.min(MAX_LIFT_PX, bandHeadroomSpare(band));

  return (
    <div style={{
      position: 'relative', width: '100%', flexShrink: 0, marginTop: -lift,
    }}>
      {/* The floor, faded at both ends because the band is full-bleed and a hard rule edge to
          edge would read as a divider. Same treatment as the play band's. */}
      <div
        aria-hidden
        style={{
          position: 'absolute', left: 0, right: 0,
          bottom: groundLineFromBottom(), height: 1, pointerEvents: 'none',
          background: `linear-gradient(90deg, transparent, ${
            darkMode ? 'rgba(148,163,184,0.42)' : 'rgba(71,85,105,0.38)'
          } 8%, ${
            darkMode ? 'rgba(148,163,184,0.42)' : 'rgba(71,85,105,0.38)'
          } 92%, transparent)`,
        }}
      />
      <BobitField
        figures={[]}
        figuresFor={figuresFor}
        height={band.height}
        interactive
      />
      {overflow > 0 && (
        <span
          style={{
            position: 'absolute', left: 8, bottom: 4,
            fontFamily: "'Manrope', sans-serif", fontSize: isMobile ? 10 : 12,
            fontWeight: 600, opacity: 0.55,
            color: darkMode ? '#94A3B8' : '#4B5768',
          }}
        >
          +{overflow} more
        </span>
      )}
    </div>
  );
}
