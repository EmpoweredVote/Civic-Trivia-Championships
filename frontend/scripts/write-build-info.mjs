/**
 * Emits dist/build-info.json so the deployed site can say which commit it is.
 *
 * A static site has no runtime to ask, and the bundle hash does not identify a
 * commit — Render builds with dashboard-only env vars, so its hash differs from
 * CI's for identical source (observed: CI built index-CVOqwpXo.js while prod
 * served index-Dhz6HpDW.js). The post-deploy smoke workflow polls this file to
 * confirm the deploy it was triggered by is actually live, instead of testing
 * whatever happened to be served at the time.
 *
 * RENDER_GIT_COMMIT is set automatically by Render at build time for static
 * sites as well as web services. GITHUB_SHA covers a CI build; neither exists
 * locally, hence "dev".
 */
import { writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'dist', 'build-info.json');

const info = {
  commit: process.env.RENDER_GIT_COMMIT || process.env.GITHUB_SHA || 'dev',
  branch: process.env.RENDER_GIT_BRANCH || process.env.GITHUB_REF_NAME || null,
  builtAt: new Date().toISOString(),
};

// vite build has already created dist/, so no mkdir is needed — if it is missing
// something went wrong upstream and failing loudly is correct.
await writeFile(OUT, JSON.stringify(info, null, 2) + '\n', 'utf8');
console.log(`  build-info: commit=${info.commit} branch=${info.branch ?? '—'}`);
