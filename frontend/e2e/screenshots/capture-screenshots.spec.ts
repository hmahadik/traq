/**
 * Automated screenshot capture for documentation
 *
 * Captures screenshots of all main views in both light and dark modes.
 * Output goes to docs/public/screenshots/
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
// Add ?mock=true to enable mock data mode for realistic screenshots
const MOCK_PARAM = '?mock=true';

const screenshots = [
  { name: 'timeline', path: `/${MOCK_PARAM}#/`, waitFor: 'main' },
  { name: 'analytics', path: `/${MOCK_PARAM}#/analytics`, waitFor: 'main' },
  { name: 'reports', path: `/${MOCK_PARAM}#/reports`, waitFor: 'main' },
  { name: 'settings', path: `/${MOCK_PARAM}#/`, action: 'openSettings', waitFor: '[role="dialog"]' },
] as const;

// Additional detail screenshots
const detailScreenshots = [
  { name: 'session-details', path: `/${MOCK_PARAM}#/session/1`, waitFor: 'main' },
  { name: 'activity-heatmap', path: `/${MOCK_PARAM}#/analytics`, waitFor: 'main', scroll: '[data-testid="activity-heatmap"]' },
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

          if (shot.path !== '/') {
            await page.goto(shot.path);
          } else if (shot.action !== 'openSettings') {
            await basePage.goto('/');
          }

          // Handle special actions
          if (shot.action === 'openSettings') {
            await basePage.goto('/');
            await basePage.openSettings();
          }

          // Re-apply theme after navigation (navigation may reset it)
          await setTheme(page, theme);

          // Wait for content to load
          try {
            const selectors = shot.waitFor.split(', ');
            await Promise.race(
              selectors.map(s => page.waitForSelector(s, { timeout: 5000 }))
            );
          } catch {
            console.log(`  Warning: waitFor selector not found, continuing...`);
          }

          // Extra wait for animations/data loading
          await page.waitForTimeout(500);

          // Close settings drawer if open before next screenshot
          if (shot.action === 'openSettings') {
            await captureScreenshot(page, shot.name, theme);
            await settingsDrawer.close();
          } else {
            await captureScreenshot(page, shot.name, theme);
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
            await page.waitForSelector(shot.waitFor, { timeout: 5000 });
          } catch {
            console.log(`  Warning: waitFor selector not found, continuing...`);
          }

          // Scroll to element if specified
          if ('scroll' in shot && shot.scroll) {
            try {
              const element = await page.$(shot.scroll);
              if (element) {
                await element.scrollIntoViewIfNeeded();
                await page.waitForTimeout(300);
              }
            } catch {
              console.log(`  Warning: scroll target not found`);
            }
          }

          await page.waitForTimeout(500);
          await captureScreenshot(page, shot.name, theme);
        }
      });
    });
  }
});
