/**
 * A prop sheet, for the same reason there is a pose sheet.
 *
 * The cannon shipped reading as a grey tube, and stayed that way through a review, because
 * nothing ever showed it larger than the 38px it occupies on the band. At that size every prop
 * is a smudge and all a smudge tells you is that something is there.
 *
 * Two rows, both needed and for different questions:
 *   - AT SCALE 0.2, beside a real bobit: is it legible, and is it the right size?
 *   - ENLARGED: is the silhouette actually the thing it is meant to be?
 *
 * Both themes, because the field passes a LIGHT body colour in dark mode and a DARK one in
 * light mode. A detail colour that contrasts in one can vanish entirely in the other -- which
 * is exactly what the old hardcoded '#AAB2BF' accent did against the dark-mode body.
 *
 * Usage:  npm run dev      (in another shell)
 *         node scripts/bobit-props.mjs
 *
 * Writes frontend/.shots/prop-cannon-{light,dark}.png.
 */
import { chromium } from 'playwright';
import { writeFile, mkdir } from 'node:fs/promises';

const BASE = process.env.SHOTS_URL || 'http://localhost:5173';
const OUT = '.shots';

/** The two body colours CollectionCrowd actually passes. */
const BODY = { light: '#4A5568', dark: '#9AA6B8' };

/** Angles worth seeing: the scene's own, plus level as a control. */
const ANGLES = [-32, -20, 0];

async function sheet(page, theme) {
  return page.evaluate(async ([isDark, body, angles]) => {
    const props = await import('/src/components/bobbits/props.ts');
    const rig = await import('/src/components/bobbits/leremyRig.ts');
    const extras = await import('/src/components/bobbits/rigExtras.ts');
    const geom = await import('/src/components/bobbits/fieldGeometry.ts');
    const { CFG, computePose, draw, drawShadow } = rig;
    const { ALL_ANIMATIONS, figColor } = extras;
    // NOT a hardcoded 112. A seated figure's pelvis is 8 units above its contact line and a
    // standing one's is 112 -- the same 104-unit trap fieldGeometry documents for hoverAnim.
    // Drawing `sit` with the standing offset floats the bobit a whole body above his branch.
    const { pelvisOffset } = geom;

    const W = 1500, H = 700;
    const canvas = document.createElement('canvas');
    canvas.width = W * 2; canvas.height = H * 2;
    const c = canvas.getContext('2d');
    c.scale(2, 2);
    c.fillStyle = isDark ? '#0B1220' : '#F1F5F9';
    c.fillRect(0, 0, W, H);

    c.fillStyle = isDark ? '#E2E8F0' : '#0F172A';
    c.font = '600 16px system-ui, sans-serif';
    c.fillText(`drawCannon — ${isDark ? 'dark' : 'light'} mode`, 20, 28);

    const label = isDark ? '#94A3B8' : '#475569';
    c.fillStyle = label;
    c.font = '13px system-ui, sans-serif';
    c.fillText('the size the player sees (scale 0.2), with a bobit alongside', 20, 54);

    angles.forEach((ang, i) => {
      const bx = 90 + i * 160, by = 120;
      props.drawCannon(c, bx, by, 0.2, ang, false, body);
      // A standing bobit at the same scale: the joke only works if the cannon is bigger
      // than the person it fires.
      const pose = ALL_ANIMATIONS.standstill.frame(0.2);
      drawShadow(c, bx + 62, by, 16 * 0.2);
      c.save();
      c.translate(bx + 62, by - pelvisOffset('standstill') * 0.2);
      c.scale(0.2, 0.2);
      draw(c, computePose(pose, CFG, { x: 0, y: 0 }), CFG, { color: figColor(0, isDark) });
      c.restore();
      c.fillStyle = label;
      c.font = '12px ui-monospace, monospace';
      c.fillText(`${ang}deg`, bx - 10, by + 18);
    });

    c.fillStyle = label;
    c.font = '13px system-ui, sans-serif';
    c.fillText('enlarged 4x — the silhouette on its own', 20, 200);

    angles.forEach((ang, i) => {
      const bx = 150 + i * 390, by = 520;
      props.drawCannon(c, bx, by, 0.8, ang, false, body);
      c.strokeStyle = isDark ? '#1E293B' : '#CBD5E1';
      c.beginPath();
      c.moveTo(bx - 140, by + 0.5);
      c.lineTo(bx + 330, by + 0.5);
      c.stroke();
      c.fillStyle = label;
      c.font = '12px ui-monospace, monospace';
      c.fillText(`${ang}deg`, bx - 20, by + 22);
    });

    // ── the tree ──────────────────────────────────────────────────────────────────────────
    c.fillStyle = label;
    c.font = '13px system-ui, sans-serif';
    c.fillText('the tree — at band scale beside a standing bobit, and enlarged', 660, 218);

    // At the size the player sees it, with a standing bobit AND one seated on the branch. The
    // seated figure is the whole question: the band is 96px and he has to fit inside it.
    {
      const bx = 800, by = 120;
      props.drawTree(c, bx, by, 0.2, 1, body);
      const stand = ALL_ANIMATIONS.standstill.frame(0.2);
      drawShadow(c, bx - 64, by, 16 * 0.2);
      c.save();
      c.translate(bx - 64, by - pelvisOffset('standstill') * 0.2);
      c.scale(0.2, 0.2);
      draw(c, computePose(stand, CFG, { x: 0, y: 0 }), CFG, { color: figColor(0, isDark) });
      c.restore();
      const [branch] = props.treeSurfaces(bx, by, 0.2);
      const seated = ALL_ANIMATIONS.sit.frame(0.3);
      c.save();
      c.translate((branch.left + branch.right) / 2, branch.y - pelvisOffset('sit') * 0.2);
      c.scale(0.2, 0.2);
      draw(c, computePose(seated, CFG, { x: 0, y: 0 }), CFG, { color: figColor(1, isDark) });
      c.restore();
      c.fillStyle = label;
      c.font = '12px ui-monospace, monospace';
      c.fillText('scale 0.2', bx - 90, by + 18);
    }

    // Enlarged, with the band's real top edge drawn in. The ground line sits GROUND_INSET (6px)
    // above the band's bottom, so the top is 90px above it at scale 0.2 and 90 * (s / 0.2) away
    // here. If the seated bobit crosses this line, the tree is too tall for the real band.
    {
      const bx = 1080, by = 620, s = 0.8;
      props.drawTree(c, bx, by, s, 1, body);
      const [branch] = props.treeSurfaces(bx, by, s);
      const seated = ALL_ANIMATIONS.sit.frame(0.3);
      c.save();
      c.translate((branch.left + branch.right) / 2, branch.y - pelvisOffset('sit') * s);
      c.scale(s, s);
      draw(c, computePose(seated, CFG, { x: 0, y: 0 }), CFG, { color: figColor(1, isDark) });
      c.restore();

      const bandTopY = by - (96 - 6) * (s / 0.2);
      c.strokeStyle = '#DC2626';
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(bx - 240, bandTopY);
      c.lineTo(bx + 140, bandTopY);
      c.stroke();
      c.fillStyle = '#DC2626';
      c.font = '12px ui-monospace, monospace';
      c.fillText('band top — nothing may cross this', bx - 240, bandTopY - 6);
    }

    return canvas.toDataURL('image/png').split(',')[1];
  }, [theme === 'dark', BODY[theme], ANGLES]);
}

async function run() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const context = await browser.newContext({
    viewport: { width: 1500, height: 700 }, deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  // Any page of the real app will do -- this only needs Vite to serve the modules.
  await page.goto(`${BASE}/?mock=1&collection=milwaukee-wi&owned=2`);
  await page.waitForTimeout(1500);

  for (const theme of ['light', 'dark']) {
    const png = await sheet(page, theme);
    await writeFile(`${OUT}/prop-cannon-${theme}.png`, Buffer.from(png, 'base64'));
    console.log(`  sheet: prop-cannon-${theme}`);
  }

  await context.close();
  await browser.close();
  console.log(`\nWrote sheets to ${OUT}/. Now LOOK at them.`);
}

run().catch(err => { console.error(err); process.exitCode = 1; });
