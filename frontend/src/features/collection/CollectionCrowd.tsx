import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { BobitField } from '../../components/bobbits/BobitField';
import type { FieldFigure, FieldProp, FieldEffect } from '../../components/bobbits/fieldGeometry';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useWindowSize } from '../../hooks/useWindowSize';
import { useAuthStore } from '../../store/authStore';
import { useConfettiStore } from '../../store/confettiStore';
import { createLocalProgressStore, createServerProgressStore } from './bobitProgress';
import { createPeakStore } from './bobitPeak';
import { tableauScale, originX, stackLive } from './tableau/tableauGeometry';
import type { MarginBox } from './tableau/tableauGeometry';
import { tableauSurfaces } from './tableau/tableauSurfaces';
import { linesBuilt, linesStandingOnArrival } from './tableau/tableauProgress';
import { STRUCTURES, BLUEPRINT } from './tableau/blueprint';
import type { TableauLine } from './tableau/blueprint';
import {
  buildDuration, phaseAt, crewRolesFor, siteX,
} from './tableau/buildSequence';
import { TableauMargin } from './tableau/TableauMargin';
import type { BobitProgressStore } from './bobitProgress';
import { crowdInit, crowdApply, crowdStep, isStunned } from './crowdReducer';
import type { CrowdState } from './crowdReducer';
import {
  crowdFigures, overflowCount, aerialFigures, tableauFigures, workerFigures, sceneGroundY,
} from './crowdFigures';
import {
  directorInit, directorStep, startScene, canStage, castIds,
} from './sceneDirector';
import type { DirectorState } from './sceneDirector';
import {
  sceneForArrival, ALL_SCENES, TREE_MILESTONE, TREE_MILESTONE_MOBILE,
} from './scenes';
import { ROLE_NEWCOMER } from './scenes/types';
import type { Scene } from './scenes/types';
import {
  bandFor, CROWD_CAP, wanderCastFor, groundLineFromBottom, overlayHeightFor, overlayOffset,
} from './crowdLayout';
import {
  initAgents, agentsAdvance, syncCast, rotateCast, makeRand, rescaleTo, placeReleased,
  nearestAgent, assignPerch, assignJob, releaseJob,
} from './crowdAgents';
import type { AgentState, Activity } from './crowdAgents';
import type { Surface } from '../../components/bobbits/fieldGeometry';
import type { Rand } from '../../components/bobbits/wanderReducer';
import type { CrowdBand } from './crowdLayout';

interface CollectionCrowdProps {
  /** Collection being played. Null before a session exists. */
  slug: string | null;
  darkMode: boolean;
  isMobile: boolean;
  /** The most recent revealed answer. A new object identity means a new answer to react to. */
  lastAnswer: { questionId: string; correct: boolean; streak: number } | null;
  /** True once the match ends with every question correct. */
  finished5of5: boolean;
  /**
   * True only while an answer is revealed.
   *
   * Gates the aerial overlay. Nothing may pass in front of the question card while the timer
   * is running and the player is aiming at an answer -- bound 2 of the four the spec's
   * 2026-09-14 addendum puts on the occlusion relaxation.
   */
  aerialAllowed?: boolean;
  /**
   * The empty strips either side of the question column, measured by GameScreen.
   *
   * GameScreen owns that column, so GameScreen measures them -- this component does not reach
   * up into its parent's layout. Null until the first measurement, and ignored on mobile.
   */
  leftMargin?: MarginBox | null;
  rightMargin?: MarginBox | null;
  /**
   * Fired once for each bobit the player EARNS in this session -- a correct answer to a
   * question this collection had not already given him.
   *
   * Exists so the recap screen knows who to have bow. It deliberately reuses the decision this
   * component already makes to choose an entrance, rather than letting the recap take its own
   * snapshot of the owned set: a second snapshot would race `hydrate()` for signed-in players,
   * and would be a second opinion about who is new that could disagree with the entrance the
   * player actually watched.
   */
  onBobitEarned?: (questionId: string) => void;
}

/**
 * The localStorage driver, shared across every signed-out mount: its state IS the browser's,
 * so there is nothing per-instance about it and rebuilding it would only re-read storage.
 */
const localStore = createLocalProgressStore();

/**
 * The milestone latch. Local even for signed-in players -- see bobitPeak.ts for why, and what
 * it costs (a tree re-earned after a browser change).
 */
const peakStore = createPeakStore();

/** Stable identity, so "nothing is flying" never causes a re-render. */
const NO_AERIAL = { figures: [] as FieldFigure[], dx: 0, dy: 0 };

/**
 * The collection crowd: one bobit per question this player has answered correctly, standing
 * in a band beneath the game.
 *
 * Never an overlay. The band sits in normal document flow so it cannot cover the question or
 * the answer options -- a hard requirement, and layout is the only way to guarantee it rather
 * than merely arrange it.
 */
/**
 * Fill a scene's roles from bobits who already live here.
 *
 * `startScene` invents a synthetic id for any role an override does not cover, and a synthetic
 * id renders as an ORPHAN -- a bobit who appears from nowhere, performs, and evaporates. That
 * was the cannon's phantom host. A scene whose roles are all existing residents, like the
 * milestone, would otherwise produce one phantom per role.
 *
 * `newcomer` is never cast here: `startScene` owns that name and fills it with the arriving
 * bobit's own id. A scene with no arrival must not use it as a role name, and `scenes.test.ts`
 * asserts the milestone does not.
 */
function castFromRoom(
  director: DirectorState, agents: AgentState, scene: Scene, width: number, newcomerId: string,
): Record<string, string> {
  const slot = canStage(director, scene.span, width);
  if (!slot) return {};
  const mid = (slot.left + slot.right) / 2;
  const taken = new Set([...castIds(director), newcomerId]);
  const out: Record<string, string> = {};
  for (const role of scene.roles) {
    if (role === ROLE_NEWCOMER) continue;
    const id = nearestAgent(agents, mid, taken);
    if (!id) break;                 // nobody left; startScene falls back to a synthetic id
    out[role] = id;
    taken.add(id);                  // two roles must never be played by the same bobit
  }
  return out;
}

export function CollectionCrowd({
  slug, darkMode, isMobile, lastAnswer, finished5of5, aerialAllowed = false,
  leftMargin = null, rightMargin = null, onBobitEarned,
}: CollectionCrowdProps) {
  const reducedMotion = useReducedMotion();
  // Resize-aware rather than a one-off window.innerHeight read: the overlay's height is a
  // fraction of the viewport, and a stale one would put the arc's ceiling in the wrong place.
  const { height: viewportH } = useWindowSize();
  const fireFireworks = useConfettiStore(s => s.fireFireworks);
  const userId = useAuthStore(s => s.user?.id ?? null);
  const stateRef = useRef<CrowdState>(crowdInit());
  const agentsRef = useRef<AgentState>({});
  const rotateRef = useRef(0);
  // The width the current layout was built for. Agents are seeded before the field has measured
  // itself, so this starts nominal and is corrected on the first real frame.
  const laidOutAtRef = useRef(0);
  const directorRef = useRef<DirectorState>(directorInit());
  // Read inside the frame loop, so the gate can change without rebuilding the loop.
  const allowAirRef = useRef(aerialAllowed);
  // Air actors are published from the frame loop for React to mount the overlay with. Kept as
  // STATE rather than a ref because mounting the overlay is a render, not a paint.
  /**
   * Airborne figures AND the band-to-overlay offset they were measured against, in one piece of
   * state. Splitting them would let a frame paint this tick's figures against last tick's
   * offset, which is a one-frame jump in exactly the place this mapping exists to prevent.
   */
  const [aerial, setAerial] = useState<{ figures: FieldFigure[]; dx: number; dy: number }>(
    NO_AERIAL,
  );
  const wrapRef = useRef<HTMLDivElement>(null);
  // Random by default; seedable via ?bobitSeed= so the screenshot sweep and the bench get the
  // SAME room every run. Math.random cannot be seeded, and a verification pass that cannot
  // reproduce its own input is not a verification pass.
  const randRef = useRef<Rand>(makeRand(
    new URLSearchParams(window.location.search).get('bobitSeed'),
  ));
  const [overflow, setOverflow] = useState(0);
  /**
   * Lines of the tableau standing, from the high-water mark.
   *
   * A ref, not state: the canvases read it per frame through `builtFor`, and a value that
   * crossed a prop boundary would be frozen at the last React render while the room advances
   * on the rAF clock. That is exactly how the tree's sprout once stalled part-grown.
   *
   * No `earned` latch and no `grow` clock any more. The tree had both because it arrived whole
   * at a threshold; the tableau arrives a line at a time and `linesBuilt` is the whole of it.
   */
  const builtRef = useRef(0);
  /**
   * Which structure was complete last time we looked, so completing one can be celebrated.
   *
   * -1 rather than 0 so that "nothing finished yet" is distinguishable from "the cabin is
   * finished", and so a seed can set it without firing a ceremony for work done weeks ago.
   */
  const lastStructureRef = useRef(-1);
  /**
   * How many lines the player has actually WATCHED go up, and the line in flight.
   *
   * `shownRef` is seeded to whatever was already earned when the collection opens, so a
   * returning player finds his tableau standing rather than watching fifteen build sequences
   * run back to back for three and a half minutes of a match in which he earned none of them.
   * Only lines earned on camera are built on camera.
   */
  const shownRef = useRef(0);
  const shownSlugRef = useRef<string | null>(null);
  const siteRef = useRef<{ n: number; t: number } | null>(null);
  /** Resolved once per frame from `siteRef`, so the figures and the canvases cannot disagree. */
  const siteForRef = useRef<{ line: TableauLine; t: number } | null>(null);
  /**
   * Each stack's climbable surfaces, in ITS canvas's coordinates. Recomputed each frame: the
   * measured margins change with the viewport, so a Surface cached at mount would leave a
   * perched bobit sitting in mid-air after a resize.
   */
  const leftSurfacesRef = useRef<Surface[]>([]);
  const rightSurfacesRef = useRef<Surface[]>([]);
  /** Each margin canvas's figures, published from the frame loop for TableauMargin to paint. */
  const leftFiguresRef = useRef<FieldFigure[]>([]);
  const rightFiguresRef = useRef<FieldFigure[]>([]);
  /**
   * Forces a repaint of the band when it is NOT animating.
   *
   * Under reduced motion there is no frame loop to pick changes up, so every edit that would
   * otherwise be drawn on the next frame -- the initial seed, a bobit granted or lost mid-match
   * -- has to say so explicitly.
   */
  const [repaintKey, setRepaintKey] = useState(0);
  const repaint = useCallback(() => setRepaintKey(k => k + 1), []);

  // Signed in: progress lives on the account. Signed out: it lives in this browser, exactly
  // as it has since Stage 3. Keyed on the user id rather than merely on truthiness, so
  // switching accounts builds a fresh store and one player's crowd can never be served to
  // the next.
  const store: BobitProgressStore = useMemo(
    () => (userId ? createServerProgressStore() : localStore),
    [userId],
  );

  const band: CrowdBand = useMemo(() => bandFor(isMobile), [isMobile]);
  const height = band.height;

  /**
   * How big the tableau is, or null for "no room -- no tableau at all".
   *
   * ONE scale for both stacks, so the cabin is not drawn larger than the tree beside it. Mobile
   * is null unconditionally: a phone has no strips beside the question column to build in, and
   * the spec sends it to the crowd celebration instead.
   */
  const scale = useMemo(
    () => (isMobile ? null : tableauScale(leftMargin ?? null, rightMargin ?? null)),
    [leftMargin, rightMargin, isMobile],
  );

  /**
   * Mirrored for the frame loop, in LAYOUT effects rather than passive ones.
   *
   * The loop runs on rAF and a passive effect can land after it, which would paint one frame of
   * figures against the previous frame's geometry. That is the same fix the aerial gate needed
   * after it was found leaving the sky open for a frame past the end of a reveal.
   */
  const leftBoxRef = useRef<MarginBox | null>(leftMargin);
  const rightBoxRef = useRef<MarginBox | null>(rightMargin);
  const scaleRef = useRef<number | null>(scale);
  useLayoutEffect(() => { leftBoxRef.current = leftMargin ?? null; }, [leftMargin]);
  useLayoutEffect(() => { rightBoxRef.current = rightMargin ?? null; }, [rightMargin]);
  useLayoutEffect(() => { scaleRef.current = scale; }, [scale]);

  /**
   * Tell the latch how many bobits the room holds, and recompute what is standing.
   *
   * Called wherever the resident list changes -- the seed, and every answer. Recording is
   * monotonic, so calling it with a smaller number after a loss is a no-op by design: a house
   * that un-builds itself when you miss a question punishes twice and reads as a bug.
   *
   * `questionCount` is no longer read at all. The tableau is driven by an absolute bobit count,
   * which deletes a whole failure mode -- the tree earned nothing while the denominator was
   * still in flight, and needed a `settled` latch to tell "inherited" from "just happened".
   */
  const syncMilestone = useCallback((slugNow: string | null) => {
    if (!slugNow) { builtRef.current = 0; lastStructureRef.current = -1; return; }
    peakStore.record(slugNow, stateRef.current.residents.length);
    builtRef.current = linesBuilt(peakStore.peak(slugNow));

    // Under reduced motion there is no worksite to advance `shownRef`, so it is snapped to
    // what has been earned and the line simply APPEARS. Reconciliation happens either way --
    // only MOTION is skipped -- and without this the tableau would stop growing entirely for
    // an accessible player, which is not the same thing as not animating.
    if (reducedMotion) {
      shownRef.current = builtRef.current;
      siteRef.current = null;
    }

    // First look at THIS collection: everything already earned is already standing, and no
    // build is owed for it. Keyed on the slug so switching collections re-seeds rather than
    // carrying one room's progress into another's.
    if (shownSlugRef.current !== slugNow) {
      shownSlugRef.current = slugNow;
      shownRef.current = linesStandingOnArrival(peakStore.peak(slugNow));
      siteRef.current = null;
    }

    // A COMPLETED STRUCTURE is the moment worth marking. The tree had one ceremony because it
    // had one threshold; the tableau has six, which is the same promise kept more often. On a
    // phone, where there is no tableau to watch, this is the only sign that anything happened
    // -- cutting it would leave a phone player with nothing but pool entrances.
    const done = STRUCTURES.filter(s => s.to <= builtRef.current).length - 1;
    const crossedLive = done > lastStructureRef.current && lastStructureRef.current >= 0;
    lastStructureRef.current = Math.max(lastStructureRef.current, done);
    if (crossedLive && !reducedMotion) {
      const w = laidOutAtRef.current || band.width;
      const scene = isMobile ? TREE_MILESTONE_MOBILE : TREE_MILESTONE;
      if (canStage(directorRef.current, scene.span, w)) {
        directorRef.current = startScene(
          directorRef.current, scene, `milestone-${Date.now()}`, w, randRef.current,
          castFromRoom(directorRef.current, agentsRef.current, scene, w, ''),
        );
      }
    }
  }, [reducedMotion, band, isMobile]);


  // Seed from storage whenever the collection -- or the driver behind it -- changes.
  useEffect(() => {
    if (!slug) {
      stateRef.current = crowdInit();
      agentsRef.current = {};
      directorRef.current = directorInit();
      setAerial(NO_AERIAL);
      setOverflow(0);
      return;
    }

    let cancelled = false;
    const seed = () => {
      // A hydrate that lands after the collection changed must not seed the wrong crowd.
      if (cancelled) return;
      const owned = [...store.load(slug)];
      stateRef.current = crowdApply(stateRef.current, { type: 'seed', ids: owned });
      // A returning player's bobits are already standing there when he arrives -- they do not
      // walk in. Entrances belong to bobits earned in front of you.
      agentsRef.current = initAgents(
        stateRef.current.residents.slice(0, CROWD_CAP),
        { band, width: band.width, greeting: new Set(), frozen: false, rand: randRef.current },
      );
      rotateRef.current = 0;
      laidOutAtRef.current = band.width;
      // A returning player's bobits are already standing there. Seeding must never fire the
      // entrances -- forty owned questions would otherwise mean forty cannon shots on load.
      directorRef.current = directorInit();
      // Everything already earned is already STANDING, and no ceremony is owed for it. -1 is
      // "not looked yet", so the first syncMilestone below records where this collection
      // starts rather than celebrating six structures a returning player built weeks ago.
      lastStructureRef.current = -1;
      shownSlugRef.current = null;          // force syncMilestone to re-seed what is standing
      setOverflow(overflowCount(stateRef.current));
      syncMilestone(slug);
      repaint();
    };

    // No-op for the local driver, which has no hydrate: its mirror is already the truth.
    // Seeds either way -- a failed hydrate must still leave a definite (empty) crowd rather
    // than an indeterminate band.
    const pending = store.hydrate?.(slug);
    if (pending) pending.then(seed, seed);
    else seed();

    return () => { cancelled = true; };
  }, [slug, store, band]);

  // React to a revealed answer. Keyed on object identity, so the same question answered again
  // in a later match still registers.
  useEffect(() => {
    if (!slug || !lastAnswer) return;
    const { questionId, correct, streak } = lastAnswer;
    if (correct) {
      // The ordinal is how many this collection had already given the player, so 0 is the very
      // first ever. Captured BEFORE the grant, and only a genuinely new bobit gets an entrance
      // -- a question answered correctly a second time spawns nobody.
      const ordinal = stateRef.current.residents.length;
      const known = stateRef.current.residents.includes(questionId);
      // Report the earn from the SAME test that decides whether he gets an entrance, so
      // "walked in" and "bows at the recap" can never disagree about who is new.
      //
      // NOT gated on reducedMotion, unlike the entrance below: a player with reduced motion
      // still earns the bobit and still deserves to see him on the recap. Only the ENTRANCE
      // is a motion effect.
      if (!known) onBobitEarned?.(questionId);
      stateRef.current = crowdApply(stateRef.current, { type: 'correct', id: questionId, streak });
      store.grant(slug, questionId);
      if (!known && !reducedMotion) {
        const scene = sceneForArrival(ordinal, randRef.current);
        const w = laidOutAtRef.current || band.width;
        if (canStage(directorRef.current, scene.span, w)) {
          directorRef.current = startScene(
            directorRef.current, scene, questionId, w, randRef.current,
            castFromRoom(directorRef.current, agentsRef.current, scene, w, questionId),
          );
        }
      }
    } else {
      stateRef.current = crowdApply(stateRef.current, { type: 'wrong', id: questionId });
      // Revoke unconditionally: revoking something never owned is a no-op, and checking first
      // would duplicate the reducer's own ownership test.
      store.revoke(slug, questionId);
    }
    setOverflow(overflowCount(stateRef.current));
    syncMilestone(slug);
    repaint();
  }, [lastAnswer, slug, store, repaint, syncMilestone, onBobitEarned]);

  // LAYOUT effect, so the ref is current before the next animation frame rather than after it.
  // The frame loop runs on rAF; a passive effect can land after that, which would leave the
  // sky open for one frame past the end of the reveal -- a small breach of bound 2, but bound
  // 2 is the one that says nothing may cross the card while the timer runs.
  useLayoutEffect(() => { allowAirRef.current = aerialAllowed; }, [aerialAllowed]);

  // No `questionCount` dependency any more: the tableau is driven by an absolute bobit count,
  // so there is no denominator to wait on. That removed the re-run this effect used to need
  // when the collection fetch landed -- and with it the whole "settled" latch that existed to
  // tell an inherited milestone from one just crossed.
  useEffect(() => { syncMilestone(slug ?? null); }, [slug, syncMilestone]);

  // Dev replay. The set pieces fire once per collection EVER, so there is otherwise no way to
  // see one twice -- not for building them, and not for reviewing them. That is why the spec
  // calls this a requirement rather than a convenience.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const w = window as unknown as { __bobitScene?: (id: string) => void };
    w.__bobitScene = (id: string) => {
      const scene = ALL_SCENES.find(sc => sc.id === id);
      if (!scene) {
        // eslint-disable-next-line no-console
        console.warn('[bobits] no such scene:', id, '— have:', ALL_SCENES.map(sc => sc.id));
        return;
      }
      const w2 = laidOutAtRef.current || band.width;
      const newcomer = `replay-${Date.now()}`;
      directorRef.current = startScene(
        directorRef.current, scene, newcomer, w2, randRef.current,
        castFromRoom(directorRef.current, agentsRef.current, scene, w2, newcomer),
      );
    };
    return () => { delete w.__bobitScene; };
  }, [band]);

  // Confetti belongs to the finish, not to a tier.
  useEffect(() => {
    if (finished5of5 && !reducedMotion) fireFireworks();
  }, [finished5of5, reducedMotion, fireFireworks]);

  const figuresFor = useMemo(() => (
    _t: number, dt: number, width: number, greeting: ReadonlySet<string>,
  ): FieldFigure[] => {
    // Reconciliation happens either way. Only MOTION is skipped under reduced motion: an agent
    // still has to exist for a resident, or the accessible path renders an empty band rather
    // than a still one, which is not the same thing and is not what the spec asks for.
    const measured = width || band.width;
    /**
     * ONE read of the tableau's geometry per frame, feeding the surfaces, the perch assignment
     * and all three figure lists.
     *
     * Read here rather than at each use for the same reason the aerial gate is: readers that
     * each fetch their own copy can disagree about a frame, and the partition between the
     * canvases only holds while they agree.
     */
    const s = scaleRef.current;
    const lBox = leftBoxRef.current;
    const rBox = rightBoxRef.current;
    // STANDING, not earned. A seat on a line the crew is still dragging across the floor is
    // the "Surface whose wood has not arrived" failure `tableauSurfaces` exists to prevent --
    // a bobit sent to it hangs in mid-air beside it.
    const built = shownRef.current;
    // ONE predicate for "is this stack live", shared by the surfaces, the worksite, the
    // figure lists and the mount below. Four expressions that had to agree is how a canvas
    // came to be handed bobits it was never going to draw.
    const live = { left: stackLive(lBox, s), right: stackLive(rBox, s) };
    if (laidOutAtRef.current && measured !== laidOutAtRef.current) {
      agentsRef.current = rescaleTo(agentsRef.current, laidOutAtRef.current, measured);
      laidOutAtRef.current = measured;
    }
    agentsRef.current = syncCast(
      agentsRef.current, stateRef.current.residents,
      { band, width: measured, greeting, frozen: false, rand: randRef.current },
      wanderCastFor(measured, band),
    );

    if (!reducedMotion) {
      stateRef.current = crowdStep(stateRef.current, dt);

      directorRef.current = directorStep(directorRef.current, dt, sceneGroundY(band), band.scale);

      // In the coordinate system of whichever canvas holds them. An agent's perchId belongs to
      // exactly one list, which is what `canvasOf` partitions on.
      //
      // Only BUILT lines offer a seat. `tableauSurfaces` enforces that, and it is the same
      // rule the tree learned the hard way: a bobit placed on a Surface whose wood has not
      // arrived hangs in mid-air beside it, which a screenshot of a real milestone caught
      // three figures doing.
      leftSurfacesRef.current = live.left && s !== null && lBox !== null
        ? tableauSurfaces('left', built, originX('left', lBox.width, s), lBox.height, s)
        : [];
      rightSurfacesRef.current = live.right && s !== null && rBox !== null
        ? tableauSurfaces('right', built, originX('right', rBox.width, s), rBox.height, s)
        : [];

      // An agent the director owns is held exactly as a greeting one is: wanderAdvance must
      // not walk somebody a scene is choreographing, or the two fight over his position.
      const owned = castIds(directorRef.current);
      const held = owned.size ? new Set([...greeting, ...owned]) : greeting;

      const opts = {
        band,
        width: measured,
        greeting: held,
        // The abduction's freeze stops feet as well as poses. Rewinding the animation phase
        // alone would pin everyone mid-stride and then slide them across the floor.
        frozen: isStunned(stateRef.current),
        rand: randRef.current,
      };

      // AFTER syncCast, because the agent a released bobit is about to be placed on is the one
      // syncCast has just created for him, and BEFORE agentsAdvance, so his first walking frame
      // starts from his entrance's last position rather than from the seed at the band's centre.
      agentsRef.current = placeReleased(agentsRef.current, directorRef.current.released);

      rotateRef.current += dt;
      const rotated = rotateCast(agentsRef.current, rotateRef.current, opts);
      if (rotated !== agentsRef.current) { agentsRef.current = rotated; rotateRef.current = 0; }

      agentsRef.current = agentsAdvance(agentsRef.current, dt, opts);

      // ── THE WORKSITE ──────────────────────────────────────────────────────────────────
      //
      // Its own clock, not the game's: the crew keeps working while the timer runs, which is
      // what makes the margin a place rather than an event. One line at a time, in blueprint
      // order, so a player who earns four bobits at once watches them go up in sequence.
      //
      // AFTER the advance, for the same reason `assignPerch` is: a bobit released from a
      // scene or finishing a walk is eligible this frame rather than next.
      if (siteRef.current === null) {
        const next = shownRef.current < builtRef.current
          ? BLUEPRINT[shownRef.current]
          : null;
        // No crew for a stack nobody can see. Without this the worksite still ran on a phone
        // -- claiming two or three of the player's bobits every four he earned, routing them
        // to a canvas that is not mounted, and silently thinning the crowd for fourteen
        // seconds at a time.
        if (next && live[next.side]) {
          // BAND coordinates. The joint is in a margin canvas's box, which is a different one
          // -- handing `assignJob` a canvas x walks the crew into the question column.
          const after = assignJob(
            agentsRef.current, `job:${next.side}:${next.n}`, crewRolesFor(next),
            siteX(next.side, measured), opts,
          );
          // All or nothing. If the room could not spare a crew this frame, try again next:
          // a half-cast crew is a beam raising itself with one bobit watching.
          if (after !== agentsRef.current) {
            agentsRef.current = after;
            siteRef.current = { n: next.n, t: 0 };
          }
        }
      } else {
        const line = BLUEPRINT[siteRef.current.n - 1];
        const t = siteRef.current.t + dt;
        if (t >= buildDuration(line)) {
          agentsRef.current = releaseJob(agentsRef.current, `job:${line.side}:${line.n}`);
          shownRef.current = line.n;
          siteRef.current = null;
        } else {
          siteRef.current = { n: siteRef.current.n, t };
          // The crew's ACTIVITY follows the phase, so `agentAnim` stays meaningful and
          // `canvasOf` keeps them on their own stack for the whole job.
          const { phase } = phaseAt(line, t);
          const activity: Activity = phase === 'raise' ? 'raising'
            : phase === 'lash' || phase === 'curl' ? 'lashing'
            : 'hauling';
          const jobId = `job:${line.side}:${line.n}`;
          let next = agentsRef.current;
          for (const id of Object.keys(next)) {
            const a = next[id];
            if (a.jobId !== jobId || a.activity === 'moving' || a.activity === activity) {
              continue;
            }
            next = { ...next, [id]: { ...a, activity } };
          }
          agentsRef.current = next;
        }
      }

      // After the advance, so a bobit who has just been released from a scene or finished a
      // move is eligible this frame rather than next. A no-op while every seat is claimed.
      //
      // Each stack is assigned SEPARATELY, because the floor a climb starts from is that
      // canvas's own height and the two canvases are not the same box. Not derivable from the
      // band either -- a margin floor is ~868 where the band's is 90.
      if (leftSurfacesRef.current.length > 0 && lBox !== null) {
        agentsRef.current = assignPerch(
          agentsRef.current, leftSurfacesRef.current, opts, lBox.height,
        );
      }
      if (rightSurfacesRef.current.length > 0 && rBox !== null) {
        agentsRef.current = assignPerch(
          agentsRef.current, rightSurfacesRef.current, opts, rBox.height,
        );
      }
    }

    // ONE read of the gate per frame, feeding BOTH canvases. The band used to take it from
    // this ref while the render took it from the `aerialAllowed` prop, and the two could
    // disagree for a frame -- long enough to paint an airborne bobit on both canvases, or on
    // neither. `flying` below is now derived from what this pass produced, not from the prop.
    const allowAir = allowAirRef.current;
    const air = aerialFigures(directorRef.current, band, darkMode, allowAir);
    if (air.length === 0) {
      // setState from the frame loop is cheap here because the array is empty almost always,
      // and React bails out of a re-render when the value is the same identity.
      setAerial(prev => (prev.figures.length === 0 ? prev : NO_AERIAL));
    } else {
      // Measured only while something is actually flying -- a handful of frames per match --
      // so the layout read never lands on the ordinary path.
      const r = wrapRef.current?.getBoundingClientRect() ?? null;
      const vh = window.innerHeight;
      const { dx, dy } = overlayOffset(r, vh, overlayHeightFor(vh, band.height), band.height);
      setAerial({ figures: air, dx, dy });
    }

    // The MARGIN canvases, published from this SAME pass. Not a second read of the geometry:
    // the lists partition every agent between them, and a partition only holds if every side
    // is answering the same question. An airborne bobit was once painted on two canvases for a
    // whole flight because the band read a ref while the render read a prop.
    const lSurf = leftSurfacesRef.current;
    const rSurf = rightSurfacesRef.current;
    // The line under construction, resolved ONCE and read by both the figures below and the
    // canvases' `siteFor`. Two readers fetching it separately could disagree about a frame,
    // which is the whole reason this pass exists.
    const site = siteRef.current === null
      ? null
      : { line: BLUEPRINT[siteRef.current.n - 1], t: siteRef.current.t };
    siteForRef.current = site;

    leftFiguresRef.current = [
      ...tableauFigures(
        stateRef.current, agentsRef.current, band, darkMode, 'left', lSurf, rSurf, s, live,
      ),
      ...(!live.left || lBox === null ? [] : workerFigures(
        agentsRef.current, band, darkMode, 'left', site,
        s === null ? 0 : originX('left', lBox.width, s), lBox.height, s, live,
      )),
    ];
    rightFiguresRef.current = [
      ...tableauFigures(
        stateRef.current, agentsRef.current, band, darkMode, 'right', lSurf, rSurf, s, live,
      ),
      ...(!live.right || rBox === null ? [] : workerFigures(
        agentsRef.current, band, darkMode, 'right', site,
        s === null ? 0 : originX('right', rBox.width, s), rBox.height, s, live,
      )),
    ];

    // The band owns no surfaces now: everything climbable belongs to a margin. The parameter
    // stays until the in-band fallback tree is retired with the rest of it.
    return crowdFigures(
      stateRef.current, agentsRef.current, band, darkMode, directorRef.current,
      allowAir, [], lSurf, rSurf, live,
    );
  }, [band, darkMode, reducedMotion, isMobile]);

  // Props and effects come straight off the director. Stable identities so BobitField's refs
  // are not rebuilt every render.
  /**
   * The director's set pieces. Scene-owned and transient -- a cannon leaves with the scene
   * that placed it.
   *
   * The tableau is NOT here: it is room-owned, persistent, and lives on its own canvases in
   * the margins. That is the same reason the tree was never a Scene beat -- a scene would end
   * and take the scenery away with it.
   */
  const propsFor = useMemo(() => (): FieldProp[] => {
    // Light barrel on a dark ground and vice versa. A fixed dark cannon was invisible in dark
    // mode -- it read as a smudge on the floor rather than as the joke it is.
    const color = darkMode ? '#9AA6B8' : '#4A5568';
    return directorRef.current.props.map(p => ({
      id: p.id, kind: p.kind, x: p.x, groundY: p.groundY, scale: band.scale,
      flip: p.flip, angle: p.angle, color,
    }));
  }, [band, darkMode]);

  const effectsFor = useMemo(() => (): FieldEffect[] => directorRef.current.effects, []);
  /**
   * Each margin canvas's figures, and how much is standing, read from the refs the frame loop
   * fills.
   *
   * Stable identities, and REF reads rather than state: BobitField calls the band's
   * `figuresFor` first, which is what publishes these, so by the time a margin canvas paints
   * it is reading the current frame rather than the previous one -- the same arrangement
   * `propsFor` already uses for the director's props.
   */
  const leftFiguresForCanvas = useMemo(() => (): FieldFigure[] => leftFiguresRef.current, []);
  const rightFiguresForCanvas = useMemo(() => (): FieldFigure[] => rightFiguresRef.current, []);
  /**
   * What is STANDING, which is `shownRef` -- not `builtRef`.
   *
   * `builtRef` is what the player has EARNED: the target the worksite walks toward. A line
   * becomes earned the instant an answer is revealed and takes fourteen seconds to go up, so
   * drawing from `builtRef` would put the finished line on screen immediately and then have a
   * crew haul a second copy of it into the same spot. The two counters are different
   * questions and only one of them is "what is up".
   */
  const builtForCanvas = useMemo(() => (): number => shownRef.current, []);
  const siteForCanvas = useMemo(
    () => (): { line: TableauLine; t: number } | null => siteForRef.current, [],
  );

  if (!slug) return null;

  // The overlay spans the game area down to the bottom of the band, so ONE coordinate system
  // covers both. The offsets come from `overlayOffset`, measured against the band's real box:
  // the overlay is fixed to the VIEWPORT while the band sits inside the game container's
  // padding, and assuming those were the same box drew a flying bobit low and to the left.
  const overlayHeight = overlayHeightFor(viewportH, height);
  // No `aerialAllowed` here: the frame loop has already applied the gate, so a non-empty
  // `aerial.figures` IS the statement that the overlay should be up this frame.
  const flying = aerial.figures.length > 0;

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%', flexShrink: 0 }}>
      {/* The air.
          A second canvas so a cannon shot can arc in front of the question card. Four bounds,
          all load-bearing (spec, 2026-09-14 addendum):
            1. Transient    -- only ever holds a figure mid-flight.
            2. Reveal only  -- `aerialAllowed` is false while the answer timer runs.
            3. Click-through -- pointerEvents none AND interactive={false}, so it installs no
               document listeners and can never intercept a click meant for an answer.
            4. Set pieces only -- pool entrances never set layer:'air'.
          UNMOUNTED whenever nothing is airborne, so in the normal case there is no second
          canvas on the page at all. */}
      {flying && (
        <div
          aria-hidden
          style={{
            position: 'fixed', left: 0, right: 0, bottom: 0,
            height: overlayHeight, pointerEvents: 'none', zIndex: 20,
          }}
        >
          <BobitField
            figures={aerial.figures.map(f => (
              { ...f, x: f.x + aerial.dx, groundY: f.groundY + aerial.dy }
            ))}
            height={overlayHeight}
            interactive={false}
          />
        </div>
      )}
      {/* The tableau, one stack per margin.
          Mounted before the floor line and the band so they paint BEHIND both: a trunk rises
          out of the same ground the crowd walks on, and a bobit at the foot of it passes in
          front rather than behind. Neither box can ever overlap the question column -- see
          TableauMargin, and the bound-1 test in tableauGeometry.test.ts.

          Each side is gated on ITS OWN width, not on the shared scale alone: an asymmetric
          layout can leave one margin usable and the other too narrow, and the wide side should
          still get its stack. */}
      {scale !== null && leftMargin && stackLive(leftMargin, scale) && (
        <TableauMargin
          side="left"
          box={leftMargin}
          scale={scale}
          darkMode={darkMode}
          builtFor={builtForCanvas}
          siteFor={siteForCanvas}
          figuresFor={leftFiguresForCanvas}
          repaintKey={repaintKey}
        />
      )}
      {scale !== null && rightMargin && stackLive(rightMargin, scale) && (
        <TableauMargin
          side="right"
          box={rightMargin}
          scale={scale}
          darkMode={darkMode}
          builtFor={builtForCanvas}
          siteFor={siteForCanvas}
          figuresFor={rightFiguresForCanvas}
          repaintKey={repaintKey}
        />
      )}
      {/* The floor.
          Behind the canvas, so figures and their shadows sit ON it. It is not decoration: with
          depth gone the crowd had nothing to stand on, which is why a jump -- a real 48-unit
          lift in the rig -- read as a wobble rather than as leaving the ground. It also gives
          the eye something to separate figures against when they pass in front of each other.
          Faded at both ends because the band is full-bleed and a hard rule edge to edge would
          read as a divider. */}
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
        // The director already stepped this frame inside figuresFor, which BobitField calls
        // first, so both of these read state that is current rather than a frame stale.
        propsFor={propsFor}
        effectsFor={effectsFor}
        height={height}
        interactive
        repaintKey={repaintKey}
      />
      {overflow > 0 && (
        <span
          style={{
            // Bottom-LEFT: the right border is where the tree's trunk goes.
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
