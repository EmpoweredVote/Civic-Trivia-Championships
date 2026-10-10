import { useEffect, useMemo, useState } from 'react';
import { BobitField } from '../../components/bobbits/BobitField';
import type { FieldFigure, FieldProp } from '../../components/bobbits/fieldGeometry';
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
import { createPeakStore } from './bobitPeak';
import { linesBuilt } from './tableau/tableauProgress';
import { fitScale, originX } from './tableau/tableauGeometry';
import { tableauSurfaces } from './tableau/tableauSurfaces';

/**
 * The localStorage driver, shared across every signed-out mount: its state IS the browser's,
 * so there is nothing per-instance about it and rebuilding it would only re-read storage.
 */
const localStore = createLocalProgressStore();

/** The same high-water mark the play screen builds from, so both screens agree. */
const peakStore = createPeakStore();

/**
 * How much of the band's width each stack is allowed, as a fraction.
 *
 * The middle is left clear for the celebrating crowd, which is what this screen is for. The
 * stacks frame it rather than competing with it.
 */
const STACK_FRACTION = 1 / 3;

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

  /**
   * How much of the tableau is standing, from the SAME high-water mark the play screen uses.
   *
   * Read from the peak rather than from `owned.length` so the two screens cannot disagree: a
   * player who lost a bobit this match still sees everything he has ever built.
   */
  const built = useMemo(() => (slug ? linesBuilt(peakStore.peak(slug)) : 0), [slug]);

  /**
   * The tableau, STATIC, behind the celebrating crowd.
   *
   * Static on purpose. The recap's governing decision is that nothing on it reads the match
   * result -- the room celebrates whether you won or lost -- and a crew working through the
   * celebration contradicts that. This shows what is built; it does not run the worksite.
   *
   * SCALED BY HEIGHT, which is the binding constraint: the band is 96px and in document flow,
   * and the recap page already overflows its viewport at 390px by 246px, so making it taller
   * to fit a bigger tableau would worsen a bug that predates the bobits entirely. The result
   * is a small, distant skyline, which is the right register for a backdrop.
   *
   * `fitScale` rather than `tableauScale`: the margin minimum exists because a strip narrower
   * than 140px beside a QUESTION COLUMN cannot hold a legible tableau and the crowd is the
   * fallback. There is no column here and no fallback, and applying it would hide the tableau
   * from exactly the phone players this screen exists to show it to.
   */
  /**
   * The tableau's geometry on the recap, resolved ONCE and read by both the props and the
   * figures. Two readers computing it separately is how a draw and its Surfaces drift apart.
   */
  const stacks = useMemo(() => (measured: number) => {
    if (built <= 0) return null;
    const sideW = Math.floor(measured * STACK_FRACTION);
    const box = { width: sideW, height: band.height };
    const s = fitScale(box, box);
    if (s === null) return null;
    return {
      s,
      sideW,
      leftOx: originX('left', sideW, s),
      rightOx: (measured - sideW) + originX('right', sideW, s),
      groundY: band.height - groundLineFromBottom(),
    };
  }, [built, band]);

  const propsFor = useMemo(() => (
    _t: number, _dt: number, width: number,
  ): FieldProp[] => {
    const measured = width || band.width;
    const g = stacks(measured);
    if (g === null) return [];
    const s = g.s;
    const color = darkMode ? '#9AA6B8' : '#4A5568';
    const leafColor = darkMode ? '#7FB069' : '#4F7942';
    return [
      {
        id: 'recap:tableau:left', kind: 'tableau', side: 'left', built,
        x: g.leftOx, groundY: g.groundY, scale: s, color, leafColor,
      },
      {
        // Drawn in the RIGHT-hand third, so its own origin is offset by everything to its left.
        id: 'recap:tableau:right', kind: 'tableau', side: 'right', built,
        x: g.rightOx, groundY: g.groundY, scale: s, color, leafColor,
      },
    ];
  }, [built, band, darkMode, stacks]);

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

    /**
     * Who is UP ON the tableau rather than on the floor, as the spec asks: "Surfaces are
     * still live, so celebrating bobits can be up on the structures."
     *
     * Placed STATICALLY, not climbed. This screen has no agents at all and deliberately so --
     * it needs none of the play screen's director, entrances or perch machinery. A seat here
     * is a position, not a journey.
     *
     * The occupants are chosen by the same `slotOrder` the roster already uses, so the same
     * bobits sit in the same places on every render of the same room rather than reshuffling
     * each frame.
     */
    const g = stacks(measured);
    const seats = new Map<string, { x: number; y: number }>();
    if (g !== null) {
      const surfaces = [
        ...tableauSurfaces('left', built, g.leftOx, g.groundY, g.s),
        ...tableauSurfaces('right', built, g.rightOx, g.groundY, g.s),
      ];
      // Nobody who is BOWING: a bower is the point of the recap and belongs where he can be
      // seen, not tucked up a tree at a twelfth of the height.
      const candidates = shown.filter(id => !newBobitIds.has(id));
      surfaces.forEach((sf, i) => {
        const id = candidates[i];
        if (id === undefined) return;
        seats.set(id, { x: (sf.left + sf.right) / 2, y: sf.y });
      });
    }

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
      const seat = seats.get(id);
      const pose = seat
        // A seated figure MUST have a seated pose and a seated hover pose: `figureBounds`
        // measures from the BASE anim while paint positions with the RESOLVED one, so a
        // standing greet on a seated base draws ~104 units from its own hit box.
        ? { anim: 'sit' as const, hand: null }
        : recapPose(id, elapsed, newBobitIds.has(id), hands.get(id) ?? null);
      return {
        id,
        anim: pose.anim,
        hoverAnim: seat ? 'greetseat' : undefined,
        color: figColor(toneOf(id), darkMode),
        x: seat ? seat.x : xs.get(id) as number,
        groundY: seat ? seat.y : place.groundY,
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
  }, [shown, newBobitIds, band, darkMode, stacks, built]);

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
        propsFor={propsFor}
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
