import { useMemo } from 'react';
import { BobbitCanvas } from './BobbitCanvas';
import type { BobbitFigureSpec } from './BobbitCanvas';
import { figColor } from './leremyRig';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useConfettiStore } from '../../store/confettiStore';

interface BobbitSceneProps {
  darkMode: boolean;
  isMobile: boolean;
}

interface CastMember {
  anim: BobbitFigureSpec['anim'];
  tone: number;
  x: number;
  card?: boolean;
  flip?: boolean;
  phase: number;
  /** Marks this cast member as clickable — currently only used to fire the dancer's confetti. */
  clickable?: boolean;
}

// Two celebrating a correct answer — both clickable for confetti.
const CAST: CastMember[] = [
  { anim: 'dance', tone: 2, x: 0.28, phase: 0.6, clickable: true },
  { anim: 'dance', tone: 1, x: 0.68, phase: 1.8, clickable: true },
];

/**
 * A thin divider rail hosting a couple of Bobbits, ported from the leremy-rig engine.
 * Purely decorative — sits in normal flow so it never overlaps surrounding text/cards.
 */
export function BobbitScene({ darkMode, isMobile }: BobbitSceneProps) {
  const prefersReducedMotion = useReducedMotion();
  const animate = !prefersReducedMotion;

  const fireTopRain = useConfettiStore(s => s.fireTopRain);

  // height/railBottom keep enough clearance above (raised arms) and below (the sit/read
  // pose's dangling feet) the rail — both scaled proportionally with `scale`, matching the
  // same size used for every other Bobbit instance (hero trophy-carry, card greeter).
  const scale = isMobile ? 0.22 : 0.28;
  const height = isMobile ? 71 : 93;
  const railBottom = isMobile ? 15 : 20;

  // Memoised: BobbitCanvas keys its rAF loop on this array's identity, so a fresh array on
  // every parent render (Dashboard re-renders on window resize) would restart the animation
  // clock at 0 and make the figures visibly jump.
  const figures: BobbitFigureSpec[] = useMemo(() => CAST.map((c) => ({
    anim: c.anim,
    color: figColor(c.tone, darkMode),
    x: c.x,
    bottom: railBottom,
    scale,
    card: c.card,
    flip: c.flip,
    phase: c.phase,
    onClick: c.clickable ? () => fireTopRain() : undefined,
  })), [darkMode, railBottom, scale, fireTopRain]);

  return (
    <div style={{ position: 'relative', width: '100%', marginTop: isMobile ? 16 : 24, pointerEvents: 'none' }}>
      <BobbitCanvas figures={figures} height={height} animate={animate} />
    </div>
  );
}
