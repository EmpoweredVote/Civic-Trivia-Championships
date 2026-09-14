/**
 * A fake game API, for looking at the crowd in a normal browser tab.
 *
 * This repo's backend is frozen and production serves CTC under different paths, so there is
 * no API a local frontend can talk to. The screenshot and play harnesses mock it from
 * Playwright, but that means launching a SECOND browser alongside the one already open --
 * about half a gigabyte, which on a loaded machine gets the window killed before it is useful.
 *
 * So the same mocks live here instead, patched over `fetch`, and the app can be driven from
 * whatever browser is already running.
 *
 * DEV ONLY and OPT IN: it is imported behind `import.meta.env.DEV` and does nothing at all
 * unless the URL carries `?mock=1`, so it cannot reach a build or a normal dev session.
 *
 *   npm run dev
 *   http://localhost:5173/?mock=1&collection=milwaukee-wi
 *
 * Options:
 *   &owned=0..100   how many bobits are already earned  (default 30)
 *   &bobitSeed=xyz  fix the room's layout across reloads
 */

const SLUG = 'milwaukee-wi';

const COLLECTION = {
  id: 1, name: 'Milwaukee WI', slug: SLUG, description: 'Cream City civics',
  themeColor: '#1E3A8A', questionCount: 120, tier: 'city',
  localeName: 'Wisconsin', localeCode: 'WI',
};

// Q1 and Q2 are bobits you ALREADY OWN, so a miss there costs you one and plays the abduction.
// Q3-Q5 are new, so a hit is an arrival and a miss is the costless ripple. All four reactions
// inside one match.
const QUESTIONS = [
  { id: 'milwi-001', owned: true },
  { id: 'milwi-002', owned: true },
  { id: 'milwi-201', owned: false },
  { id: 'milwi-202', owned: false },
  { id: 'milwi-203', owned: false },
].map((q, i) => ({
  id: q.id,
  questionText: q.owned
    ? `Q${i + 1} — you ALREADY OWN this bobit. A keeps him, B has him taken.`
    : `Q${i + 1} — this one is NEW. A earns a bobit, B is a miss that costs nothing.`,
  options: ['A — correct', 'B — wrong', 'C — wrong', 'D — wrong'],
  difficulty: i === 4 ? 'hard' : 'easy',
  topic: 'Local government',
  category: 'city',
}));

const json = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });

/** Seed owned bobits into the same key bobitProgress uses, unless the player already has some. */
function seedOwned(count: number) {
  const KEY = 'ctc.bobits.v1';
  try {
    if (localStorage.getItem(KEY)) return;   // never clobber real progress
    const owned: Record<string, boolean> = {};
    for (let i = 1; i <= count; i++) owned[`milwi-${String(i).padStart(3, '0')}`] = true;
    localStorage.setItem(KEY, JSON.stringify(count > 0 ? { [SLUG]: owned } : {}));
  } catch {
    // Private mode or a full quota: the room just starts empty, which is still usable.
  }
}

export function installMockGameApi() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('mock') !== '1') return;

  seedOwned(Number(params.get('owned') ?? 30));

  const real = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input
      : input instanceof URL ? input.href
      : input.url;

    if (url.includes('/api/game/collections')) return json({ collections: [COLLECTION] });

    if (url.includes('/api/game/session')) {
      return json({
        sessionId: 'mock-session', questions: QUESTIONS, degraded: false,
        collectionName: COLLECTION.name, collectionSlug: SLUG,
        gameMode: 'easy-steps', totalQuestions: QUESTIONS.length,
      });
    }

    if (url.includes('/api/game/answer')) {
      const body = JSON.parse((init?.body as string) || '{}');
      const correct = body.selectedOption === 0;      // option A is always the right one
      const basePoints = correct ? 100 : 0;
      const speedBonus = correct ? Math.round((body.timeRemaining ?? 0) * 2.5) : 0;
      return json({
        basePoints, speedBonus, totalPoints: basePoints + speedBonus,
        correct, correctAnswer: 0,
        ...(body.wager !== undefined ? { wager: body.wager } : {}),
      });
    }

    // Anything else the app reaches for: answer emptily rather than let it hang on a dead
    // localhost:3000, which would stall the screens that await it.
    if (url.includes('/api/')) return new Response(null, { status: 204 });

    return real(input, init);
  };

  // eslint-disable-next-line no-console
  console.info(
    '%c[mock api]%c serving a fake Milwaukee WI. A = correct, B = wrong. '
    + 'Q1/Q2 are bobits you own (a miss takes one); Q3-Q5 are new.',
    'color:#007D99;font-weight:600', 'color:inherit',
  );
}
