import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for documentation screenshot capture.
 *
 * Uses a larger viewport for crisp screenshots and outputs to docs/public/screenshots/
 */
export default defineConfig({
  testDir: './e2e/screenshots',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [['list']],

  use: {
    baseURL: 'http://localhost:34115',
    trace: 'off',
    screenshot: 'off', // We handle screenshots manually
    video: 'off',
    // Larger viewport for documentation screenshots
    viewport: { width: 1280, height: 800 },
  },

  projects: [
    {
      name: 'screenshots',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
        deviceScaleFactor: 2, // Retina quality
      },
    },
  ],

  // Use the same global setup as regular e2e tests
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',

  timeout: 60_000, // Longer timeout for screenshot capture
  expect: {
    timeout: 10_000,
  },
});
