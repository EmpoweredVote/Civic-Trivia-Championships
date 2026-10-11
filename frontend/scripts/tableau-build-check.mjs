/**
 * In-browser check for the tableau WORKSITE -- a line going up on camera.
 *
 * The contact sheets (`bobit-tableau.mjs`) photograph states that are already STANDING:
 * `&tableau=N` snaps the stack to N lines and `linesStandingOnArrival` deliberately builds
 * none of them on camera. So nothing in this repo exercised `assignJob`, `crewStations` or
 * `crewAt` until this script -- the whole crew, the part of the tableau that actually moves,
 * had no gate at all -- which is how M1 shipped: the crew gathered at a fraction of the BAND
 * while `crewAt` read the CANVAS, and jumped 691px across the question column on the frame the
 * line appeared (#205).
 *
 * BE CLEAR ABOUT WHAT THIS CANNOT SEE. It would NOT have caught M1. A teleporting crew throws
 * nothing, stalls nothing and still puts the line up, so it satisfies every assertion below.
 * The handover geometry is held by the `crewStations` unit tests, which compare the two
 * coordinate spaces directly; this script holds the three failures a unit test cannot see,
 * because `vitest.config.ts` is `environment: 'node'` and nothing in the suite renders.
 *
 * The only way to see a build is to EARN one. `&owned=19` leaves the peak one bobit short of
 * line 5, so answering the first new question correctly takes it to 20 and the trunk goes up
 * live. Line 5 on purpose: it is the first line on the right, the side where the two
 * coordinate spaces are furthest apart, and the stick a player watches more than any other.
 *
 * FOUR assertions, and the third is the one with teeth:
 *
 *   1. No console errors and nothing uncaught while the build runs.
 *   2. The frame loop keeps ticking. C1 of the tableau review was a throw INSIDE
 *      `BobitField`'s rAF callback, before it scheduled the next frame -- the band simply
 *      stopped for the rest of the match, with nothing in the console after the first throw.
 *      A stalled loop is therefore invisible to (1) and shows up only as canvases whose
 *      pixels stop changing.
 *   3. The MARGIN canvases gain ink. (1) and (2) are both satisfied by a worksite that never
 *      runs at all -- which is exactly what C3 did on a phone -- so this is what distinguishes
 *      a build from a quiet room. The band is excluded deliberately: its crowd never stops
 *      moving, and a whole-page total would hide a dead worksite inside that noise.
 *   4. The band paints in FRONT of the margins -- the crowd walks past the foot of the trunk
 *      rather than being erased by it. Asserted as the MECHANISM (the band canvas is
 *      positioned, and follows both margins in document order) rather than as pixels: whether
 *      anyone is actually standing in the trunk's footprint on a given frame is luck, and a
 *      gate that depends on luck is a gate that gets disabled. See CollectionCrowd.
 *
 * DEV SERVER ONLY. It drives `?mock=1`, which is compiled out of a production build, and the
 * React warnings (1) looks for are development-only too.
 *
 * Usage:  npm run dev        (in another shell)
 *         npm run check:tableau
 *         TABLEAU_CHECK_URL=http://localhost:5174 npm run check:tableau
 *         TABLEAU_CHECK_SHOTS=.shots/build npm run check:tableau   (keep the frames)
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const BASE = process.env.TABLEAU_CHECK_URL || 'http://localhost:5173';
const SHOTS = process.env.TABLEAU_CHECK_SHOTS || null;
const TIMEOUT = Number(process.env.TABLEAU_CHECK_TIMEOUT || 30000);

/** One short of line 5, so one correct answer puts the trunk up on the right-hand stack. */
const OWNED = 19;

/** fetch 3 + haul 4 + raise 3.5 + lash 3.5, plus room for the reveal that precedes it. */
const SAMPLES = 16;

/**
 * Console output that is NOT a failure. Empty on purpose, exactly as in `game-smoke.mjs`:
 * add an entry only with a comment saying why it is noise rather than a defect.
 */
const ALLOW = [];

if (SHOTS) await mkdir(SHOTS, { recursive: true });

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

const problems = [];
const note = (kind, text) => {
  if (ALLOW.some(re => re.test(text))) return;
  problems.push(`${kind}: ${text}`);
};
page.on('console', m => { if (m.type() === 'error') note('console.error', m.text()); });
page.on('pageerror', e => note('uncaught', e.message));

/**
 * A fingerprint per canvas: a stride-sampled hash of the alpha channel, plus an ink count.
 *
 * Sampled rather than hashed whole because this runs 16 times against four canvases at 1920,
 * and the question it answers -- did ANY pixel change -- does not need every pixel.
 */
const fingerprint = () => page.evaluate(() => {
  const pinned = c => getComputedStyle(c).position === 'fixed'
    || (c.parentElement && getComputedStyle(c.parentElement).position === 'fixed');
  const out = [];
  for (const c of document.querySelectorAll('canvas')) {
    const ctx = c.getContext('2d');
    if (!ctx || !c.width || !c.height) { out.push({ hash: 'none', ink: 0 }); continue; }
    const { data } = ctx.getImageData(0, 0, c.width, c.height);
    let hash = 0, ink = 0;
    for (let i = 3; i < data.length; i += 4 * 37) {
      const a = data[i];
      if (a > 8) ink++;
      hash = (hash * 31 + a) | 0;
    }
    // A margin canvas is the tall one. The band is the full width of the shell and 96px high,
    // and its crowd mills about constantly -- counting it would hide a worksite that never
    // ran inside the noise of twenty bobits wandering.
    //
    // Height alone is NOT enough, and this was wrong until 2026-10-11. Two other canvases on
    // this page are tall and transient: the aerial overlay (a `position: fixed` wrapper,
    // mounted only while a figure is airborne) and confetti (a full-viewport `position: fixed`
    // canvas of its own, fired on a correct answer). Either one up at the first sample and
    // gone by the last reads as the TABLEAU LOSING INK -- a false failure on assertion 3, in a
    // run that answers three questions correctly on purpose. Both are pinned to the viewport;
    // the two margins and the band are not.
    out.push({ hash: String(hash), ink, tableau: c.height > 200 && !pinned(c) });
  }
  return out;
});

/**
 * (4) Paint order, read off the live document rather than off the stylesheet.
 *
 * Margins are `position: absolute`; the band was a plain block until 2026-10-11, so CSS put
 * the margins in step 8 of Appendix E and the band back in step 4 and the trunk was drawn OVER
 * the crowd. Both halves matter and either one alone is worthless: a positioned band that came
 * FIRST would lose the tie, and a last-in-tree band that is `static` never enters the layer.
 */
const paintOrder = () => page.evaluate(() => {
  // Same filter as `fingerprint`, for the same reason: the aerial overlay and the confetti
  // canvas are both tall, both transient and both pinned to the viewport, so height alone
  // would report margins that are not margins.
  const pinned = c => getComputedStyle(c).position === 'fixed'
    || (c.parentElement && getComputedStyle(c.parentElement).position === 'fixed');
  const all = [...document.querySelectorAll('canvas')].filter(c => !pinned(c));
  const margins = all.filter(c => c.getBoundingClientRect().height > 200);
  // The band is the full-bleed short one.
  const band = all
    .filter(c => !margins.includes(c))
    .sort((a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width)[0];
  if (!band) return { error: 'no band canvas on the page' };
  if (!margins.length) return { error: 'no margin canvas to compare against' };
  const before = margins.filter(
    m => band.compareDocumentPosition(m) & Node.DOCUMENT_POSITION_PRECEDING,
  ).length;
  return { position: getComputedStyle(band).position, margins: margins.length, before };
});

const samples = [];
let order = null;
try {
  await page.goto(
    `${BASE}/?mock=1&collection=milwaukee-wi&owned=${OWNED}&bobitSeed=tableau-build-check`,
    { timeout: TIMEOUT },
  );

  const play = page.getByRole('button', { name: /play now|continue playing|quick play/i });
  await play.waitFor({ timeout: TIMEOUT });
  await play.click();

  // Q1 and Q2 are bobits the player already owns, so they earn nothing; Q3 is new and its
  // correct answer is the 20th bobit. 'A' is always right in the dev mock.
  for (let q = 1; q <= 3; q++) {
    const answer = page.getByRole('button', { name: /A\s*[—-]\s*correct/i }).first();
    await answer.waitFor({ timeout: TIMEOUT });
    await answer.click();
    if (q < 3) {
      // The reveal does not auto-advance; the player clicks on.
      const next = page.getByRole('button', { name: /next question/i }).first();
      await next.waitFor({ timeout: TIMEOUT });
      await next.click();
      await page.waitForTimeout(1500);
    }
  }

  order = await paintOrder();

  for (let i = 0; i < SAMPLES; i++) {
    samples.push(await fingerprint());
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/build-${String(i).padStart(2, '0')}s.png` });
    await page.waitForTimeout(1000);
  }
} catch (err) {
  problems.push(`drive: ${err.message.split('\n')[0]}`);
} finally {
  await browser.close();
}

// (2) The frame loop. Three still seconds is far past any legitimate pause: the crowd wanders
// continuously and the build itself moves every frame for fourteen seconds.
let run = 0, longestStill = 0;
for (let i = 1; i < samples.length; i++) {
  const a = samples[i - 1], b = samples[i];
  const same = a.length === b.length && a.every((c, j) => c.hash === b[j].hash);
  run = same ? run + 1 : 0;
  longestStill = Math.max(longestStill, run);
}
if (longestStill >= 3) {
  problems.push(
    `frame loop stalled: ${longestStill} consecutive identical seconds across every canvas. ` +
    'A throw inside the rAF callback stops the band without logging anything after it.',
  );
}

// (3) The build. Ink is counted across all four canvases; a line going up can only add to it.
const inkOf = s => (s ?? []).filter(c => c.tableau).reduce((sum, c) => sum + c.ink, 0);
const first = inkOf(samples[0]), last = inkOf(samples[samples.length - 1]);
if (samples.length === 0) {
  problems.push('build: no frames sampled at all');
} else if (!samples[0].some(c => c.tableau)) {
  problems.push('build: no margin canvas mounted at 1920 -- there is no tableau to build on');
} else if (last <= first) {
  problems.push(
    `build: tableau ink did not grow (${first} -> ${last}). The worksite never ran, or it ran ` +
    'for a canvas that is not mounted -- which is what C3 did on every phone.',
  );
}

// (4) Paint order.
if (!order) {
  problems.push('paint order: never read -- the run did not get far enough to look');
} else if (order.error) {
  problems.push(`paint order: ${order.error}`);
} else {
  if (order.position === 'static') {
    problems.push(
      'paint order: the band canvas is `position: static`, so it paints in step 4 and every ' +
      'positioned margin paints over it -- the trunk erases the crowd at its foot.',
    );
  }
  if (order.before !== order.margins) {
    problems.push(
      `paint order: only ${order.before} of ${order.margins} margins precede the band in the ` +
      'document, so a margin wins the tree-order tie and paints over the crowd.',
    );
  }
}

if (problems.length) {
  console.error(`\n  tableau build check FAILED at ${BASE} -- ${problems.length} problem(s):\n`);
  for (const p of problems) console.error(`    ${p}`);
  console.error('');
  process.exit(1);
}

console.log(
  `  tableau build check OK -- line 5 went up at ${BASE} ` +
  `(ink ${first} -> ${last}, longest still run ${longestStill}s, band \`${order.position}\` ` +
  `after ${order.before}/${order.margins} margins)`,
);
