import { useEffect, useRef, useState } from 'react';
import { ANIMATIONS, CFG, computePose, draw, drawShadow, figColor } from './leremyRig';
import type { Pose } from './leremyRig';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useWindowSize } from '../../hooks/useWindowSize';

const PELVIS_SEAT = 8;

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
 * Seated on the search box's top edge, reading — idle motion is the rig's own `read` pose
 * (already turns pages on its own). Hovering closes the book, eases into a wave borrowed
 * from `greetseat`, and surfaces one short civic fact; leaving reopens the book and resumes
 * reading. Hidden on mobile since hover has no equivalent there.
 */
export function BobbitCivicFactSitter({ darkMode }: BobbitCivicFactSitterProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const widthRef = useRef(0);
  const hoverTargetRef = useRef(0);
  const hoverAmountRef = useRef(0);
  const hoverStartAtRef = useRef(0);
  const animate = !useReducedMotion();
  const [hovered, setHovered] = useState(false);
  const [factIndex, setFactIndex] = useState(0);
  const { width: viewportWidth } = useWindowSize();
  const isMobile = viewportWidth < 640;

  const scale = 0.3;
  const seatFromTop = 46;
  const legClearance = 30;
  const height = seatFromTop + legClearance;
  const color = figColor(0, darkMode);

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

    function blend(a: number, b: number, t: number) {
      return a + (b - a) * t;
    }

    // Idle = the rig's own `read` pose untouched. Hovering cross-fades every field toward
    // `greetseat`'s wave (borrowed wholesale — it already eases from a "look up" into a
    // raised-arm wave with its own oscillation), so the reading motion smoothly hands off
    // into waving hello instead of two poses fighting each other.
    function poseFor(t: number, hoverAmount: number, waveT: number): Pose {
      const base = ANIMATIONS.read.frame(t);
      if (hoverAmount <= 0.001) return base;
      const wavePose = ANIMATIONS.greetseat.frame(waveT, { hand: 'R' });
      const out = { ...base };
      (Object.keys(out) as (keyof Pose)[]).forEach((k) => {
        out[k] = blend(base[k], wavePose[k], hoverAmount);
      });
      return out;
    }

    function render(t: number, now: number) {
      const w = widthRef.current;
      ctx!.clearRect(0, 0, w, height);
      const x = w / 2;
      drawShadow(ctx!, x, seatY, 10 * scale);
      const hoverAmount = hoverAmountRef.current;
      const waveT = hoverStartAtRef.current ? (now - hoverStartAtRef.current) / 1000 : 0;
      const pose = poseFor(t, hoverAmount, waveT);
      // The book closes (and gets set down) once the wave has mostly taken over.
      const showBook = hoverAmount < 0.5;
      ctx!.save();
      ctx!.translate(x, seatY - PELVIS_SEAT * scale);
      ctx!.scale(scale, scale);
      const j = computePose(pose, CFG, { x: 0, y: 0 });
      draw(ctx!, j, CFG, { color, card: showBook, cardRot: -0.15 });
      ctx!.restore();
    }

    if (!animate) {
      render(0, 0);
      return () => ro.disconnect();
    }

    let rafId: number;
    let last = performance.now();
    const start = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      hoverAmountRef.current += (hoverTargetRef.current - hoverAmountRef.current) * Math.min(1, dt * 6);
      render((now - start) / 1000, now);
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    return () => {
      ro.disconnect();
      cancelAnimationFrame(rafId);
    };
  }, [animate, color, scale, height]);

  const setHover = (v: boolean) => {
    hoverTargetRef.current = v ? 1 : 0;
    if (v) {
      hoverStartAtRef.current = performance.now();
      setFactIndex(Math.floor(Math.random() * CIVIC_FACTS.length));
    }
    setHovered(v);
  };

  if (isMobile) return null;

  return (
    <div
      style={{
        position: 'absolute', top: -seatFromTop, right: 340,
        width: 80, height, zIndex: 2, pointerEvents: 'auto',
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div
        role="tooltip"
        style={{
          position: 'absolute', bottom: height + 10, left: '50%',
          transform: `translate(-50%, ${hovered ? '0' : '4px'})`,
          opacity: hovered ? 1 : 0,
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
      <canvas
        ref={canvasRef}
        tabIndex={0}
        role="img"
        aria-label="A Bobbit sitting on the divider, reading — hover for a civic fact"
        onFocus={() => setHover(true)}
        onBlur={() => setHover(false)}
        style={{ display: 'block', width: '100%', height, outline: 'none', cursor: 'pointer' }}
      />
    </div>
  );
}
