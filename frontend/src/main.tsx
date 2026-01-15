import React from 'react';
import { createRoot } from 'react-dom/client';
import * as Sentry from '@sentry/react';
import './index.css';
import App from './App';

// Initialize Sentry for crash reporting
Sentry.init({
  dsn: 'https://5bad525b80919fbf0be0f8617d24d259@o4510716123348992.ingest.us.sentry.io/4510716130623488',
  integrations: [],
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
