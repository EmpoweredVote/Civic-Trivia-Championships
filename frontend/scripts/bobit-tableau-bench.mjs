/**
 * End-to-end frame cost with the tableau MOUNTED.
 *
 * `bobit-bench.mjs` imports the modules and benches `crowdFigures` against a synthetic canvas,
 * which is the right tool for the band's simulation cost and the wrong one here: it never
 * mounts the two margin canvases, so it cannot see what they cost.
 *
 * TWO THINGS THIS GETS RIGHT THAT THE FIRST DRAFT DID NOT:
 *
 * 1. `&tableau=N` OVERRIDES `&owned=N` in the mock, so a row asking for `tableau=0&owned=100`
 *    ran with ZERO residents and was not a baseline at all.
 * 2. At 4x throttle both rows were vsync-locked at 16.7ms, which says only that both hit
 *    60fps -- it cannot distinguish 2ms of work from 15ms. The throttle has to be high enough
 *    that frames are NOT capped before a delta means anything.
 *
 * THE CONFOUND, stated rather than hidden: the no-tableau row is a 1024px viewport, because
 * that is the only way to have the same residents with no margin canvases. A narrower band
 * also means a smaller wandering cast (`wanderCastFor`), so the two rows differ by more than
 * the tableau. It bounds the cost rather than isolating it.
 *
 * Usage:  npm run dev   (in another shell)
 *         node scripts/bobit-tableau-bench.mjs
 */
import { chromium } from 'playwright';

const BASE = process.env.SHOTS_URL || 'http://localhost:5173';
// High enough that a frame is not vsync-capped, so a delta is work rather than cadence.
const THROTTLE = Number(process.env.BENCH_THROTTLE || 20);
const FRAMES = 300;

const browser = await chromium.launch({ args: ['--no-sandbox'] });

for (const [label, width, owned] of [
  // Same viewport, empty room: the page's own cost, so the rows below can be read as a delta
  // rather than as an absolute that bundles React, the HUD and the timer.
  ['1920, empty room      ', 1920, 0],
  ['1920, 100 + tableau   ', 1920, 100],
  ['1024, 100, no tableau ', 1024, 100],
]) {
  const context = await browser.newContext({ deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.setViewportSize({ width, height: 1080 });
  // owned=100 both rows: a full room either way. At 1920 that is 25 lines and two canvases;
  // at 1024 the margins are under the threshold and nothing mounts.
  await page.goto(`${BASE}/?mock=1&collection=milwaukee-wi&bobitSeed=bench&owned=${owned}`);
  const play = page.getByRole('button', { name: /play now|continue playing|quick play/i });
  await play.waitFor({ timeout: 20000 });
  await play.click();
  await page.waitForTimeout(6000);

  const session = await page.context().newCDPSession(page);
  await session.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
  await page.waitForTimeout(1500);

  const stats = await page.evaluate(async (frames) => {
    const deltas = [];
    let last = performance.now();
    await new Promise(resolve => {
      let n = 0;
      const tick = (t) => {
        deltas.push(t - last);
        last = t;
        if (++n >= frames) return resolve();
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    const warm = deltas.slice(40).sort((a, b) => a - b);
    return {
      median: warm[Math.floor(warm.length / 2)],
      p95: warm[Math.floor(warm.length * 0.95)],
    };
  }, FRAMES);

  console.log(
    `  ${label}  median ${stats.median.toFixed(1)}ms  p95 ${stats.p95.toFixed(1)}ms` +
    `   (= ${(stats.median / THROTTLE).toFixed(2)}ms unthrottled)`,
  );
  await context.close();
}

console.log(`\n  100 residents, CPU throttled ${THROTTLE}x, ${FRAMES} frames.`);
console.log('  Unthrottled equivalent is the number to compare against the 16.7ms budget.');
console.log('  The two rows differ by viewport as well as by tableau -- see the header.');
await browser.close();
