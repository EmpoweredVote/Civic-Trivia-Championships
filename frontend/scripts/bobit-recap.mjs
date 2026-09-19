/**
 * Contact sheets for the recap crowd, plus the scroll measurement.
 *
 * FULL-VIEWPORT screenshots: the questions this answers are how the band sits under the recap
 * panels, whether the bowers are findable among the audience, and whether the page scrolls
 * before anybody expands a question. A crop of the band cannot show any of that.
 *
 * Drives a REAL match rather than mounting the screen directly, because who bows comes from
 * CollectionCrowd's own earn decision -- the one thing in this feature that no unit test can
 * reach (vitest here is node-only, and CollectionCrowd is a React component).
 *
 * Usage:  npm run dev      (in another shell)
 *         node scripts/bobit-recap.mjs
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const BASE = process.env.SHOTS_URL || 'http://localhost:5173';
const OUT = '.shots';
const SLUG = 'milwaukee-wi';

/** Rosters either side of the CROWD_CAP of 100, and one small enough to count faces. */
const ALL_ROSTERS = [5, 40, 100, 140];
const ALL_WIDTHS = [[1920, 1080], [1440, 900], [1280, 800], [390, 844]];

// Each row drives a whole five-question match, so the full sweep is 32 of them. Narrow it
// while iterating: RECAP_OWNED=40 RECAP_WIDTHS=1920 RECAP_THEMES=dark node scripts/...
const pick = (env, all, map = Number) =>
  (process.env[env] ? process.env[env].split(',').map(map) : all);
const ROSTERS = pick('RECAP_OWNED', ALL_ROSTERS);
const WIDTHS = process.env.RECAP_WIDTHS
  ? process.env.RECAP_WIDTHS.split(',').map(w => ALL_WIDTHS.find(x => x[0] === Number(w)))
  : ALL_WIDTHS;
const THEMES = process.env.RECAP_THEMES ? process.env.RECAP_THEMES.split(',') : ['light', 'dark'];

/**
 * Click whatever is in front of us until the recap appears.
 *
 * ADVANCE FIRST, answer second. The obvious ordering -- answer, then advance -- re-clicks the
 * already-selected answer forever once a question is revealed, because the answer button is
 * still there and still enabled. Cost an hour the first time.
 */
async function driveToRecap(page) {
  for (let step = 0; step < 80; step++) {
    const txt = await page.evaluate(() => document.body.innerText);
    if (/play again/i.test(txt)) return true;
    const click = async (re) => {
      const b = page.getByRole('button', { name: re }).first();
      if (await b.count() && await b.isEnabled().catch(() => false)) {
        await b.click({ timeout: 2000 }).catch(() => {});
        return true;
      }
      return false;
    };
    if (await click(/lock in|next|continue|last question|game recap|see results|finish/i)) {
      await page.waitForTimeout(900);
    } else if (await click(/place|wager|confirm|submit|all in|skip/i)) {
      await page.waitForTimeout(900);
    } else if (await click(/A — correct/)) {
      await page.waitForTimeout(700);
    } else {
      await page.waitForTimeout(600);
    }
  }
  return false;
}

async function run() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const rows = [];

  for (const theme of THEMES) {
    for (const [w, h] of WIDTHS) {
      for (const owned of ROSTERS) {
        const ctx = await browser.newContext({ deviceScaleFactor: 2 });
        await ctx.addInitScript(t => localStorage.setItem('ctc-theme', t), theme);
        const page = await ctx.newPage();
        await page.setViewportSize({ width: w, height: h });
        page.on('console', m => {
          if (m.type() === 'error') console.log(`    console: ${m.text()}`);
        });

        await page.goto(`${BASE}/?mock=1&collection=${SLUG}&owned=${owned}&bobitSeed=recap`);
        await page.getByRole('button', { name: /play now|continue playing|quick play/i })
          .click();
        await page.waitForTimeout(2000);

        const reached = await driveToRecap(page);
        await page.waitForTimeout(3000);

        const m = await page.evaluate(() => ({
          doc: document.documentElement.scrollHeight,
          view: window.innerHeight,
        }));
        const verdict = m.doc > m.view + 2 ? `SCROLLS by ${m.doc - m.view}px` : 'fits';
        const row =
          `  ${theme.padEnd(5)} ${String(w).padStart(4)}x${h} owned=${String(owned).padStart(3)} ` +
          `reached=${reached}  ${m.doc}px vs ${m.view}px -> ${verdict}`;
        rows.push(row);
        console.log(row);

        await page.screenshot({ path: `${OUT}/recap-${theme}-${w}-${owned}.png` });
        // A tight crop of the band. The full shot answers "where does it sit"; this one
        // answers "is that a bow?", which at a 96px band in a 1080px page it cannot.
        const band = await page.evaluate(() => {
          const cs = Array.from(document.querySelectorAll('canvas'));
          const c = cs[cs.length - 1];
          if (!c) return null;
          const r = c.getBoundingClientRect();
          return { x: r.x, y: r.y, width: r.width, height: r.height };
        });
        if (band && band.height > 0) {
          await page.screenshot({
            path: `${OUT}/recap-${theme}-${w}-${owned}-band.png`,
            clip: { x: band.x, y: Math.max(0, band.y - 10), width: band.width,
                    height: band.height + 14 },
          });
        }
        // The whole page too, so a band below the fold is still visible in the sheet.
        await page.screenshot({
          path: `${OUT}/recap-${theme}-${w}-${owned}-full.png`, fullPage: true,
        });
        await ctx.close();
      }
    }
  }

  await browser.close();
  console.log('\n=== SCROLL MEASUREMENT ===');
  for (const r of rows) console.log(r);
  console.log(`\nWrote sheets to ${OUT}/. Now LOOK at them.`);
}

run().catch(err => { console.error(err); process.exitCode = 1; });
