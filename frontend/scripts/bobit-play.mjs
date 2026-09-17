/**
 * Opens the game in a real browser window with the API mocked, so the living floor can be
 * played with by hand.
 *
 * This repo's backend is frozen and production serves CTC under different paths, so there is
 * no running API to point a local frontend at. Everything the game asks for is answered here
 * instead -- including scoring, so the crowd's reactions actually fire.
 *
 * Usage:  npm run dev            (in another shell)
 *         node scripts/bobit-play.mjs               # 30 bobits already earned
 *         node scripts/bobit-play.mjs --owned 0     # an empty room, earn them live
 *         node scripts/bobit-play.mjs --owned 95    # near the 100 cap
 *         node scripts/bobit-play.mjs --dark
 *
 * Answer A to get it right, anything else to get it wrong -- so both the celebration chain
 * and the two kinds of miss are one click away. Close the window to end.
 */
import { chromium } from 'playwright';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
};
const has = name => process.argv.includes(`--${name}`);

const BASE = process.env.PLAY_URL || 'http://localhost:5173';
const OWNED = Number(arg('owned', 30));
const THEME = has('dark') ? 'dark' : 'light';
const MOBILE = has('mobile');

const SLUG = 'milwaukee-wi';
const COLLECTION = {
  id: 1, name: 'Milwaukee WI', slug: SLUG, description: 'Cream City civics',
  themeColor: '#1E3A8A', questionCount: 120, tier: 'city',
  localeName: 'Wisconsin', localeCode: 'WI',
};

// Q1 and Q2 are questions you ALREADY OWN, so getting one wrong costs you that bobit and
// plays the abduction. Q3-Q5 are new, so getting one right is an arrival and getting one
// wrong is the costless ripple. That puts all four reactions inside a single match.
const QUESTIONS = [
  { id: 'milwi-001', owned: true },
  { id: 'milwi-002', owned: true },
  { id: 'milwi-201', owned: false },
  { id: 'milwi-202', owned: false },
  { id: 'milwi-203', owned: false },
].map((q, i) => ({
  id: q.id,
  questionText: q.owned
    ? `Q${i + 1} — you ALREADY OWN this bobit. Answer A to keep him, B to watch him taken.`
    : `Q${i + 1} — this one is NEW. Answer A to earn a bobit, B for a miss that costs nothing.`,
  options: ['A — correct', 'B — wrong', 'C — wrong', 'D — wrong'],
  difficulty: i === 4 ? 'hard' : 'easy',
  topic: 'Local government',
  category: 'city',
}));

const browser = await chromium.launch({ headless: false, args: ['--no-sandbox'] });
const context = await browser.newContext({
  viewport: MOBILE ? { width: 390, height: 844 } : { width: 1440, height: 940 },
});
const page = await context.newPage();

// ORDER MATTERS: Playwright checks handlers in REVERSE registration order, so the catch-all
// goes FIRST or it swallows everything below it.
await page.route('**/api/**', route => route.fulfill({ status: 204, body: '' }));

await page.route('**/api/game/collections', route =>
  route.fulfill({ json: { collections: [COLLECTION] } }));

await page.route('**/api/game/session', route =>
  route.fulfill({
    json: {
      sessionId: 'play-session', questions: QUESTIONS, degraded: false,
      collectionName: COLLECTION.name, collectionSlug: SLUG,
      gameMode: 'easy-steps', totalQuestions: 5,
    },
  }));

// Option 0 ("A — correct") is right; everything else is wrong. That is what puts the
// celebration chain and both miss reactions one click apart.
await page.route('**/api/game/answer', async route => {
  const body = JSON.parse(route.request().postData() || '{}');
  const correct = body.selectedOption === 0;
  const base = correct ? 100 : 0;
  const speed = correct ? Math.round((body.timeRemaining ?? 0) * 2.5) : 0;
  await route.fulfill({
    json: {
      basePoints: base,
      speedBonus: speed,
      totalPoints: base + speed,
      correct,
      correctAnswer: 0,
      ...(body.wager !== undefined ? { wager: body.wager } : {}),
    },
  });
});

await page.addInitScript(t => localStorage.setItem('ctc-theme', t), THEME);
await page.addInitScript(([slug, n]) => {
  // bobitProgress keeps ONE key holding { [slug]: { [questionId]: true } }.
  const owned = {};
  for (let i = 1; i <= n; i++) owned[`milwi-${String(i).padStart(3, '0')}`] = true;
  localStorage.setItem('ctc.bobits.v1', JSON.stringify(n > 0 ? { [slug]: owned } : {}));
}, [SLUG, OWNED]);

await page.goto(`${BASE}/?collection=${SLUG}`);

const play = page.getByRole('button', { name: /play now|continue playing/i });
await play.waitFor({ timeout: 15000 });
await play.click();

console.log(`
  Playing ${COLLECTION.name} with ${OWNED} bobits already earned (${THEME}${MOBILE ? ', mobile' : ''}).

    - Answer A to get it RIGHT   -> cheer, then clap, then high-fives
                                    (on Q3-Q5 that also earns a NEW bobit)
    - Answer B to get it WRONG:
        Q1 / Q2 are bobits you own -> he is lifted, bursts, and the room freezes
        Q3-Q5 are new              -> a shrug/confused ripple spreads, nobody is lost
    - Hover or click any bobit    -> he stops walking and waves at you
    - Watch the back row          -> bobits amble between the ranks and the stage on foot

  Close the browser window when you are done.
`);

// Hold until the window is closed.
await new Promise(resolve => {
  page.on('close', resolve);
  browser.on('disconnected', resolve);
});
await browser.close().catch(() => {});
