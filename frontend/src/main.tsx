import React from 'react';
import ReactDOM from 'react-dom/client';
import { PostHogProvider } from 'posthog-js/react';
import { init, getClient } from '@empoweredvote/analytics';
import { AppErrorBoundary } from '@empoweredvote/analytics/react';
import App from './App';
import './index.css';

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
