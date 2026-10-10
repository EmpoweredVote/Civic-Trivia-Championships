import { linesFor } from './blueprint';
import type { StackSide } from './blueprint';
import { lineEndpoints } from './tableauGeometry';
import type { Surface } from '../../../components/bobbits/fieldGeometry';

/**
 * What a bobit can sit on, in the coordinates of the canvas that stack lives in.
 *
 * This is why `Surface` was declared in `fieldGeometry.ts` in Stage 1 and consumed by nothing:
 * its comment said it existed for "the later unlockable platforms, toys and buildings". These
 * are those.
 *
 * ONLY BUILT LINES, and only level sticks. A half-built structure must offer nothing, or a
 * bobit is placed on a seat that is not there yet and hangs in mid-air beside it -- which is
 * precisely what a screenshot of a real milestone caught the margin tree doing during its
 * sprout, three figures floating beside a tree that had not reached them.
 *
 * LOWEST FIRST, because `assignPerch` claims the first unclaimed surface. Without the ordering
 * a lone climber ends up in the canopy while the branch above the cabin stands empty.
 */
export function tableauSurfaces(
  side: StackSide, built: number, ox: number, floorY: number, scale: number,
): Surface[] {
  const out: Surface[] = [];
  for (const line of linesFor(side, built)) {
    if (!line.perch) continue;
    const e = lineEndpoints(line, ox, floorY, scale);
    // The TOP edge of the wood is the line a bobit's seat rests on. Half the line's width
    // above its centre line, and `line.perch` already guarantees it is near-level.
    const top = Math.min(e.y1, e.y2) - (line.w * scale) / 2;
    out.push({
      id: `tableau:${side}:${line.n}`,
      left: Math.min(e.x1, e.x2),
      right: Math.max(e.x1, e.x2),
      y: top,
      // Endpoint 1 is the joint, so it is where the line meets whatever holds it up -- and
      // therefore where somebody climbs to reach it.
      rootX: e.x1,
    });
  }
  // Canvas y grows downward, so "lowest first" is largest y first.
  return out.sort((a, b) => b.y - a.y);
}
