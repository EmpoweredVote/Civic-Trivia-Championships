import { useEffect, useRef } from 'react';
// canvas-confetti directly, not the react-canvas-confetti wrapper. That wrapper is
// CJS-only (`exports.default = fn`, no "module"/"exports" field); Vite 8's optimizer
// resolved its default to the module namespace object, so <ReactCanvasConfetti/> became
// <{default: fn}/> and React threw error #130 on mount — the whole app died behind the
// error boundary while the build stayed green. canvas-confetti ships a real ESM build
// (dist/confetti.module.mjs), so there is no interop guess to get wrong. The wrapper only
// ever rendered a <canvas> and called create() on it, which is what this does inline.
import confetti from 'canvas-confetti';
import { useConfettiStore } from '../../store/confettiStore';
import { useReducedMotion } from '../../hooks/useReducedMotion';

// Conductor class to control confetti animations
class ConfettiConductor {
  private confetti: confetti.CreateTypes;

  constructor(confetti: confetti.CreateTypes) {
    this.confetti = confetti;
  }

  shoot() {
    this.confetti({
      particleCount: 50,
      spread: 70,
      origin: { y: 0.6 },
    });
  }

  run({ speed, duration }: { speed: number; duration: number }) {
    const end = Date.now() + duration;

    const frame = () => {
      this.confetti({
        particleCount: 2 * speed,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.6 },
      });
      this.confetti({
        particleCount: 2 * speed,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.6 },
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };

    frame();
  }

  // Confetti raining straight down from the top of the screen — near-zero start velocity
  // so gravity alone carries each piece downward, rather than the corner-shot arcs `run` uses.
  // Sparse (one small rectangle at a time) rather than a dense burst.
  rain({ duration }: { duration: number }) {
    const end = Date.now() + duration;
    const colors = ['#14B8A6', '#E8A020'];

    const frame = () => {
      this.confetti({
        particleCount: 1,
        startVelocity: 0,
        gravity: 1,
        decay: 1, // no velocity friction — otherwise it slows to a crawl and fades before reaching bottom
        drift: 0,
        ticks: 500, // enough frames for a full top-to-bottom fall, not just the top portion
        scalar: 0.8,
        shapes: ['square'], // small rectangles, not circles
        origin: { x: Math.random(), y: -0.05 },
        // Pick one color per piece ourselves — canvas-confetti's own per-particle random
        // pick doesn't alternate reliably when particleCount is 1, so it read as one color.
        colors: [colors[Math.floor(Math.random() * colors.length)]],
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };

    frame();
  }

  // Fireworks bursting up from random points across the background, for a perfect game.
  fireworks({ duration }: { duration: number }) {
    const end = Date.now() + duration;
    const colors = ['#14B8A6', '#5EEAD4', '#E8A020', '#FFD426', '#FFFFFF'];

    const burst = () => {
      this.confetti({
        particleCount: 70,
        startVelocity: 32,
        spread: 360,
        ticks: 90,
        gravity: 0.9,
        decay: 0.91,
        scalar: 0.9,
        origin: { x: 0.15 + Math.random() * 0.7, y: 0.25 + Math.random() * 0.5 },
        colors,
        zIndex: 9999,
      });

      if (Date.now() < end) {
        setTimeout(burst, 260 + Math.random() * 260);
      }
    };

    burst();
  }
}

export function ConfettiController() {
  const reducedMotion = useReducedMotion();
  const { setConductor } = useConfettiStore();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    // Null whenever reduced motion is on — nothing is rendered to attach to.
    if (!canvas) return;

    // Same globals the wrapper used: resize:true keeps the canvas matched to the
    // viewport, useWorker:false keeps rendering on the main thread.
    const instance = confetti.create(canvas, { resize: true, useWorker: false });
    setConductor(new ConfettiConductor(instance));

    return () => {
      instance.reset();
      setConductor(null);
    };
    // reducedMotion is a dep so toggling it tears down or re-creates the instance;
    // the old wrapper only ever wired this up on first mount.
  }, [setConductor, reducedMotion]);

  // Don't render canvas if reduced motion is preferred
  if (reducedMotion) {
    return null;
  }

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: 'fixed',
        pointerEvents: 'none',
        width: '100%',
        height: '100%',
        top: 0,
        left: 0,
        zIndex: 9999,
      }}
    />
  );
}
