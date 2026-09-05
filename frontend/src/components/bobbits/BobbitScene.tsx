import { useMemo } from 'react';
import { BobitField } from './BobitField';
import type { FieldFigure } from './fieldGeometry';
import { figColor } from './rigExtras';
import { useConfettiStore } from '../../store/confettiStore';

interface BobbitSceneProps {
  darkMode: boolean;
  isMobile: boolean;
}

interface CastMember {
  anim: string;
  tone: number;
  x: number;
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
 * A thin divider rail hosting a couple of Bobbits. Purely decorative — sits in normal flow so
 * it never overlaps surrounding text or cards.
 *
 * Rendered through the shared BobitField rather than its own canvas, so these two share the
 * clock (and the hover-greet and hold-to-poof behaviour) with every other Bobbit on the page.
 */
export function BobbitScene({ darkMode, isMobile }: BobbitSceneProps) {
  const fireTopRain = useConfettiStore(s => s.fireTopRain);

  // height/railBottom keep enough clearance above (raised arms) and below (the sit/read pose's
  // dangling feet) the rail — both scaled proportionally with `scale`, matching the same size
  // used for every other Bobbit instance (hero trophy-carry, card greeter).
  const scale = isMobile ? 0.22 : 0.28;
  const height = isMobile ? 71 : 93;
  const railBottom = isMobile ? 15 : 20;

  // Positioned by fraction so the pair stays put as the responsive column resizes; the field
  // resolves xFrac against its measured width each frame.
  const figures: FieldFigure[] = useMemo(() => CAST.map((c, i) => ({
    id: `scene-${i}`,
    anim: c.anim,
    color: figColor(c.tone, darkMode),
    x: 0,
    xFrac: c.x,
    groundY: height - railBottom,
    scale,
    phase: c.phase,
  })), [darkMode, railBottom, scale, height]);

  return (
    <div style={{ position: 'relative', width: '100%', marginTop: isMobile ? 16 : 24 }}>
      <BobitField
        figures={figures}
        height={height}
        interactive
        onFigureClick={() => fireTopRain()}
      />
    </div>
  );
}
