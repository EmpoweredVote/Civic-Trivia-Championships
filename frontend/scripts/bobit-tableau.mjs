/**
 * Contact sheets for the collection tableau.
 *
 * FULL-VIEWPORT screenshots, not the margin canvases alone. The whole question these sheets
 * answer is how the tableau sits NEXT TO the card -- whether either stack crowds the HUD or
 * the answers, whether the two sides read as the same world, whether step 9 of 25 looks
 * deliberate or like a pile of sticks. A crop of a canvas cannot show any of that. (The cannon
 * taught the same lesson: its flight is on the fixed overlay, so band-only shots missed it.)
 *
 * ONE VIEWPORT PER PROCESS. `bobit-recap.mjs` was OOM-killed three times sharing a single
 * Chromium across rows, so this takes TABLEAU_WIDTHS / TABLEAU_THEMES / TABLEAU_STATES and the
 * caller runs it once per width.
 *
 * Usage:  npm run dev      (in another shell)
 *         node scripts/bobit-tableau.mjs
 *         TABLEAU_WIDTHS=1920 node scripts/bobit-tableau.mjs
 *         TABLEAU_STATES=0,4,9,13,17,21,25 node scripts/bobit-tableau.mjs
 *
 * Writes frontend/.shots/tableau-<state>-<width>-<theme>.png
 *    and frontend/.shots/tableau-curl-<theme>-<n>.png
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const BASE = process.env.SHOTS_URL || 'http://localhost:5173';
const OUT = '.shots';
const SEED = 'bobit-tableau';
const SLUG = 'milwaukee-wi';

const list = (env, fallback) =>
  (process.env[env] ? process.env[env].split(',') : fallback).map(s => String(s).trim());

/**
 * Widths. 1024 lands at ~138px per margin, under the 140px threshold, so it should show NO
 * tableau at all -- the sheet that proves the desktop-only rule rather than assuming it.
 */
const WIDTHS = list('TABLEAU_WIDTHS', [1920, 1440, 1280, 1024]).map(Number);
const THEMES = list('TABLEAU_THEMES', ['light', 'dark']);

/**
 * All 26 states by default, 0 through 25.
 *
 * Every one of them, not a sample: the question "does this look deliberate at step 9" has to
 * be asked at every step, because the answer changes structure by structure and a sample picks
 * exactly the states somebody already thought about.
 */
const STATES = list('TABLEAU_STATES', Array.from({ length: 26 }, (_, i) => i)).map(Number);

async function openRoom(context, width, height, query) {
  const page = await context.newPage();
  await page.setViewportSize({ width, height });
  page.on('console', m => {
    if (m.type() === 'error') console.log(`    console error: ${m.text()}`);
  });
  await page.goto(`${BASE}/?mock=1&collection=${SLUG}&bobitSeed=${SEED}&${query}`);
  const play = page.getByRole('button', { name: /play now|continue playing|quick play/i });
  await play.waitFor({ timeout: 20000 });
  await play.click();
  return page;
}

async function run() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ args: ['--no-sandbox'] });

  for (const theme of THEMES) {
    for (const width of WIDTHS) {
      // A FRESH context per state. `seedOwned` deliberately refuses to clobber existing
      // progress, and the high-water mark is monotonic by design -- so reusing a context
      // would make state 4 impossible to photograph after state 25, and every later sheet
      // would silently show the largest tableau requested so far.
      for (const state of STATES) {
        const context = await browser.newContext({ deviceScaleFactor: 1 });
        await context.addInitScript(t => localStorage.setItem('ctc-theme', t), theme);
        const page = await openRoom(context, width, 1080, `tableau=${state}`);
        // Enough for the tableau to draw and the crowd to spread out. Deliberately NOT long
        // enough to guarantee somebody has climbed -- that is what the curl strip below is
        // for, and 26 states x 4 widths x 2 themes at climb-length waits is forty minutes of
        // wall clock to answer a question about how the scenery looks.
        await page.waitForTimeout(Number(process.env.TABLEAU_SETTLE ?? 4500));
        await page.screenshot({
          path: `${OUT}/tableau-${String(state).padStart(2, '0')}-${width}-${theme}.png`,
        });
        console.log(`  shot: tableau-${state}-${width}-${theme}`);
        await page.close();
        await context.close();
      }
    }

    // NO curl strip here. It used to open `tableau=9` and shoot eight frames 1.2s apart,
    // which photographs a FINISHED tree: `&tableau=N` seeds what is already standing, so the
    // worksite has nothing to do and the curl never goes up on camera. A strip that cannot
    // show the thing it is named after is worse than no strip, because it reads as coverage.
    // `bobit-crossing.mjs` drives it for real:  CROSS_OWNED=35 node scripts/bobit-crossing.mjs
  }

  await browser.close();
  console.log(`\nWrote sheets to ${OUT}/. Now LOOK at them.`);
}

run().catch(err => { console.error(err); process.exitCode = 1; });
