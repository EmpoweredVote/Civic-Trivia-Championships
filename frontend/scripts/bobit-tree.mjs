/**
 * Contact sheets for the margin tree.
 *
 * FULL-VIEWPORT screenshots, not the tree canvas alone. The whole question this sheet answers
 * is how the tree sits NEXT TO the card -- whether it crowds the HUD, whether the lowest branch
 * crowds the answers, whether the margin reads as heavy. A crop of the canvas cannot show any
 * of that. (The cannon taught the same lesson: its flight is on the fixed overlay, so band-only
 * shots missed it entirely.)
 *
 * Widths span both sides of MIN_TREE_MARGIN, so the fallback to the in-band tree is visible in
 * the same run as the thing it falls back from.
 *
 * Usage:  npm run dev      (in another shell)
 *         node scripts/bobit-tree.mjs
 *
 * Writes frontend/.shots/tree-<width>-<theme>.png and tree-climb-<theme>-<n>.png.
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const BASE = process.env.SHOTS_URL || 'http://localhost:5173';
const OUT = '.shots';
const SEED = 'bobit-tree';
const SLUG = 'milwaukee-wi';

/** Both sides of the 140px margin crossover. 1024 should show the IN-BAND tree. */
const WIDTHS = [1920, 1440, 1280, 1024];

/**
 * Enough owned questions to be past 25% of the collection, so the tree is standing. The tree is
 * earned off a HIGH-WATER MARK held in localStorage, so it survives between the shots below.
 */
const OWNED = 60;

async function openRoom(context, width, height) {
  const page = await context.newPage();
  await page.setViewportSize({ width, height });
  page.on('console', m => {
    if (m.type() === 'error' || m.text().includes('[bobits]')) {
      console.log(`    console: ${m.text()}`);
    }
  });
  await page.goto(`${BASE}/?mock=1&collection=${SLUG}&owned=${OWNED}&bobitSeed=${SEED}`);
  const play = page.getByRole('button', { name: /play now|continue playing|quick play/i });
  await play.waitFor({ timeout: 20000 });
  await play.click();
  return page;
}

async function run() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ args: ['--no-sandbox'] });

  for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({ deviceScaleFactor: 1 });
    await context.addInitScript(t => localStorage.setItem('ctc-theme', t), theme);

    for (const width of WIDTHS) {
      const page = await openRoom(context, width, 1080);
      // Long enough for the crowd to settle AND for somebody to have been sent up the tree:
      // assignPerch only picks a genuinely idle wanderer, and the climb itself is up to 4.4s.
      await page.waitForTimeout(14000);
      await page.screenshot({ path: `${OUT}/tree-${width}-${theme}.png` });
      console.log(`  shot: tree-${width}-${theme}`);
      await page.close();
    }

    // A climb, sampled. One page, frames across the time a bobit takes to go up.
    const page = await openRoom(context, 1920, 1080);
    await page.waitForTimeout(5000);
    for (let i = 0; i < 8; i++) {
      await page.screenshot({ path: `${OUT}/tree-climb-${theme}-${i}.png` });
      await page.waitForTimeout(1100);
    }
    console.log(`  strip: tree-climb-${theme} (8 frames)`);
    await page.close();

    await context.close();
  }

  await browser.close();
  console.log(`\nWrote sheets to ${OUT}/. Now LOOK at them.`);
}

run().catch(err => { console.error(err); process.exitCode = 1; });
