/**
 * Drive a REAL 25% milestone and photograph the sprout.
 *
 * NOT `__bobitScene`: that passes a synthetic `replay-<ts>` id that never becomes a resident,
 * so the newcomer renders as an orphan with no agent -- a tool structurally unable to show a
 * whole class of bug. The tree has to be EARNED while the camera is watching.
 *
 * milwaukee-wi's mock has questionCount 120, so the threshold is 30 residents. Q1/Q2 are
 * already-owned ids and grant nobody; Q3 is the first new one. Seed 29 and the third correct
 * answer crosses it live.
 */
import { chromium } from 'playwright';

const BASE = 'http://localhost:5173';
const OUT = '.shots';


const browser = await chromium.launch({ args: ['--no-sandbox'] });
const context = await browser.newContext({ deviceScaleFactor: 1 });
await context.addInitScript(() => {
  localStorage.setItem('ctc-theme', 'dark');
  // The high-water mark is monotonic and survives reloads -- an earlier run's peak of 60 would
  // mean the tree is inherited rather than earned, and inherited trees get no ceremony.
  localStorage.removeItem('ctc.bobits.peak.v1');
});
const page = await context.newPage();
await page.setViewportSize({ width: 1920, height: 1080 });
page.on('console', m => { if (m.type() === 'error') console.log('    console:', m.text()); });

await page.goto(`${BASE}/?mock=1&collection=milwaukee-wi&owned=29&bobitSeed=milestone`);
await page.getByRole('button', { name: /play now|continue playing|quick play/i }).click();
await page.waitForTimeout(4000);

for (let q = 1; q <= 3; q++) {
  const a = page.getByRole('button', { name: /A — correct/ });
  await a.waitFor({ timeout: 15000 });
  await a.click();
  const lock = page.getByRole('button', { name: /lock in/i });
  if (await lock.count()) await lock.click().catch(() => {});
  await page.waitForTimeout(1200);
  if (q === 3) break;
  const next = page.getByRole('button', { name: /next/i });
  await next.waitFor({ timeout: 15000 });
  await next.click();
  await page.waitForTimeout(1500);
}

// The sprout is TREE_GROW_SEC = 3s, and the ceremony 7s. Sample across both.
for (let i = 0; i < 8; i++) {
  await page.screenshot({ path: `${OUT}/milestone-${i}.png` });
  await page.waitForTimeout(700);
}
console.log(`wrote ${OUT}/milestone-0..7.png — now LOOK at them:`);
console.log('  - does it SPROUT out of the floor, or appear at full height?');
console.log('  - is anybody drawn floating beside a half-grown tree?');
console.log('  - are the two admirers standing UNDER the trunk?');
await browser.close();
