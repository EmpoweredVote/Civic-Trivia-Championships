/**
 * Measures what the living floor costs per frame, to set WANDER_CAST.
 *
 * Measures WORK, not the interval between frames. The Stage 2 harness timed frame-to-frame
 * delta and reported 16.7ms for every configuration, because that number is the display's
 * refresh rate and says nothing about how much work the frame did. Everything here is timed
 * around the actual calls.
 *
 * Runs in the browser, not node, so the JIT and the canvas are the real ones. The modules are
 * imported straight from the vite dev server, so this is the same code the app runs.
 *
 * Usage:  npm run dev      (in another shell)
 *         node scripts/bobit-bench.mjs
 */
import { chromium } from 'playwright';

const BASE = process.env.BENCH_URL || 'http://localhost:5173';
const CASTS = [0, 8, 16, 24, 32, 48, 100];
const RESIDENTS = 100;          // a full room, per CROWD_CAP
const FRAMES = 600;
const WARMUP = 120;
const THROTTLE = Number(process.env.BENCH_THROTTLE || 4);   // mid-tier phone approximation

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

// Vite serves the app at /, and its module graph from the same origin. Loading the page first
// means the dev server is warm and the imports below resolve against it.
await page.goto(BASE);

const session = await page.context().newCDPSession(page);
await session.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });

const results = await page.evaluate(async ({ casts, residents, frames, warmup }) => {
  const agentsMod = await import('/src/features/collection/crowdAgents.ts');
  const figuresMod = await import('/src/features/collection/crowdFigures.ts');
  const layoutMod = await import('/src/features/collection/crowdLayout.ts');
  const reducerMod = await import('/src/features/collection/crowdReducer.ts');
  const rigMod = await import('/src/components/bobbits/leremyRig.ts');
  const extrasMod = await import('/src/components/bobbits/rigExtras.ts');
  const geoMod = await import('/src/components/bobbits/fieldGeometry.ts');

  const { initAgents, agentsAdvance, syncCast, rotateCast, makeRand } = agentsMod;
  const { crowdFigures } = figuresMod;
  const { bandFor } = layoutMod;
  const { crowdInit, crowdApply, crowdStep } = reducerMod;
  const { CFG, computePose, draw, drawBatched, canBatch, drawShadow } = rigMod;
  const { ALL_ANIMATIONS } = extrasMod;
  const { sortByDepth, pelvisOffset } = geoMod;

  const band = bandFor(false);
  const ids = Array.from({ length: residents }, (_, i) => `q${String(i).padStart(3, '0')}`);

  // A real canvas at the band's real size, so the paint measured is the paint shipped.
  const canvas = document.createElement('canvas');
  canvas.width = 1440 * 1.5;
  canvas.height = band.height * 1.5;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  ctx.scale(1.5, 1.5);

  /** BobitField's paint loop, reproduced call for call. */
  const paint = (figs, t) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const f of sortByDepth(figs)) {
      const anim = ALL_ANIMATIONS[f.anim];
      if (!anim) continue;
      const pose = anim.frame(t + (f.phase || 0), f.vars);
      if (f.shadow !== false) drawShadow(ctx, f.x, f.groundY, 16 * f.scale);
      const opts = { color: f.color, time: t, ...f.props };
      ctx.save();
      ctx.translate(f.x, f.groundY - pelvisOffset(f.anim) * f.scale);
      ctx.scale(f.flip ? -f.scale : f.scale, f.scale);
      const joints = computePose(pose, CFG, { x: 0, y: 0 });
      if (canBatch(opts)) drawBatched(ctx, joints, CFG, f.color);
      else draw(ctx, joints, CFG, opts);
      ctx.restore();
    }
  };

  const out = [];

  for (const cast of casts) {
    const rand = makeRand('bench');
    let crowd = crowdApply(crowdInit(), { type: 'seed', ids });
    let agents = initAgents(ids, {
      band, width: 1440, greeting: new Set(), frozen: false, rand,
    });
    let rotate = 0;
    const dt = 1 / 60;

    const step = (t, celebrate) => {
      if (celebrate && Math.abs(t % 3) < dt) {
        crowd = crowdApply(crowd, { type: 'correct', id: ids[(t * 7 | 0) % ids.length], streak: 3 });
      }
      crowd = crowdStep(crowd, dt);
      const opts = { band, width: 1440, greeting: new Set(), frozen: false, rand };
      const t0 = performance.now();
      agents = syncCast(agents, crowd.residents, opts, cast);
      rotate += dt;
      const rotated = rotateCast(agents, rotate, opts);
      if (rotated !== agents) { agents = rotated; rotate = 0; }
      agents = agentsAdvance(agents, dt, opts);
      const figs = crowdFigures(crowd, agents, band, false);
      const tSim = performance.now() - t0;

      const t1 = performance.now();
      paint(figs, t);
      const tPaint = performance.now() - t1;

      return [tSim, tPaint];
    };

    for (const celebrate of [false, true]) {
      let t = 0;
      for (let i = 0; i < warmup; i++) { step(t, celebrate); t += dt; }
      let sim = 0, pnt = 0;
      for (let i = 0; i < frames; i++) {
        const [a, b] = step(t, celebrate);
        sim += a; pnt += b; t += dt;
      }
      out.push({
        cast, celebrate,
        sim: sim / frames,
        paint: pnt / frames,
        total: (sim + pnt) / frames,
      });
    }
  }

  return out;
}, { casts: CASTS, residents: RESIDENTS, frames: FRAMES, warmup: WARMUP });

await browser.close();

// ── report ────────────────────────────────────────────────────────────────────
const idle = results.filter(r => !r.celebrate);
const party = results.filter(r => r.celebrate);

console.log(`\n  ${RESIDENTS} residents, CPU throttled ${THROTTLE}x, ${FRAMES} frames each.`);
console.log('  Budget is 16.7ms/frame for 60fps.\n');
console.log('  cast |      idle sim  paint  total |  celebrating sim  paint  total');
console.log('  -----+------------------------------+---------------------------------');
for (let i = 0; i < idle.length; i++) {
  const a = idle[i], b = party[i];
  const f = n => n.toFixed(2).padStart(6);
  console.log(
    `  ${String(a.cast).padStart(4)} |          ${f(a.sim)} ${f(a.paint)} ${f(a.total)} |`
    + `            ${f(b.sim)} ${f(b.paint)} ${f(b.total)}`,
  );
}

// ── sanity check: a harness that reports the same number everywhere measures nothing ──
//
// Checks SIM, not total. Total is dominated by paint, and paint does not depend on the cast
// at all -- the room is always CROWD_CAP figures, whether they are walking or standing. The
// first version of this check compared totals, saw them flat, and cried vsync at a harness
// that was working correctly. The quantity the cast is supposed to move is the simulation.
const lo = idle[0].sim, hi = idle[idle.length - 1].sim;
console.log('');
if (!(hi > lo * 1.2)) {
  console.log(`  HARNESS SUSPECT: simulation costs the same at cast ${idle[0].cast} and cast`);
  console.log(`  ${idle[idle.length - 1].cast} (${lo.toFixed(2)} vs ${hi.toFixed(2)} ms).`);
  console.log('  That is what timing vsync, or an empty code path, looks like. Do not read');
  console.log('  the numbers above until this differs.');
  process.exitCode = 1;
} else {
  console.log(`  Sanity: simulation costs ${lo.toFixed(2)}ms at cast ${idle[0].cast} and`
    + ` ${hi.toFixed(2)}ms at cast ${idle[idle.length - 1].cast}`);
  console.log('  -- the harness responds to load.');
  const worst = Math.max(...results.map(r => r.total));
  console.log(`\n  Worst frame measured: ${worst.toFixed(2)}ms against a 16.7ms budget.`);
}
