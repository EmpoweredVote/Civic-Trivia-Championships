/**
 * Copies the non-TypeScript assets that `tsc` leaves behind into dist/.
 *
 * This used to be shell appended to the build script:
 *
 *   cp -r src/data dist/ && mkdir -p dist/db/seed && cp src/db/seed/sources.json dist/db/seed/
 *
 * npm runs scripts through cmd.exe on Windows, which has neither `cp` nor
 * `mkdir -p`, so `npm run build` failed locally with "The syntax of the command
 * is incorrect" — after tsc had already succeeded, which made it look like a
 * compile problem. CI and Render run Linux, so it only ever broke Windows.
 *
 * Node's own fs does the same job on every platform with no new dependency.
 *
 * Both destinations are read at runtime relative to __dirname from dist/db/seed
 * (see src/db/seed/questions.ts), so the layout below must be kept exact.
 */
import { cp, mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const ASSETS = [
  // read as join(__dirname, '../../data/questions.json') => dist/data/
  { from: 'src/data', to: 'dist/data', recursive: true },
  // read as join(__dirname, './sources.json') => dist/db/seed/
  { from: 'src/db/seed/sources.json', to: 'dist/db/seed/sources.json' },
];

for (const asset of ASSETS) {
  const from = join(ROOT, asset.from);
  const to = join(ROOT, asset.to);

  try {
    // cp does not create the destination's parent, and dist/db/seed only exists
    // if tsc emitted something there.
    await mkdir(dirname(to), { recursive: true });
    await cp(from, to, { recursive: Boolean(asset.recursive) });
    console.log(`  copied ${asset.from} -> ${asset.to}`);
  } catch (err) {
    console.error(`\n  Failed to copy ${asset.from} -> ${asset.to}`);
    console.error(`  ${err.message}`);
    process.exit(1);
  }
}
