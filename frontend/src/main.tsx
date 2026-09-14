import React from 'react';
import ReactDOM from 'react-dom/client';
import { PostHogProvider } from 'posthog-js/react';
import { init, getClient } from '@empoweredvote/analytics';
import { AppErrorBoundary } from '@empoweredvote/analytics/react';
import App from './App';
import './index.css';

// Dev-only, opt-in via ?mock=1: serves a fake game API so the app can be driven without a
// backend. Tree-shaken out of any build -- import.meta.env.DEV is statically false there.
if (import.meta.env.DEV) {
  const { installMockGameApi } = await import('./dev/mockGameApi');
  installMockGameApi();
}

// Shared analytics: app + environment auto-stamped, key env-gated (unset locally
// = no-op), exception capture + noise filter built in. See @empoweredvote/analytics.
// NOTE: the deployed env MUST set VITE_POSTHOG_KEY, else analytics is a no-op.
init({
  app: 'ctc',
  key: import.meta.env.VITE_POSTHOG_KEY,
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PostHogProvider client={getClient()}>
      <AppErrorBoundary>
        <App />
      </AppErrorBoundary>
    </PostHogProvider>
  </React.StrictMode>
);
