/**
 * Automated screenshot capture for documentation
 *
 * Captures screenshots of all main views in both light and dark modes.
 * Output goes to docs/public/screenshots/
 *
 * IMPORTANT: This script captures REAL app data, not mock data.
 * The timeline defaults to "today" and other pages show actual data.
 * Ensure the app has been running and collecting data for compelling screenshots.
 *
 * Usage:
 *   npm run screenshots        # Capture all screenshots
 *   npm run screenshots:light  # Light mode only
 *   npm run screenshots:dark   # Dark mode only
 */

import { test } from '@playwright/test';
import { BasePage } from '../pages/base.page';
import { SettingsDrawer } from '../pages/settings-drawer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCREENSHOT_DIR = path.join(__dirname, '../../../docs/public/screenshots');

// Screenshot configurations
// Note: App uses hash-based routing, so paths need /#/ prefix
// Using real app data with today's date for compelling screenshots
const screenshots = [
  {
    name: 'timeline',
    path: '/#/timeline',
    waitFor: '.timeline-grid, [data-testid="daily-summary"], main',
    waitForTimeout: 3000,
  },
  {
    name: 'analytics',
    path: '/#/analytics',
    waitFor: '.recharts-wrapper, [data-testid="stats-grid"], main',
    waitForTimeout: 3000,
  },
  {
    name: 'reports',
    path: '/#/reports',
    action: 'generateReport',
    waitFor: '[data-testid="report-form"], main',
    waitForTimeout: 5000, // Extra time for report generation
  },
  {
    name: 'settings',
    path: '/#/timeline',
    action: 'openSettings',
    waitFor: '[role="dialog"]',
    waitForTimeout: 1000,
  },
] as const;

// Additional detail screenshots
const detailScreenshots = [
  {
    name: 'session-details',
    path: '/#/session/1',
    waitFor: 'main',
    waitForTimeout: 2000,
  },
] as const;

type Theme = 'light' | 'dark';

async function setTheme(page: any, theme: Theme) {
  await page.evaluate((t: Theme) => {
    document.documentElement.classList.toggle('dark', t === 'dark');
  }, theme);
  // Give CSS transitions time to complete
  await page.waitForTimeout(300);
}

async function captureScreenshot(
  page: any,
  name: string,
  theme: Theme,
  options: { fullPage?: boolean } = {}
) {
  const filename = theme === 'light' ? `${name}.png` : `${name}-dark.png`;
  const filepath = path.join(SCREENSHOT_DIR, filename);

  await page.screenshot({
    path: filepath,
    fullPage: options.fullPage ?? false,
    animations: 'disabled',
  });

  console.log(`  Captured: ${filename}`);
}

test.describe('Documentation Screenshots', () => {
  test.describe.configure({ mode: 'serial' });

  let basePage: BasePage;
  let settingsDrawer: SettingsDrawer;

  test.beforeEach(async ({ page }) => {
    basePage = new BasePage(page);
    settingsDrawer = new SettingsDrawer(page);
  });

  for (const theme of ['light', 'dark'] as Theme[]) {
    test.describe(`${theme} mode`, () => {
      test.beforeEach(async ({ page }) => {
        // Navigate to home first to ensure app is loaded
        await basePage.goto('/');
        await setTheme(page, theme);
      });

      test(`capture main views (${theme})`, async ({ page }) => {
        for (const shot of screenshots) {
          console.log(`\nCapturing ${shot.name} (${theme})...`);

          // Navigate to the page
          await page.goto(shot.path);

          // Handle special actions
          if (shot.action === 'openSettings') {
            await basePage.openSettings();
          } else if (shot.action === 'generateReport') {
            // Click the "Generate Report" button
            const generateButton = page.getByRole('button', { name: /Generate Report/i });
            await generateButton.waitFor({ state: 'visible', timeout: 5000 });
            await generateButton.click();

            // Wait for the report to be generated (button text changes from "Generating..." back to "Generate Report")
            await page.waitForFunction(() => {
              const buttons = Array.from(document.querySelectorAll('button'));
              const generatingBtn = buttons.find(btn => btn.textContent?.includes('Generating...'));
              return !generatingBtn;
            }, { timeout: 15000 });

            // Extra wait for report content to render
            await page.waitForTimeout(1000);
          }

          // Re-apply theme after navigation (navigation may reset it)
          await setTheme(page, theme);

          // Wait for content to load
          try {
            const selectors = shot.waitFor.split(', ');
            await Promise.race(
              selectors.map(s => page.waitForSelector(s, { timeout: 8000 }))
            );
          } catch {
            console.log(`  Warning: waitFor selector not found, continuing...`);
          }

          // Extra wait for animations/data loading (use config timeout or default)
          const timeout = 'waitForTimeout' in shot ? shot.waitForTimeout : 1500;
          await page.waitForTimeout(timeout);

          // Capture screenshot
          await captureScreenshot(page, shot.name, theme);

          // Close settings drawer if open before next screenshot
          if (shot.action === 'openSettings') {
            await settingsDrawer.close();
          }
        }
      });

      test(`capture detail views (${theme})`, async ({ page }) => {
        for (const shot of detailScreenshots) {
          console.log(`\nCapturing ${shot.name} (${theme})...`);

          await page.goto(shot.path);

          // Re-apply theme after navigation (navigation may reset it)
          await setTheme(page, theme);

          try {
            const selectors = shot.waitFor.split(', ');
            await Promise.race(
              selectors.map(s => page.waitForSelector(s, { timeout: 8000 }))
            );
          } catch {
            console.log(`  Warning: waitFor selector not found, continuing...`);
          }

          // Scroll to element if specified
          if ('scroll' in shot && shot.scroll) {
            const scrollSelectors = shot.scroll.split(', ');
            for (const selector of scrollSelectors) {
              try {
                const element = await page.$(selector);
                if (element) {
                  await element.scrollIntoViewIfNeeded();
                  await page.waitForTimeout(300);
                  break;
                }
              } catch {
                // Try next selector
              }
            }
          }

          // Extra wait for animations/data loading (use config timeout or default)
          const timeout = 'waitForTimeout' in shot ? shot.waitForTimeout : 1500;
          await page.waitForTimeout(timeout);

          await captureScreenshot(page, shot.name, theme);
        }
      });
    });
  }
});
