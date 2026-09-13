import { MIN_SEPARATION } from '../../components/bobbits/wanderReducer';

/**
 * Maximum figures rendered at once.
 *
 * Stage 2 measured 105 as the 60fps ceiling on a mid-tier phone, and CPU throttling flatters
 * mobile (it slows JavaScript but leaves the GPU alone), so the working cap is 100. It also
 * contains the median collection whole -- 91 of 41 collections' worth of questions -- so most
 * rooms render complete. Anything above the cap is shown as a count instead.
 */
export const CROWD_CAP = 100;

export interface CrowdBand {
  width: number;
  height: number;
  scale: number;
}

/** How many rows a crowd of this size uses. Capped at three: more looks like a wall. */
export function rowsFor(total: number): number {
  if (total <= 24) return 1;
  if (total <= 60) return 2;
  return 3;
}

/** Figures per row, at the widest the crowd will get. Fixed so a slot never changes row. */
const ROW_CAPACITY = [34, 33, 33];

export function slotPosition(index: number, total: number, band: CrowdBand) {
  const rows = rowsFor(total);

  // Row assignment is by index against FIXED capacities, not against the current population,
  // so slot 5 is in row 0 whether the room holds 20 or 90. Reflowing on growth would move
  // everyone every time a bobit arrived, which is exactly what the identity rules forbid.
  let row = 0;
  let within = index;
  for (let r = 0; r < rows; r++) {
    if (within < ROW_CAPACITY[r]) { row = r; break; }
    within -= ROW_CAPACITY[r];
    row = r + 1;
  }
  if (row >= rows) { row = rows - 1; within = index; }

  const perRow = ROW_CAPACITY[Math.min(row, ROW_CAPACITY.length - 1)];
  // Half-step inset so the first and last figures are not flush against the band edges.
  const x = ((within + 0.5) / perRow) * band.width;

  // Back rows sit higher. The band's bottom is the front row's ground line.
  const rowGap = band.height / (rows + 1.6);
  const groundY = band.height - row * rowGap;

  return { x, groundY, row };
}

/**
 * The band's height and figure scale.
 *
 * Desktop spends its extra height on DEPTH (scale held at 0.2) because there is width to
 * spare and the room needs floor. Mobile spends it on SIZE (0.13 -> 0.20) because at 25px
 * tall a wave is a few pixels and nothing reads.
 *
 * Provisional until screenshotted at a 768px-tall viewport -- see the measurement task. The
 * band is flex-shrink-0 above a flex-1 question area, so every pixel here comes out of the
 * question card's allowance.
 */
export function bandFor(isMobile: boolean): CrowdBand {
  return {
    width: 1000,                      // nominal; figures are placed proportionally
    height: isMobile ? 100 : 190,
    scale: 0.2,
  };
}

/**
 * How many bobits wander at once. The rest stand at their home slots.
 *
 * MEASURED 2026-09-13 (scripts/bobit-bench.mjs, 100 residents, 4x CPU throttle, 600 frames):
 * the cast does not constrain performance. The worst case measured -- every one of the 100
 * wandering, mid-celebration -- was 4.48ms against a 16.7ms budget. The O(N^2) separation
 * check this constant was originally sized around costs 0.8ms at 10,000 comparisons. Paint
 * dominates at ~3.4ms and is FLAT across every cast size, because the room is always
 * CROWD_CAP figures whether they walk or stand.
 *
 * That falsified the prediction behind the first draft of this constant, which assumed 100
 * would be unaffordable. It is affordable. The real constraint is FLOOR SPACE: `wanderAdvance`
 * holds figures MIN_SEPARATION apart, so a band only fits so many walkers before they jam
 * shoulder to shoulder and spend every frame turning away from each other. A 340px phone band
 * fits 22 at the absolute minimum gap -- which is why a fixed 24 looked crowded on mobile and
 * fine on desktop.
 *
 * So the cast is derived from the width instead of guessed, at a comfortable 2.5x the minimum
 * gap: ~37 on a 1440px desktop band, ~8 on a 340px phone. Both are far under the performance
 * ceiling, which is CROWD_CAP.
 */
const COMFORT_MULTIPLE = 2.5;

export function wanderCastFor(width: number, band: CrowdBand): number {
  const gap = MIN_SEPARATION * band.scale * COMFORT_MULTIPLE;
  if (!(width > 0) || !(gap > 0)) return 1;
  // At least a few, however narrow the band: a room with nobody moving is not a room.
  return Math.max(3, Math.min(CROWD_CAP, Math.floor(width / gap)));
}

/**
 * Rig units from a standing figure's ground line to the top of whatever it can raise.
 *
 * The figure itself is ~208 (pelvisOffset 112 + fieldGeometry's ABOVE_PELVIS 96), but `cheer`,
 * `jump` and `dance` put the arms overhead, well past the bounding box that only had to
 * contain a wave. 240 covers the raised-arm poses with a little air.
 */
const HEADROOM_UNITS = 240;

/**
 * The vertical span wandering agents occupy: the lower 60% of the band, but never so high
 * that a figure at the back is clipped by the top of the canvas.
 *
 * The clamp is not theoretical. At mobile's 100px band the 40% line sits at 40px while a
 * figure stands ~42px tall, and the back row rendered with its heads sliced off flat. The
 * unit tests were green -- a screenshot caught it.
 */
export function stageBounds(band: CrowdBand) {
  const clearance = HEADROOM_UNITS * band.scale;
  // Never let the clamp collapse the stage entirely: keep at least a third of the band
  // walkable even on a very short one.
  const top = Math.min(Math.max(band.height * 0.4, clearance), band.height * 0.67);
  return { top, bottom: band.height };
}

/**
 * Where a wandering agent stands, from its depth.
 *
 * Depth exists because free wandering without it puts every agent on one horizontal line,
 * which reads as a conga queue rather than a crowd. The +/-8% scale swing is what sells it as
 * distance rather than as figures at different heights.
 */
export function agentPlacement(depth: number, band: CrowdBand) {
  const d = Math.min(1, Math.max(0, depth));
  const { top, bottom } = stageBounds(band);
  return {
    groundY: bottom - d * (bottom - top),
    scale: band.scale * (1.08 - 0.16 * d),
  };
}
