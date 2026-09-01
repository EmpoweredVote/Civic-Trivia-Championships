/**
 * Production-bundle smoke test.
 *
 * `tsc && vite build` proves the bundle compiles. It does not prove the app
 * mounts. On 2026-09-01 a Vite 8 bump shipped a bundle that built cleanly and
 * then threw React error #130 on mount (a CJS default-export interop change
 * turned `react-canvas-confetti`'s default into the module namespace object),
 * so every page rendered as the analytics AppErrorBoundary fallback. CI was
 * green throughout. This test is the gate that would have caught it.
 *
 * Loads the built app in headless Chromium and asserts it actually rendered.
 *
 * Usage: npm run smoke     (expects a server already serving on SMOKE_URL)
 *        SMOKE_URL=https://ctc.empowered.vote/ SMOKE_ALLOW_EXTERNAL=1 npm run smoke
 */
import { chromium } from 'playwright';

const TARGET = process.env.SMOKE_URL || 'http://localhost:10000/';
const TIMEOUT = Number(process.env.SMOKE_TIMEOUT || 20000);

// The app renders as much of itself as it can without a backend, so by default
// only the target's own origin is allowed and everything else is aborted. That
// keeps CI hermetic and stops it from calling production on every run, and it
// works for any SMOKE_URL rather than assuming localhost.
//
// SMOKE_ALLOW_EXTERNAL=1 lifts the block, for pointing this at a real deployment
// where you want the actual API exercised too.
const ORIGIN = new URL(TARGET).origin;
const ALLOW_EXTERNAL = process.env.SMOKE_ALLOW_EXTERNAL === '1';
const isAllowed = (url) => ALLOW_EXTERNAL || url.startsWith(ORIGIN);

const fail = (msg, extra) => {
  console.error(`\n  SMOKE FAILED: ${msg}`);
  if (extra) console.error(extra);
  process.exitCode = 1;
};

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();

await page.route('**/*', (route) =>
  isAllowed(route.request().url()) ? route.continue() : route.abort()
);

// Uncaught exceptions only. Console errors are not a failure signal here: with
// the backend blocked the app legitimately logs failed fetches.
const crashes = [];
page.on('pageerror', (e) => crashes.push(e.stack || e.message));

let ok = true;

try {
  await page.goto(TARGET, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
} catch (e) {
  fail(`could not load ${TARGET}`, e.message);
  await browser.close();
  process.exit(1);
}

// 1. The app shell mounted. This is the assertion that catches a render-time
//    throw: when the tree dies on mount the boundary replaces it and no
//    <header> ever appears.
try {
  await page.waitForSelector('header', { state: 'visible', timeout: TIMEOUT });
} catch {
  ok = false;
  fail('no <header> rendered — the app did not mount');
}

await page.waitForTimeout(1500); // let post-mount effects settle

// 2. Root has real content. The boundary fallback is tiny (~470 chars); a
//    mounted dashboard is tens of thousands.
const rootLen = await page.evaluate(() => document.getElementById('root')?.innerHTML.length ?? 0);
if (rootLen < 2000) {
  ok = false;
  fail(`#root has only ${rootLen} chars of HTML — expected a mounted app (>2000)`);
}

// 3. Belt and braces: the error-boundary fallback is not on screen. The copy
//    lives in @empoweredvote/analytics and could change, so this backs up the
//    checks above rather than standing alone.
const bodyText = await page.evaluate(() => document.body.innerText);
if (/something went wrong/i.test(bodyText)) {
  ok = false;
  fail('error-boundary fallback is showing', bodyText.slice(0, 300));
}

// 4. Nothing threw uncaught during mount.
if (crashes.length) {
  ok = false;
  fail(`${crashes.length} uncaught error(s) during mount`, crashes.slice(0, 3).join('\n---\n'));
}

await browser.close();

if (ok) {
  console.log(`  smoke OK — app mounted at ${TARGET} (#root: ${rootLen} chars)`);
} else {
  console.error(`\n  The bundle built but did not run. Load ${TARGET} in a browser to see it.`);
  process.exit(1);
}
