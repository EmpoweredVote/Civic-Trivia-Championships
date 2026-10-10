/**
 * In-game browser smoke test.
 *
 * `smoke.mjs` proves the app MOUNTS. This proves a game RUNS CLEAN -- it drives a
 * real question in a real browser and fails on anything React complains about.
 *
 * Why this exists as a script rather than a test: `vitest.config.ts` sets
 * `environment: 'node'` deliberately, so nothing in the suite renders a component.
 * React's correctness warnings are therefore invisible to `npm test`, and they are
 * invisible to `tsc` and to `vite build` as well. On 2026-10-10 that gap let
 * `GameTimer` call the parent's `setCurrentTimeRemaining` from inside
 * `CountdownCircleTimer`'s children render prop -- a setState during another
 * component's render, logged on EVERY page load, green across every gate, and
 * found only by reading console output off a screenshot run (#203).
 *
 * TWO assertions, and the second is the important one:
 *
 *   1. No console errors while a question is live.
 *   2. The countdown still reaches GameScreen's state.
 *
 * (2) exists because (1) is trivially satisfiable by deleting the callback. The
 * "10 seconds remaining" announcement is driven by an effect on
 * `GameScreen.currentTimeRemaining`, so it can only fire if the value genuinely
 * arrives -- which makes it the thing that distinguishes a fix from a silencing.
 * A gate that only checks (1) would bless a change that breaks speed scoring.
 *
 * NOTE: the React warning this was written for is DEVELOPMENT-ONLY -- it is compiled
 * out of a production build. Point this at a dev server. Against production it would
 * pass whether or not the bug were present, which is worse than not running it.
 *
 * Usage:  npm run dev        (in another shell)
 *         npm run smoke:game
 *         GAME_SMOKE_URL=http://localhost:5174 npm run smoke:game
 */
import { chromium } from 'playwright';

const BASE = process.env.GAME_SMOKE_URL || 'http://localhost:5173';
const SLUG = process.env.GAME_SMOKE_COLLECTION || 'milwaukee-wi';
const TIMEOUT = Number(process.env.GAME_SMOKE_TIMEOUT || 30000);

/**
 * Console output that is NOT a failure. Empty on purpose: across 52 full page loads
 * the only error ever observed was the bug above. Add an entry only with a comment
 * saying why it is noise rather than a defect -- an allowlist that grows silently is
 * how this gate stops meaning anything.
 */
const ALLOW = [];

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage();

const problems = [];
const note = (kind, text) => {
  if (ALLOW.some(re => re.test(text))) return;
  problems.push(`${kind}: ${text}`);
};
page.on('console', m => { if (m.type() === 'error') note('console.error', m.text()); });
page.on('pageerror', e => note('uncaught', e.message));

let announced = null;
try {
  await page.goto(`${BASE}/?mock=1&collection=${SLUG}`, { timeout: TIMEOUT });

  const play = page.getByRole('button', { name: /play now|continue playing|quick play/i });
  await play.waitFor({ timeout: TIMEOUT });
  await play.click();

  // A question runs 20s and announces at 10s, so this settles in ~10s. There is no
  // shorter observable: the announcements are the only effects on currentTimeRemaining.
  // Its timeout IS the wire failure, so swallow it here and let the single specific
  // message below report it -- surfacing the raw timeout too names one cause twice.
  try {
    await page.waitForFunction(() => {
      const el = document.querySelector('[role="status"][aria-live="polite"]');
      const t = el?.textContent?.trim();
      if (t && /\d+ seconds remaining/.test(t)) { window.__gameSmokeSeen = t; return true; }
      return false;
    }, null, { timeout: TIMEOUT });
    announced = await page.evaluate(() => window.__gameSmokeSeen);
  } catch { /* reported as the wire failure below */ }
} catch (err) {
  problems.push(`drive: ${err.message.split('\n')[0]}`);
} finally {
  await browser.close();
}

if (!announced) {
  problems.push(
    'wire: no "N seconds remaining" announcement -- the countdown never reached ' +
    'GameScreen state. Speed scoring (lockAnswer/selectAnswer) reads that value.',
  );
}

if (problems.length) {
  console.error(`\n  game smoke FAILED at ${BASE} -- ${problems.length} problem(s):\n`);
  for (const p of problems) console.error(`    ${p}`);
  console.error('');
  process.exit(1);
}

console.log(`  game smoke OK -- question ran clean at ${BASE} (announced "${announced}")`);
