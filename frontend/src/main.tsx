import React from 'react';
import { createRoot } from 'react-dom/client';
import * as Sentry from '@sentry/react';
import './index.css';
import App from './App';

// Initialize Sentry for crash reporting.
// Drop the default BrowserApiErrors + Breadcrumbs integrations: they monkey-patch
// setTimeout / requestAnimationFrame / addEventListener / DOM to wrap every callback,
// which cost ~6% self-time during timeline drags (the `sentryWrapped` hot path). We keep
// GlobalHandlers (window.onerror / unhandledrejection) plus explicit captureException in
// ErrorBoundary/GlobalErrorHandler, so crashes are still reported without the per-event tax.
Sentry.init({
  dsn: 'https://5bad525b80919fbf0be0f8617d24d259@o4510716123348992.ingest.us.sentry.io/4510716130623488',
  integrations: (defaults) =>
    defaults.filter((i) => i.name !== 'BrowserApiErrors' && i.name !== 'Breadcrumbs'),
  // Only capture errors, no performance tracing
  tracesSampleRate: 0,
});

const container = document.getElementById('root');

const root = createRoot(container!);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
