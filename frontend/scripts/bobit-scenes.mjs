/**
 * Contact sheets for the entrance scenes.
 *
 * `bobit-shots.mjs` sweeps pages and poses; neither shows a SCENE, which is why the swirl and
 * the four pool entrances shipped without anybody looking at them. A set piece fires once per
 * collection for the lifetime of a player's progress, so the only way to see one is the dev
 * replay hook.
 *
 * Drives the real app through the in-app mock (`?mock=1`) and calls `window.__bobitScene(id)`
 * directly rather than leaning on the 14s `&scene=` loop, so frames land at known offsets into
 * the scene instead of wherever the loop happened to be.
 *
 * Usage:  npm run dev      (in another shell)
 *         node scripts/bobit-scenes.mjs [sceneId ...]
 *
 * Writes one PNG per scene per theme to frontend/.shots/scene-*.png.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const BASE = process.env.SHOTS_URL || 'http://localhost:5173';
const OUT = '.shots';
const SEED = 'bobit-scenes';
const SLUG = 'milwaukee-wi';

/** Durations from the scene files. Frames are sampled across each one, plus a little after. */
const SCENES = {
  swirl: 4.2,
  cannon: 10.6,
  'pool-stumble': 2.6,
  'pool-trip': 3.0,
  'pool-peek': 2.8,
  'pool-drop': 2.6,
};

const FRAMES = 8;
/**
 * A populated room. An entrance has to read AGAINST the crowd it is joining -- whether the
 * newcomer is findable, and whether the flat overlap reads badly now that depth is gone, are
 * both questions an empty band cannot answer.
 */
const OWNED = 30;

/**
 * The cannon is NOT in the default run. Its flight uses the overlay, which is gated on
 * `aerialAllowed` (reveal phase only) -- replaying it mid-question captures a shot with the
 * air layer suppressed, which looks like a bug and is not one. Ask for it by name if wanted.
 */
const DEFAULT = Object.keys(SCENES).filter(id => id !== 'cannon');

const wanted = process.argv.slice(2).filter(a => SCENES[a]);
const list = wanted.length ? wanted : DEFAULT;

/**
 * Sample one scene as a strip of frames.
 *
 * Frames come off the live band canvas with toDataURL rather than element.screenshot(): a
 * screenshot round-trips through the browser's compositor and costs ~150ms, which is a third of
 * a beat at these durations and enough to smear the sampling.
 */
async function captureScene(page, id, duration) {
  const triggered = await page.evaluate(sceneId => {
    const w = window;
    if (!w.__bobitScene) return false;
    w.__bobitScene(sceneId);
    w.__sceneT0 = performance.now();
    return true;
  }, id);
  if (!triggered) throw new Error('__bobitScene missing — is the dev server in DEV mode?');

  // Sample from just after the start to a beat past the end, so the hand-back to the wander
  // reducer is visible too: a figure that never rejoins the crowd is a leak you can see.
  const last = duration + 0.5;
  const frames = [];
  let prev = 0;
  for (let i = 0; i < FRAMES; i++) {
    const t = ((i + 0.5) / FRAMES) * last;
    await page.waitForTimeout(Math.max(0, (t - prev) * 1000));
    prev = t;
    // Label with the elapsed time the PAGE saw, not the time this loop intended. Each
    // toDataURL round-trip costs ~100ms that the naive schedule never accounts for, and across
    // eight frames that drift silently reaches half a second -- enough to label a `spent` frame
    // as `splayed` and send somebody hunting a timing bug that is entirely in the harness.
    const shot = await page.evaluate(() => {
      const cs = Array.from(document.querySelectorAll('canvas'));
      const band = cs[cs.length - 1];
      return band
        ? { data: band.toDataURL('image/png'), at: (performance.now() - window.__sceneT0) / 1000 }
        : null;
    });
    if (shot) frames.push({ t: shot.at, data: shot.data });
  }
  return frames;
}

/** Stack the frames into one labelled sheet, composed in-page so no image library is needed. */
async function sheet(page, id, frames, dark) {
  return page.evaluate(async ([sceneId, shots, isDark]) => {
    const imgs = await Promise.all(shots.map(s => new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = rej;
      im.src = s.data;
    })));

    const GUT = 26;            // room for the timestamp under each frame
    const W = imgs[0].width;
    const H = imgs[0].height;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = (H + GUT) * imgs.length + 40;
    const c = canvas.getContext('2d');

    c.fillStyle = isDark ? '#020617' : '#FFFFFF';
    c.fillRect(0, 0, canvas.width, canvas.height);

    c.fillStyle = isDark ? '#E2E8F0' : '#0F172A';
    c.font = '600 22px system-ui, sans-serif';
    c.fillText(sceneId, 16, 28);

    imgs.forEach((im, i) => {
      const y = 40 + i * (H + GUT);
      c.drawImage(im, 0, y);
      // A hairline under each frame: without it the stacked bands blur into one tall image and
      // it stops being obvious where one instant ends and the next begins.
      c.strokeStyle = isDark ? '#1E293B' : '#CBD5E1';
      c.beginPath();
      c.moveTo(0, y + H + 0.5);
      c.lineTo(W, y + H + 0.5);
      c.stroke();
      c.fillStyle = isDark ? '#94A3B8' : '#475569';
      c.font = '16px ui-monospace, monospace';
      c.fillText(`t = ${shots[i].t.toFixed(2)}s`, 16, y + H + 19);
    });

    return canvas.toDataURL('image/png').split(',')[1];
  }, [id, frames, dark]);
}

async function run() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ args: ['--no-sandbox'] });

  for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({
      viewport: { width: 1100, height: 820 }, deviceScaleFactor: 2,
    });
    const page = await context.newPage();
    page.on('console', m => {
      if (m.type() === 'error' || m.text().includes('[bobits]')) {
        console.log(`    console: ${m.text()}`);
      }
    });
    await page.addInitScript(t => localStorage.setItem('ctc-theme', t), theme);

    await page.goto(`${BASE}/?mock=1&collection=${SLUG}&owned=${OWNED}&bobitSeed=${SEED}`);

    const play = page.getByRole('button', { name: /play now|continue playing/i });
    await play.waitFor({ timeout: 15000 });
    await play.click();
    // Let the preview elapse and the crowd settle, so a scene starts against a calm room.
    await page.waitForTimeout(4500);

    for (const id of list) {
      const frames = await captureScene(page, id, SCENES[id]);
      const png = await sheet(page, id, frames, theme === 'dark');
      await writeFile(`${OUT}/scene-${id}-${theme}.png`, Buffer.from(png, 'base64'));
      console.log(`  sheet: scene-${id}-${theme} (${frames.length} frames)`);
      // Let the director fully release the cast before the next scene is staged, or the second
      // scene is skipped for want of an unreserved span.
      await page.waitForTimeout(1200);
    }

    await context.close();
  }

  await browser.close();
  console.log(`\nWrote sheets to ${OUT}/. Now LOOK at them.`);
}

run().catch(err => { console.error(err); process.exitCode = 1; });
