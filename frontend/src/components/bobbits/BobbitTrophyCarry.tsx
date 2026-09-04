import { useEffect, useRef } from 'react';
import {
  ANIMATIONS, CFG, computePose, draw, drawShadow, heaveBend,
} from './leremyRig';
import { drawTrophy, figColor } from './rigExtras';
import type { Pose } from './leremyRig';
import { useReducedMotion } from '../../hooks/useReducedMotion';

// Standing-family poses (walk/carry/heave/greet) plant their feet ~112 raw units below the
// pelvis — same constant used throughout the other Bobbit scenes.
const PELVIS_STAND = 112;

// carry's arm angles are fixed, so its hands sit at a near-constant height relative to the
// pelvis (only the small walk-cycle bob/hunch sway it). Computed once as the reference height
// the trophy returns to once it's picked back up, rather than hand-derived on every frame.
const CARRY_REF_JOINTS = computePose(ANIMATIONS.carry.frame(0), CFG, { x: 0, y: 0 });
const CARRY_HAND_Y = (CARRY_REF_JOINTS.hR.y + CARRY_REF_JOINTS.hL.y) / 2;

type Phase = 'walk' | 'lowering' | 'rising1' | 'waving' | 'lowering2' | 'rising2' | 'offstage';

const RISE_DUR = 0.6;
const TROPHY_SIZE_MULT = 2; // trophy drawn twice figure-scale — a prop, not a third Bobbit
const WAVE_DUR = 2.6;
const OFFSTAGE_MIN = 2;
const OFFSTAGE_MAX = 4.5;

interface SceneState {
  phase: Phase;
  phaseStartAt: number; // performance.now() when the current phase began
  walkStartAt: number; // performance.now() when the current walk run began
  walkStartX: number; // lead figure's x when the current walk run began
  offstageUntil: number; // performance.now() timestamp to resume walking
  // True for the brief fast burst while entering from off-screen — separate from the
  // normal cruising speed, so the two can differ without one affecting the other.
  entering: boolean;
  // Cached each render so the click handler (outside the rAF loop) can hit-test
  // against where the figures actually are right now.
  x: number;
  walkClock: number;
  phaseT: number;
}

interface BobbitTrophyCarryProps {
  darkMode: boolean;
  isMobile: boolean;
}

/**
 * NOTE: this component deliberately keeps its own canvas rather than rendering through
 * BobitField.
 *
 * BobitField is a decorative crowd renderer: one aria-hidden canvas, figures identified by
 * animation key. This component is neither decorative nor a crowd -- it is a labelled,
 * focusable control (role/tabIndex/keyboard handling) driving a bespoke choreography the
 * animation-key model cannot express. Moving it onto the field would mean either losing its
 * accessibility contract or bolting per-figure escape hatches onto the field until it stopped
 * being a crowd renderer.
 *
 * The cost of staying is one extra rAF for one scene, which the crowd performance work does
 * not care about. Revisit if this ever needs to share state with the crowd.
 */
export function BobbitTrophyCarry({ darkMode, isMobile }: BobbitTrophyCarryProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const widthRef = useRef(0);
  const stateRef = useRef<SceneState | null>(null);
  const animate = !useReducedMotion();

  const scale = isMobile ? 0.22 : 0.28;
  // height/groundOffset scaled down proportionally with `scale` (not independently) — clearance
  // needs are a fixed multiple of scale, so shrinking one without the other reintroduces clipping.
  const height = isMobile ? 74 : 96;
  const groundOffset = isMobile ? 12 : 15; // px from canvas bottom up to the ground line
  const gap = 150 * scale; // px between the two carriers' ground-contact points — sized for the enlarged trophy
  const speed = (isMobile ? 22 : 30); // px/sec

  const colorA = figColor(0, darkMode); // rear carrier — teal
  const colorB = figColor(5, darkMode); // lead carrier — orange

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      const w = canvas.clientWidth;
      widthRef.current = w;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const entryOffset = gap + 70;
    // Entering (from fully off-screen to both carriers visible) should take ~0.5-1s regardless
    // of the normal cruising speed — a separate, one-time-per-entrance speed rather than
    // changing `speed` itself, which stays the walking pace for the rest of the traversal.
    const ENTRY_TARGET_SEC = 0.85;
    const entrySpeed = (entryOffset + gap) / ENTRY_TARGET_SEC;
    if (!stateRef.current) {
      const now = performance.now();
      stateRef.current = {
        phase: 'walk', phaseStartAt: now, walkStartAt: now, walkStartX: -entryOffset, offstageUntil: 0,
        entering: true, x: -entryOffset, walkClock: 0, phaseT: 0,
      };
    }

    const groundY = height - groundOffset;

    function poseAndHand(basePose: Pose) {
      return computePose(basePose, CFG, { x: 0, y: 0 });
    }

    function drawFigureAt(figX: number, pose: Pose, color: string) {
      ctx!.save();
      ctx!.translate(figX, groundY - PELVIS_STAND * scale);
      ctx!.scale(scale, scale);
      const j = computePose(pose, CFG, { x: 0, y: 0 });
      draw(ctx!, j, CFG, { color });
      ctx!.restore();
    }

    function render() {
      const st = stateRef.current!;
      const w = widthRef.current;
      ctx!.clearRect(0, 0, w, height);

      const leadX = st.x;
      const rearX = st.x - gap;

      let leadPose: Pose;
      let rearPose: Pose;

      if (st.phase === 'walk') {
        // During the fast entry burst, scale the leg-cycle rate to match so strides don't
        // look like sliding — back to 1:1 once cruising at the normal speed.
        const gaitRate = st.entering ? entrySpeed / speed : 1;
        const gaitClock = st.walkClock * gaitRate;
        leadPose = ANIMATIONS.carry.frame(gaitClock);
        rearPose = ANIMATIONS.carry.frame(gaitClock + 0.16);
      } else if (st.phase === 'lowering') {
        leadPose = rearPose = ANIMATIONS.heave.frame(st.phaseT);
      } else if (st.phase === 'rising1') {
        leadPose = rearPose = ANIMATIONS.heave.frame(RISE_DUR + st.phaseT);
      } else if (st.phase === 'waving') {
        leadPose = ANIMATIONS.greet.frame(st.phaseT, { hand: 'L', hz: 1.7 });
        rearPose = ANIMATIONS.greet.frame(st.phaseT, { hand: 'R', hz: 1.4 });
      } else if (st.phase === 'lowering2') {
        leadPose = rearPose = ANIMATIONS.heave.frame(st.phaseT);
      } else if (st.phase === 'rising2') {
        leadPose = rearPose = ANIMATIONS.heave.frame(RISE_DUR + st.phaseT);
      } else {
        leadPose = rearPose = ANIMATIONS.standstill.frame(0);
      }

      // Only draw (and hit-test) when at least one carrier is on screen.
      const onScreen = st.phase !== 'offstage';

      if (onScreen) {
        drawShadow(ctx!, rearX, groundY, 12 * scale);
        drawShadow(ctx!, leadX, groundY, 12 * scale);

        const jRear = poseAndHand(rearPose);
        const jLead = poseAndHand(leadPose);

        // Trophy x: the midpoint between the two carriers — they don't move relative to each
        // other, so this never needs to track anything but their (shared) walk position.
        const trophyX = (leadX + rearX) / 2;
        let trophyY: number;

        if (st.phase === 'walk') {
          // Live hand tracking: the trophy rides the carriers' actual hand joints each frame,
          // so it keeps pace with the same small bob/hunch sway their bodies have — no separate
          // "floating" object with its own motion.
          const rearHandY = groundY - PELVIS_STAND * scale + jRear.hR.y * scale;
          const leadHandY = groundY - PELVIS_STAND * scale + jLead.hL.y * scale;
          trophyY = (rearHandY + leadHandY) / 2;
        } else if (st.phase === 'lowering' || st.phase === 'rising2') {
          const carryY = groundY - PELVIS_STAND * scale + CARRY_HAND_Y * scale;
          trophyY = carryY + (groundY - carryY) * heaveBend(st.phase === 'lowering' ? st.phaseT : RISE_DUR + st.phaseT);
        } else {
          // rising1 / waving / lowering2: already set down, sitting still on the ground.
          trophyY = groundY;
        }

        drawFigureAt(rearX, rearPose, colorA);
        drawFigureAt(leadX, leadPose, colorB);
        drawTrophy(ctx!, trophyX, trophyY, scale * TROPHY_SIZE_MULT);
      }

      canvas!.style.cursor = st.phase === 'walk' ? 'pointer' : 'default';
    }

    function nextPhase(p: Phase): Phase {
      switch (p) {
        case 'lowering': return 'rising1';
        case 'rising1': return 'waving';
        case 'waving': return 'lowering2';
        case 'lowering2': return 'rising2';
        case 'rising2': return 'walk';
        default: return 'walk';
      }
    }

    function phaseDuration(p: Phase): number {
      switch (p) {
        case 'lowering': case 'lowering2': case 'rising1': case 'rising2': return RISE_DUR;
        case 'waving': return WAVE_DUR;
        default: return Infinity;
      }
    }

    if (!animate) {
      // No walk cycle to freeze mid-stride into something legible — instead show the resting
      // tableau (trophy already set down, figures standing calm) centered on screen, since the
      // default state otherwise starts off-screen mid-entrance and would render nothing at all.
      const st = stateRef.current!;
      st.phase = 'rising1';
      st.phaseT = RISE_DUR;
      st.x = widthRef.current / 2 + gap / 2;
      render();
      return () => ro.disconnect();
    }

    let rafId: number;
    const tick = (now: number) => {
      const st = stateRef.current!;
      const w = widthRef.current;

      if (st.phase === 'walk') {
        const currentSpeed = st.entering ? entrySpeed : speed;
        st.walkClock = (now - st.walkStartAt) / 1000;
        st.x = st.walkStartX + currentSpeed * st.walkClock;
        if (st.entering && st.x - gap >= 0) {
          // Both carriers are now fully on screen — hand off to the normal cruising speed
          // from exactly here, so there's no jump at the transition.
          st.entering = false;
          st.walkStartAt = now;
          st.walkStartX = st.x;
          st.walkClock = 0;
        }
        if (st.x - gap > w + 80) {
          st.phase = 'offstage';
          st.offstageUntil = now + (OFFSTAGE_MIN + Math.random() * (OFFSTAGE_MAX - OFFSTAGE_MIN)) * 1000;
        }
      } else if (st.phase === 'offstage') {
        if (now >= st.offstageUntil) {
          st.walkStartAt = now;
          st.walkStartX = -(gap + 70);
          st.x = st.walkStartX;
          st.walkClock = 0;
          st.entering = true;
          st.phase = 'walk';
        }
      } else {
        st.phaseT = (now - st.phaseStartAt) / 1000;
        if (st.phaseT >= phaseDuration(st.phase)) {
          const next = nextPhase(st.phase);
          st.phase = next;
          st.phaseStartAt = now;
          st.phaseT = 0;
          // Resuming 'walk' after the stop/wave/pick-up sequence: reset the walk-clock
          // origin to right now, from wherever they're currently standing. Without this,
          // walkClock jumps forward by however long the whole sequence took (~5s), which
          // instantly teleports them that many seconds' worth of distance ahead.
          if (next === 'walk') {
            st.walkStartAt = now;
            st.walkStartX = st.x;
          }
        }
      }

      render();
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    return () => {
      ro.disconnect();
      cancelAnimationFrame(rafId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animate, darkMode, scale, height, groundOffset, gap, speed, colorA, colorB]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const st = stateRef.current;
    const canvas = canvasRef.current;
    if (!st || !canvas || st.phase !== 'walk') return;
    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const groundY = height - groundOffset;
    const leadX = st.x, rearX = st.x - gap;
    // Covers both carriers plus the trophy between them — horizontally from just outside the
    // rear figure to just outside the lead figure, vertically from above their heads (standing
    // figures are ~205 raw units tall at this scale) down past their feet.
    const minX = rearX - 40 * scale, maxX = leadX + 40 * scale;
    const minY = groundY - 210 * scale, maxY = groundY + 15;
    if (cx >= minX && cx <= maxX && cy >= minY && cy <= maxY) {
      st.phase = 'lowering';
      st.phaseStartAt = performance.now();
      st.phaseT = 0;
    }
  };

  return (
    <div style={{ position: 'relative', width: '100%', height }}>
      {/* ground line */}
      <div
        style={{
          position: 'absolute', left: 0, right: 0, bottom: groundOffset,
          height: 1.5,
          background: darkMode
            ? 'linear-gradient(90deg, transparent 0%, rgba(148,163,184,0.28) 12%, rgba(148,163,184,0.28) 88%, transparent 100%)'
            : 'linear-gradient(90deg, transparent 0%, rgba(100,116,139,0.28) 12%, rgba(100,116,139,0.28) 88%, transparent 100%)',
        }}
      />
      <canvas
        ref={canvasRef}
        onClick={handleClick}
        role="button"
        aria-label="Two Bobbits carrying the championship trophy — click to say hello"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            // role="button" must swallow Space, otherwise the browser scrolls the page too.
            e.preventDefault();
            const st = stateRef.current;
            if (st && st.phase === 'walk') { st.phase = 'lowering'; st.phaseStartAt = performance.now(); st.phaseT = 0; }
          }
        }}
        style={{ display: 'block', width: '100%', height }}
      />
    </div>
  );
}
