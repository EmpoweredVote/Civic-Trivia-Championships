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
