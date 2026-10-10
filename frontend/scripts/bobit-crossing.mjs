/**
 * Drive a REAL line-raising, the player's way.
 *
 * `owned=15` is three lines standing and one bobit short of the fourth, and the mock's Q3-Q5
 * are ids the room does not have -- so answering them correctly crosses 16 and sends a crew to
 * raise line 4 while the player watches. Driven through the UI rather than through a replay
 * hook: `__bobitScene` passes an id that never becomes a resident, and a tool that reaches past
 * the code it photographs can be structurally unable to show the bug it was built to find.
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const BASE = process.env.SHOTS_URL || 'http://localhost:5173';
const OUT = '.shots';

/**
 * How many bobits the room starts with, and what the next line therefore is.
 *
 * 15 is three lines standing and one short of the fourth -- the cabin's right rafter, a HOIST
 * onto a joint above the ground. 35 is eight lines and one short of the ninth -- the tree's
 * green curl, the one piece of this blueprint whose success is purely how it looks. Both are
 * driven the player's way; `&tableau=N` cannot show either, because it seeds what is already
 * standing and leaves the worksite with nothing to do.
 */
const OWNED = Number(process.env.CROSS_OWNED || 15);
const TAG = process.env.CROSS_TAG || `line${Math.floor(OWNED / 4) + 1}`;

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--no-sandbox'] });
const context = await browser.newContext({ deviceScaleFactor: 1 });
await context.addInitScript(() => localStorage.setItem('ctc-theme', 'light'));
const page = await context.newPage();
await page.setViewportSize({ width: 1920, height: 1080 });
page.on('pageerror', e => console.log(`[pageerror] ${e.message}`));

await page.goto(`${BASE}/?mock=1&collection=milwaukee-wi&owned=${OWNED}&bobitSeed=crossing`);
const play = page.getByRole('button', { name: /play now|continue playing|quick play/i });
await play.waitFor({ timeout: 20000 });
await play.click();

// A is always correct in the mock. Answer, reveal, Next -- five times.
for (let q = 1; q <= 3; q++) {
  // The answer buttons DISABLE during the reveal, so wait for an enabled one rather than for
  // a visible one -- the previous question's greyed-out button is visible the whole time.
  const a = page.getByRole('button', { name: /A — correct/ });
  await a.waitFor({ state: 'visible', timeout: 20000 });
  await page.waitForFunction(() => {
    const b = [...document.querySelectorAll('button')]
      .find(x => (x.textContent || '').includes('A — correct'));
    return !!b && !b.disabled;
  }, undefined, { timeout: 20000 });
  await a.click();

  const next = page.getByRole('button', { name: /next question|see results|finish/i }).first();
  await next.waitFor({ state: 'visible', timeout: 20000 });
  // From the third correct answer the room crosses 16 bobits and a crew sets off. Shoot the
  // build BEFORE clicking Next, so the frames span the reveal the raise actually happens in.
  if (q >= 3) {  // owned=15 is 3 lines; Q3 grants the 16th bobit and line 4 goes up
    for (let i = 0; i < 7; i++) {
      await page.screenshot({ path: `${OUT}/crossing-${TAG}-${i}.png` });
      await page.waitForTimeout(1700);
    }
  }
  await next.click();
  await page.waitForTimeout(500);
}
console.log(`crossing frames written to ${OUT}/crossing-${TAG}-*.png`);
await browser.close();
