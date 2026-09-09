import { useCallback, useRef } from 'react';
import { BobitField } from './BobitField';
import type { FieldFigure } from './fieldGeometry';
import { figColor } from './rigExtras';
import { initWander, wanderAdvance, wanderAnim } from './wanderReducer';
import type { WanderState } from './wanderReducer';
import { useConfettiStore } from '../../store/confettiStore';

interface BobbitSceneProps {
  darkMode: boolean;
  isMobile: boolean;
}

interface CastMember {
  tone: number;
  /** Where this one starts, as a fraction of the rail. It wanders from there. */
  x: number;
  phase: number;
}

// Two wandering the footer rail. Both dance when you reach for them, and both drop confetti.
const CAST: CastMember[] = [
  { tone: 2, x: 0.28, phase: 0.6 },
  { tone: 1, x: 0.68, phase: 1.8 },
];

const idFor = (i: number) => `scene-${i}`;

/**
 * A thin divider rail hosting a couple of Bobbits. Purely decorative -- sits in normal flow so
 * it never overlaps surrounding text or cards.
 *
 * They stroll, pause and look around until you reach for one, at which point it stops and
 * dances; clicking drops confetti. Positions come from wanderReducer, advanced inside the
 * field's own rAF loop via `figuresFor`, so React never sees a per-frame update.
 */
export function BobbitScene({ darkMode, isMobile }: BobbitSceneProps) {
  const fireTopRain = useConfettiStore(s => s.fireTopRain);

  // height/railBottom keep enough clearance above (raised arms) and below the rail -- both
  // scaled with `scale`, matching every other Bobbit instance.
  const scale = isMobile ? 0.22 : 0.28;
  const height = isMobile ? 71 : 93;
  const railBottom = isMobile ? 15 : 20;

  const wanderRef = useRef<WanderState | null>(null);

  const figuresFor = useCallback((
    _t: number, dt: number, width: number, greeting: ReadonlySet<string>,
  ): FieldFigure[] => {
    // The field reports width 0 until its ResizeObserver has measured. Seeding positions from
    // that would stack both figures on the left edge, so wait a frame.
    if (width <= 0) return [];

    if (!wanderRef.current) {
      wanderRef.current = initWander(
        CAST.map((c, i) => ({
          id: idFor(i), x: c.x * width, dir: (i % 2 === 0 ? 1 : -1) as 1 | -1,
        })),
        Math.random,
      );
    }

    wanderRef.current = wanderAdvance(wanderRef.current, dt, {
      width, scale, greeting, rand: Math.random,
    });

    const st = wanderRef.current;
    return CAST.map((c, i) => {
      const id = idFor(i);
      const e = st[id];
      return {
        id,
        anim: wanderAnim(e),
        hoverAnim: 'dance',
        color: figColor(c.tone, darkMode),
        x: e.x,
        groundY: height - railBottom,
        scale,
        phase: c.phase,
        flip: e.dir < 0,
      };
    });
  }, [darkMode, scale, height, railBottom]);

  return (
    <div style={{ position: 'relative', width: '100%', marginTop: isMobile ? 16 : 24 }}>
      <BobitField
        figures={[]}
        figuresFor={figuresFor}
        height={height}
        interactive
        onFigureClick={() => fireTopRain()}
      />
    </div>
  );
}
