/**
 * Screenshot sweep for the bobit living floor.
 *
 * Numeric verification is not visual verification. The trophy-grip fix passed a joint-
 * coordinate contact test AND an independent kinematics review, and a screenshot then showed
 * both carriers in a T-pose -- the assertions constrained the two gripping hands and nothing
 * else. Every pose and every reaction in the living floor gets looked at here.
 *
 * Drives the real app with the game API mocked, so what is captured is the actual render path
 * rather than a component mounted in a harness.
 *
 * Usage:  npm run dev      (in another shell)
 *         node scripts/bobit-shots.mjs
 *
 * Writes PNGs to frontend/.shots/.
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const BASE = process.env.SHOTS_URL || 'http://localhost:5173';
const OUT = '.shots';
const SEED = 'bobit-shots';          // fixed, so every run frames the same room

const SLUG = 'milwaukee-wi';
const COLLECTION = {
  id: 1, name: 'Milwaukee WI', slug: SLUG, description: 'Cream City civics',
  themeColor: '#1E3A8A', questionCount: 120, tier: 'city',
  localeName: 'Wisconsin', localeCode: 'WI',
};

/** Five questions, enough to drive a whole match. */
const questions = Array.from({ length: 5 }, (_, i) => ({
  id: `milwi-${String(i + 1).padStart(3, '0')}`,
  questionText: `Milwaukee question ${i + 1}?`,
  options: ['First option', 'Second option', 'Third option', 'Fourth option'],
  difficulty: i === 4 ? 'hard' : 'easy',
  topic: 'Local government',
  category: 'city',
}));

async function mockApi(page) {
  // ORDER MATTERS: Playwright checks handlers in REVERSE registration order, so the catch-all
  // must be registered FIRST or it swallows the specific routes below it and every API call
  // comes back 204 -- which presents as "No collection selected" and no Play button.
  await page.route('**/api/**', route => route.fulfill({ status: 204, body: '' }));

  await page.route('**/api/game/collections', route =>
    route.fulfill({ json: { collections: [COLLECTION] } }));

  await page.route('**/api/game/session', route =>
    route.fulfill({
      json: {
        sessionId: 'shots-session', questions, degraded: false,
        collectionName: COLLECTION.name, collectionSlug: SLUG,
        gameMode: 'easy-steps', totalQuestions: 5,
      },
    }));
}

/** Put `count` owned bobits in storage for the collection, so the room is populated. */
async function seedOwned(page, count) {
  await page.addInitScript(([slug, n]) => {
    // bobitProgress keeps ONE key holding { [slug]: { [questionId]: true } } -- see
    // STORAGE_KEY in bobitProgress.ts. A per-slug key would read back as an empty room.
    const owned = {};
    for (let i = 1; i <= n; i++) owned[`milwi-${String(i).padStart(3, '0')}`] = true;
    localStorage.setItem('ctc.bobits.v1', JSON.stringify({ [slug]: owned }));
  }, [SLUG, count]);
}

/** The app owns its own theme in localStorage; prefers-color-scheme does not drive it. */
async function seedTheme(page, theme) {
  await page.addInitScript(t => localStorage.setItem('ctc-theme', t), theme);
}

async function shoot(page, name) {
  const band = page.locator('canvas').last();
  await band.screenshot({ path: `${OUT}/${name}.png` }).catch(async () => {
    await page.screenshot({ path: `${OUT}/${name}-full.png` });
  });
  console.log(`  shot: ${name}`);
}

async function run() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ args: ['--no-sandbox'] });

  for (const [label, viewport] of [
    ['desktop', { width: 1440, height: 900 }],
    ['laptop', { width: 1280, height: 768 }],     // the height the band must not crowd
    ['mobile', { width: 390, height: 844 }],
  ]) {
    for (const theme of ['light', 'dark']) {
      const context = await browser.newContext({
        viewport, colorScheme: theme, deviceScaleFactor: 2,
      });
      const page = await context.newPage();
      await mockApi(page);
      await seedTheme(page, theme);
      await seedOwned(page, 30);
      await page.goto(`${BASE}/?collection=${SLUG}&bobitSeed=${SEED}`);

      // The deep link pre-selects a collection but deliberately does not auto-start -- the
      // player still presses Play. So the sweep presses it.
      const play = page.getByRole('button', { name: /play now|continue playing/i });
      await play.waitFor({ timeout: 10000 });
      await play.click();

      // Let the question preview elapse and the crowd settle into a walk.
      await page.waitForTimeout(4000);

      // Whole page first: this is the shot that proves the band covers no question or answer.
      await page.screenshot({ path: `${OUT}/${label}-${theme}-page.png`, fullPage: false });
      console.log(`  shot: ${label}-${theme}-page`);

      await context.close();
    }
  }

  await browser.close();
  console.log(`\nWrote shots to ${OUT}/. Now LOOK at them.`);
}

run().catch(err => { console.error(err); process.exitCode = 1; });
