import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { ANIMATIONS, CFG, computePose, draw, drawShadow, REST } from './leremyRig';
import { figColor } from './rigExtras';
import type { Pose } from './leremyRig';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useWindowSize } from '../../hooks/useWindowSize';
import {
  readerReduce, bubbleOpen, showBook, READER_IDLE, QUOTE_TRANS,
} from './readerReducer';
import type { ReaderEvent, ReaderState } from './readerReducer';

const PELVIS_SEAT = 8;

/** ev-figures.js's easing: flat at both ends, so a glance starts and settles softly. */
function smooth01(u: number): number {
  const c = u < 0 ? 0 : u > 1 ? 1 : u;
  return c * c * (3 - 2 * c);
}

/** Blends every field of two poses. Pose is a flat record of numbers, so this is total. */
function lerpPose(a: Pose, b: Pose, t: number): Pose {
  const out = { ...a };
  (Object.keys(out) as (keyof Pose)[]).forEach((k) => {
    out[k] = a[k] + (b[k] - a[k]) * t;
  });
  return out;
}

/** Hover: the same reading hold, head raised off the page. Ported from ev-figures.js. */
function quoteGlance(t: number): Pose {
  const p = ANIMATIONS.read.frame(t);
  const br = Math.sin(t * 0.28 * Math.PI * 2);
  p.hunch = -(14 + br * 2);              // partly uncurled, still leaning in
  p.headTilt = 6 + Math.sin(t * 0.4 * Math.PI * 2) * 3;
  return p;
}

/**
 * Settled: sat up, book down in the lap, looking up and out. Ported from ev-figures.js.
 * 0deg points straight DOWN and 90 is horizontal, so the upper arms hang low and the forearms
 * come forward, putting the hands over the thighs -- the book draws at the hand midpoint,
 * which is what drops it into the lap.
 */
function quoteHold(t: number): Pose {
  const p = { ...REST };
  const br = Math.sin(t * 0.26 * Math.PI * 2);
  p.lean = 2;
  p.hunch = -(4 + br * 2);
  p.bob = br * 1.2;
  p.headTilt = 9 + Math.sin(t * 0.32 * Math.PI * 2) * 3;
  p.armRU = 30 + br;  p.armRF = 88 + br * 3;
  p.armLU = 22 - br;  p.armLF = 80 + br * 2;
  p.legRU = 78; p.legRF = 11;
  p.legLU = 70; p.legLF = 5;
  return p;
}

function poseFor(state: ReaderState, t: number): Pose {
  const read = ANIMATIONS.read.frame(t);
  switch (state.phase) {
    case 'read':
      return state.glance > 0 ? lerpPose(read, quoteGlance(t), smooth01(state.glance)) : read;
    case 'lookup':
      return lerpPose(read, quoteHold(t), smooth01(state.t / QUOTE_TRANS));
    case 'hold':
      return quoteHold(t);
    case 'resume':
      return lerpPose(quoteHold(t), read, smooth01(state.t / QUOTE_TRANS));
  }
}

const CIVIC_FACTS = [
  'The Bill of Rights added the first 10 amendments in 1791.',
  'Every state gets at least 3 electoral votes, no matter its population.',
  'The Supreme Court has sat with 9 justices since 1869.',
  'The 26th Amendment lowered the voting age to 18 in 1971.',
  'Congress has two chambers: the House and the Senate.',
  'A presidential veto can be overridden by a two-thirds vote in Congress.',
  'Local elections often decide your school board, mayor, and ballot measures.',
  'The First Amendment protects speech, press, religion, assembly, and petition.',
];

interface BobbitCivicFactSitterProps {
  darkMode: boolean;
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
/**
 * Seated on the search box's top edge, reading — idle motion is the rig's own `read` pose
 * (already turns pages on its own). Hovering (or focusing) lifts his head off the page without
 * letting go of the book — acknowledgement, no payload. Clicking (or Enter/Space) sits him up,
 * lowers the book into his lap and opens a bubble with a civic fact; clicking again, Escape, or
 * a click elsewhere returns him to reading. Hidden on mobile since hover has no equivalent
 * there.
 */
export function BobbitCivicFactSitter({ darkMode }: BobbitCivicFactSitterProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const widthRef = useRef(0);
  const stateRef = useRef<ReaderState>(READER_IDLE);
  const hoveringRef = useRef(false);
  // Set by the effect below to a same-frame repaint, used only when `!animate` -- with no rAF
  // loop, a click/dismiss needs to redraw itself rather than wait for a frame that never comes.
  const repaintRef = useRef<(() => void) | null>(null);
  const animate = !useReducedMotion();
  const [bubbleShown, setBubbleShown] = useState(false);
  // Seeded at random and advanced on the way OUT of a reveal, not into one — the description
  // a screen reader reads on focus is computed from the DOM as it stands when focus lands,
  // so the fact has to already be committed before the reveal starts.
  const [factIndex, setFactIndex] = useState(() => Math.floor(Math.random() * CIVIC_FACTS.length));
  const factId = useId();
  const { width: viewportWidth } = useWindowSize();
  const isMobile = viewportWidth < 640;

  const scale = 0.3;
  const seatFromTop = 46;
  const legClearance = 30;
  const height = seatFromTop + legClearance;
  const color = figColor(0, darkMode);

  const advanceFact = useCallback(() => {
    // Queue the next fact for the next reveal, skipping the one just shown.
    setFactIndex(prev => {
      const offset = 1 + Math.floor(Math.random() * (CIVIC_FACTS.length - 1));
      return (prev + offset) % CIVIC_FACTS.length;
    });
  }, []);

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

    const seatY = height - legClearance;

    function render(state: ReaderState, t: number) {
      const w = widthRef.current;
      ctx!.clearRect(0, 0, w, height);
      const x = w / 2;
      drawShadow(ctx!, x, seatY, 10 * scale);
      const pose = poseFor(state, t);
      ctx!.save();
      ctx!.translate(x, seatY - PELVIS_SEAT * scale);
      ctx!.scale(scale, scale);
      const j = computePose(pose, CFG, { x: 0, y: 0 });
      draw(ctx!, j, CFG, { color, card: showBook(state), cardRot: -0.15 });
      ctx!.restore();
    }

    // Exposed so a click/dismiss outside this effect (reduced motion has no rAF loop to redraw
    // on its own) can repaint immediately after settling the reducer.
    repaintRef.current = () => render(stateRef.current, 0);

    if (!animate) {
      // No loop running to catch a later phase change, so this single frame must reflect
      // whatever stateRef.current already is (e.g. reduced motion switched on mid-hold)
      // rather than assume the idle read pose.
      render(stateRef.current, 0);
      return () => {
        ro.disconnect();
        repaintRef.current = null;
      };
    }

    let rafId: number;
    let last = performance.now();
    const start = performance.now();
    let wasOpen = bubbleOpen(stateRef.current);
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      stateRef.current = readerReduce(stateRef.current, {
        type: 'tick', dt, hovering: hoveringRef.current,
      });
      const isOpen = bubbleOpen(stateRef.current);
      if (isOpen !== wasOpen) {
        wasOpen = isOpen;
        setBubbleShown(isOpen);
        if (!isOpen) advanceFact();
      }
      render(stateRef.current, (now - start) / 1000);
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    return () => {
      ro.disconnect();
      cancelAnimationFrame(rafId);
      repaintRef.current = null;
    };
  }, [animate, color, scale, height]);

  /**
   * Settles a click or dismiss. Under `animate`, mutating the ref is enough — the running rAF
   * loop picks up the phase change on its next frame and syncs `bubbleShown` itself.
   *
   * Reduced motion has no loop to carry a transition across ticks, and reduced motion means no
   * animated easing, not no destination -- a reader whose "entire purpose is delivering text"
   * must still be able to speak. So here we feed the reducer synthetic ticks until the phase
   * settles on `read` or `hold`, then sync state and repaint once, ourselves. Bounded at 2
   * iterations: `lookup`->`hold` or `resume`->`read` is the most any single click/dismiss can
   * need, so a future phase added to the machine cannot spin this loop.
   */
  const settleAfterEvent = useCallback((ev: ReaderEvent) => {
    stateRef.current = readerReduce(stateRef.current, ev);
    if (animate) return;
    let guard = 0;
    while (guard < 2 && (stateRef.current.phase === 'lookup' || stateRef.current.phase === 'resume')) {
      stateRef.current = readerReduce(stateRef.current, { type: 'tick', dt: QUOTE_TRANS, hovering: false });
      guard++;
    }
    const isOpen = bubbleOpen(stateRef.current);
    setBubbleShown(isOpen);
    if (!isOpen) advanceFact();
    repaintRef.current?.();
  }, [animate, advanceFact]);

  // Document-level dismissal while the bubble is open: Escape or a click anywhere outside the
  // wrapper both close it. Attached only while open and torn down when it closes or unmounts.
  useEffect(() => {
    if (!bubbleShown) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') settleAfterEvent({ type: 'dismiss' });
    };
    const onPointerDown = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        settleAfterEvent({ type: 'dismiss' });
      }
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, [bubbleShown, settleAfterEvent]);

  const onEnter = () => { hoveringRef.current = true; };
  const onLeave = () => { hoveringRef.current = false; };
  const onActivate = () => settleAfterEvent({ type: 'click' });

  if (isMobile) return null;

  return (
    <div
      ref={wrapperRef}
      style={{
        position: 'absolute', top: -seatFromTop, right: 340,
        width: 80, height, zIndex: 2, pointerEvents: 'auto',
      }}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      <div
        aria-hidden="true"
        style={{
          position: 'absolute', bottom: height + 10, left: '50%',
          transform: `translate(-50%, ${bubbleShown ? '0' : '4px'})`,
          opacity: bubbleShown ? 1 : 0,
          transition: 'opacity 0.22s ease, transform 0.22s ease',
          pointerEvents: 'none',
          width: 200, maxWidth: '60vw',
          padding: '10px 12px',
          borderRadius: 10,
          fontFamily: "'Manrope', sans-serif", fontWeight: 600, fontSize: 12.5, lineHeight: 1.4,
          textAlign: 'center' as const,
          color: darkMode ? '#E2E8F0' : '#1E293B',
          background: darkMode ? '#1B222C' : '#FFFFFF',
          border: `1px solid ${darkMode ? '#2B3440' : '#E2E8F0'}`,
          boxShadow: darkMode ? '0 8px 24px rgba(0,0,0,0.4)' : '0 8px 24px rgba(15,23,42,0.12)',
        }}
      >
        {CIVIC_FACTS[factIndex]}
      </div>
      {/* The bubble above is aria-hidden because its opacity transition keeps it in the DOM
          even when invisible. This carries the same text as the canvas's description instead. */}
      <span id={factId} className="sr-only">{CIVIC_FACTS[factIndex]}</span>
      <canvas
        ref={canvasRef}
        tabIndex={0}
        role="img"
        aria-label="A Bobbit sitting on the divider, reading — activate to hear a civic fact"
        aria-describedby={factId}
        onFocus={onEnter}
        onBlur={onLeave}
        onClick={onActivate}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onActivate(); }
          else if (e.key === 'Escape') settleAfterEvent({ type: 'dismiss' });
        }}
        style={{ display: 'block', width: '100%', height, outline: 'none', cursor: 'pointer' }}
      />
    </div>
  );
}
