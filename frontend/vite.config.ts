import { defineConfig, loadEnv, type PluginOption, type ProxyOptions } from 'vite';
import react from '@vitejs/plugin-react';

// Local dev reads the LIVE public API by default, so a fresh clone with no .env
// can browse collections, play a guest game and see the leaderboard. In dev the
// app calls same-origin `/ctc/...` (trivia) and `/api/...` (accounts), and this
// proxy forwards both to ev-accounts, where the trivia routes live under /ctc.
// The live API's CORS allow-list excludes localhost, so the proxy strips Origin.
// Signed out, it reaches only what any visitor reaches. Running ev-accounts
// locally? Set VITE_API_PROXY_TARGET=http://localhost:3000. Dev only.
const LIVE_API = 'https://accounts-api.empowered.vote';

// PostHog source-map upload. Inert unless POSTHOG_API_KEY and POSTHOG_PROJECT_ID
// are set at build time (CI / Render build env). See ERROR_TRACKING.md.
const posthogSourcemapsEnabled = Boolean(
  process.env.POSTHOG_API_KEY && process.env.POSTHOG_PROJECT_ID,
);

export default defineConfig(async ({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const apiTarget = env.VITE_API_PROXY_TARGET || LIVE_API;
  const liveProxy: ProxyOptions = {
    target: apiTarget,
    changeOrigin: true,
    secure: true,
    configure: (proxy) => {
      proxy.on('proxyReq', (proxyReq) => proxyReq.removeHeader('origin'));
    },
  };
  const plugins: PluginOption[] = [react()];
  if (posthogSourcemapsEnabled) {
    const { default: posthogSourcemaps } = await import('@posthog/rollup-plugin');
    plugins.push(
      posthogSourcemaps({
        personalApiKey: process.env.POSTHOG_API_KEY!,
        projectId: process.env.POSTHOG_PROJECT_ID,
        host: process.env.POSTHOG_HOST || 'https://us.i.posthog.com',
        sourcemaps: { enabled: true, releaseName: 'civic-trivia' },
      }) as PluginOption,
    );
  }

  return {
    plugins,
    server: {
      port: 5173,
      proxy: {
        '/ctc': liveProxy,
        '/api': liveProxy,
      },
    },
    // 'hidden' emits maps for upload without a sourceMappingURL comment in the
    // shipped bundles; the plugin deletes them after upload by default.
    build: { sourcemap: posthogSourcemapsEnabled ? ('hidden' as const) : false },
  };
});
