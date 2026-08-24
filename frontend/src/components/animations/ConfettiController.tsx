import { useEffect, useRef } from 'react';
import ReactCanvasConfetti from 'react-canvas-confetti';
import { useConfettiStore } from '../../store/confettiStore';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import type confetti from 'canvas-confetti';

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
  const conductorRef = useRef<ConfettiConductor | null>(null);

  useEffect(() => {
    return () => {
      // Cleanup conductor on unmount
      setConductor(null);
    };
  }, [setConductor]);

  // Don't render canvas if reduced motion is preferred
  if (reducedMotion) {
    return null;
  }

  const handleInit = ({ confetti }: { confetti: confetti.CreateTypes }) => {
    conductorRef.current = new ConfettiConductor(confetti);
    setConductor(conductorRef.current);
  };

  return (
    <ReactCanvasConfetti
      onInit={handleInit}
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
