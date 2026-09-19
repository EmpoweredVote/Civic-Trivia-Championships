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


/**
 * A pose sheet: the new poses rendered large, whole-figure, so a person can see what they
 * actually do. This is the check that catches a T-pose. `highfive` is drawn as a PAIR, facing
 * each other at the distance the celebration actually pairs them at, because a high-five that
 * looks fine alone can still miss its partner's hand.
 */
async function poseSheet(browser) {
  const context = await browser.newContext({
    viewport: { width: 1240, height: 1560 }, deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  await mockApi(page);
  await page.goto(BASE);

  for (const theme of ['light', 'dark']) {
    const buf = await page.evaluate(async (dark) => {
      const rig = await import('/src/components/bobbits/leremyRig.ts');
      const extras = await import('/src/components/bobbits/rigExtras.ts');
      const { CFG, computePose, draw, drawShadow } = rig;
      const { ALL_ANIMATIONS, figColor } = extras;

      const W = 1240, H = 1560, S = 1.1;
      const canvas = document.createElement('canvas');
      canvas.width = W * 2; canvas.height = H * 2;
      const c = canvas.getContext('2d');
      c.scale(2, 2);
      c.fillStyle = dark ? '#0B1220' : '#F1F5F9';
      c.fillRect(0, 0, W, H);
      c.font = '13px system-ui, sans-serif';

      const one = (key, x, y, t, vars, label) => {
        const anim = ALL_ANIMATIONS[key];
        const pose = anim.frame(t, vars);
        const color = figColor(vars && vars.hand === 'L' ? 1 : 0, dark);
        drawShadow(c, x, y, 16 * S);
        c.save();
        c.translate(x, y - 112 * S);
        c.scale(S, S);
        draw(c, computePose(pose, CFG, { x: 0, y: 0 }), CFG, { color });
        c.restore();
        if (label) {
          c.fillStyle = dark ? '#94A3B8' : '#475569';
          c.textAlign = 'center';
          c.fillText(label, x, y + 22);
        }
      };

      // Row 1: clap through one full cycle -- the hands must visibly meet and part.
      [0, 0.07, 0.15, 0.22, 0.29].forEach((t, i) =>
        one('clap', 120 + i * 150, 330, t, undefined, `clap t=${t}`));

      // Row 2: high-five PAIRS at the real pairing distance (HIGHFIVE_REACH is 160 units).
      [0, 0.1, 0.2].forEach((t, i) => {
        const cx = 220 + i * 340;
        one('highfive', cx - 55, 1070, t, { hand: 'R' }, null);
        one('highfive', cx + 55, 1070, t, { hand: 'L' }, `highfive pair t=${t}`);
      });

      // Row 3 (right): the celebration ladder's other rungs, for comparison.
      ['cheer', 'jump', 'dance'].forEach((k, i) =>
        one(k, 900 + i * 110, 330, 0.3, undefined, k));

      // Row 3b: the BOW across one full cycle -- the recap's cast pose.
      // What to look for: he folds at the WAIST rather than tipping like a plank, his hands
      // hang rather than sticking out (armRF is not an elbow bend), his head is the lowest
      // part of him at the bottom, and he is fully upright again by the end of the cycle.
      // BOW_CYCLE is 2.6s; these six samples walk the fold, the hold, the rise and the stand.
      [0, 0.3, 0.6, 0.9, 1.3, 2.0].forEach((t, i) =>
        one('bow', 120 + i * 150, 700, t, undefined, `bow t=${t}`));

      // Row 4: the entrance poses, on their own line with real spacing.
      // splayed is deliberately a T-pose -- nothing in the tests can tell the intentional one
      // from a mistake, which is exactly why it has to be looked at.
      one('splayed', 130, 1470, 0.2, undefined, 'splayed (T-POSE ON PURPOSE)');

      // flail across half a second: the arms must be out of phase at EVERY instant, or it
      // reads as a jumping jack rather than panic.
      [0, 0.09, 0.18, 0.27, 0.36, 0.45].forEach((t, i) =>
        one('flail', 380 + i * 140, 1470, t, undefined, `t=${t}`));

      c.fillStyle = dark ? '#E2E8F0' : '#0F172A';
      c.textAlign = 'left';
      c.font = '600 15px system-ui, sans-serif';
      c.fillText('clap cycle', 40, 40);
      c.fillText('celebration ladder', 880, 40);
      c.fillText('bow cycle (waist not plank? hands hanging? head lowest?)', 40, 400);
      c.fillText('high-five pairs (do the hands meet?)', 40, 770);
      c.fillText('entrance poses', 40, 1140);

      return canvas.toDataURL('image/png').split(',')[1];
    }, theme === 'dark');

    const { writeFile } = await import('node:fs/promises');
    await writeFile(`${OUT}/poses-${theme}.png`, Buffer.from(buf, 'base64'));
    console.log(`  shot: poses-${theme}`);
  }

  await context.close();
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

  await poseSheet(browser);

  await browser.close();
  console.log(`\nWrote shots to ${OUT}/. Now LOOK at them.`);
}

run().catch(err => { console.error(err); process.exitCode = 1; });
