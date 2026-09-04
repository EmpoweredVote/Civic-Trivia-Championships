/**
 * THROWAWAY benchmark driver for the Stage 2 bobit performance spike.
 *
 * Ramps population against /perf-lab and reports where each configuration falls off a 60fps
 * budget. Device classes are CPU throttling rates applied through CDP.
 *
 * CAVEAT worth carrying into any conclusion: CPU throttling slows JavaScript and the CPU side
 * of rasterisation, but leaves the GPU alone. A real mid-tier phone has a weaker GPU too, so
 * these numbers FLATTER mobile -- especially for the cached mode, which is blit-heavy and
 * therefore more GPU-bound than the naive path.
 *
 * Usage: node scripts/perf-bench.mjs [baseUrl]
 */
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const BASE = process.argv[2] || 'http://localhost:10000';
const URL = `${BASE}/perf-lab`;

const DEVICES = [
  { name: 'desktop (1x)', rate: 1 },
  { name: 'mid phone (4x)', rate: 4 },
  { name: 'low phone (6x)', rate: 6 },
];

const SCENES = ['idle', 'wave', 'unique'];
const MODES = ['naive', 'cached'];
const COUNTS = [25, 50, 91, 154, 250, 400, 650, 1000];

/** 60fps budget. A configuration is over when the median DRAW time exceeds it. */
const BUDGET_MS = 1000 / 60;

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const rows = [];
const caps = [];

for (const device of DEVICES) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__perf, null, { timeout: 30000 });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: device.rate });

  for (const scene of SCENES) {
    for (const mode of MODES) {
      let cap = null;
      for (const count of COUNTS) {
        await page.evaluate(o => window.__perf.start(o), { scene, mode, count, seconds: 2 });
        await page.waitForFunction(() => window.__perfResult !== null, null, { timeout: 180000 });
        const r = await page.evaluate(() => window.__perfResult);

        rows.push({ device: device.name, rate: device.rate, ...r });
        const over = r.drawMedian > BUDGET_MS;
        process.stdout.write(
          `${device.name.padEnd(15)} ${scene.padEnd(7)} ${mode.padEnd(7)} ` +
          `n=${String(count).padStart(5)}  draw ${String(r.drawMedian).padStart(7)}ms  ` +
          `p95 ${String(r.drawP95).padStart(7)}ms  frame ${String(r.frameMedian).padStart(6)}ms` +
          `${over ? '   << OVER' : ''}\n`,
        );
        if (over) { cap = count; break; }
      }
      caps.push({ device: device.name, scene, mode, firstOverAt: cap });
    }
  }
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await context.close();
}

writeFileSync('perf-results.json', JSON.stringify({ rows, caps }, null, 2));

console.log('\n=== first count OVER a 16.7ms draw budget (null = never, up to 1000) ===');
for (const c of caps) {
  console.log(
    `${c.device.padEnd(15)} ${c.scene.padEnd(7)} ${c.mode.padEnd(7)} ` +
    `${c.firstOverAt === null ? 'held to 1000' : `over at ${c.firstOverAt}`}`,
  );
}
await browser.close();
