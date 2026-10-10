/**
 * End-to-end frame cost with the tableau MOUNTED.
 *
 * `bobit-bench.mjs` imports the modules and benches `crowdFigures` against a synthetic canvas,
 * which is the right tool for the band's simulation cost and the wrong one here: it never
 * mounts the two margin canvases, so it cannot see what they cost. This drives the real page
 * at a real width with a full tableau and a full room, and samples rAF deltas.
 *
 * Usage:  npm run dev   (in another shell)
 *         node scripts/bobit-tableau-bench.mjs
 */
import { chromium } from 'playwright';

const BASE = process.env.SHOTS_URL || 'http://localhost:5173';
const THROTTLE = Number(process.env.BENCH_THROTTLE || 4);
const FRAMES = 420;

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const context = await browser.newContext({ deviceScaleFactor: 1 });
const page = await context.newPage();
await page.setViewportSize({ width: 1920, height: 1080 });

for (const [label, query] of [
  ['empty margins (tableau=0)', 'tableau=0&owned=100'],
  ['full tableau (tableau=25)', 'tableau=25'],
]) {
  await context.clearCookies();
  await page.goto(`${BASE}/?mock=1&collection=milwaukee-wi&bobitSeed=bench&${query}`);
  const play = page.getByRole('button', { name: /play now|continue playing|quick play/i });
  await play.waitFor({ timeout: 20000 });
  await play.click();
  await page.waitForTimeout(6000);

  const session = await page.context().newCDPSession(page);
  await session.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });

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
    const warm = deltas.slice(60).sort((a, b) => a - b);
    return {
      median: warm[Math.floor(warm.length / 2)],
      p95: warm[Math.floor(warm.length * 0.95)],
      worst: warm[warm.length - 1],
    };
  }, FRAMES);

  console.log(
    `  ${label.padEnd(26)} median ${stats.median.toFixed(1)}ms  ` +
    `p95 ${stats.p95.toFixed(1)}ms  worst ${stats.worst.toFixed(1)}ms`,
  );
  await session.send('Emulation.setCPUThrottlingRate', { rate: 1 });
}

console.log(`\n  1920x1080, 100 residents, CPU throttled ${THROTTLE}x, ${FRAMES} frames.`);
console.log('  Frame DELTAS, so 16.7ms is the target cadence, not a cost.');
await browser.close();
