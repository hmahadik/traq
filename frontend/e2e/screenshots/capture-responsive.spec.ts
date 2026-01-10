/**
 * Responsive screenshot capture for layout verification
 *
 * Captures screenshots of main views at various screen sizes to verify
 * responsive layout behavior.
 *
 * Usage:
 *   npx playwright test --config=playwright.screenshots.config.ts capture-responsive
 */

import { test, Page } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCREENSHOT_DIR = path.join(__dirname, '../../../screenshots/responsive');

// Viewport configurations representing common device sizes
const VIEWPORTS = [
  { name: 'mobile-portrait', width: 375, height: 667 },   // iPhone SE
  { name: 'mobile-landscape', width: 667, height: 375 }, // iPhone SE landscape
  { name: 'tablet-portrait', width: 768, height: 1024 }, // iPad portrait
  { name: 'tablet-landscape', width: 1024, height: 768 }, // iPad landscape
  { name: 'desktop-small', width: 1280, height: 800 },   // Small laptop
  { name: 'desktop-large', width: 1920, height: 1080 },  // Full HD
] as const;

// Pages to capture (using mock data for realistic content)
const MOCK_PARAM = '?mock=true';
const PAGES = [
  { name: 'timeline', path: `/${MOCK_PARAM}#/`, waitFor: '[data-testid="session-card"]' },
  { name: 'analytics', path: `/${MOCK_PARAM}#/analytics`, waitFor: '.recharts-wrapper' },
  { name: 'reports', path: `/${MOCK_PARAM}#/reports`, waitFor: 'main' },
] as const;

// Ensure screenshot directory exists
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

async function captureAtViewport(
  page: Page,
  pageName: string,
  viewportName: string,
  width: number,
  height: number
) {
  await page.setViewportSize({ width, height });
  // Wait for any responsive layout adjustments
  await page.waitForTimeout(500);

  const filename = `${pageName}-${viewportName}.png`;
  const filepath = path.join(SCREENSHOT_DIR, filename);

  await page.screenshot({
    path: filepath,
    fullPage: false,
    animations: 'disabled',
  });

  console.log(`  Captured: ${filename} (${width}x${height})`);
}

test.describe('Responsive Layout Screenshots', () => {
  test.describe.configure({ mode: 'serial' });

  test('capture all pages at all viewport sizes', async ({ page }) => {
    console.log(`\nCapturing responsive screenshots to: ${SCREENSHOT_DIR}\n`);

    for (const pageConfig of PAGES) {
      console.log(`\n--- ${pageConfig.name.toUpperCase()} ---`);

      // Navigate to the page
      await page.goto(pageConfig.path);

      // Wait for content to load
      try {
        await page.waitForSelector(pageConfig.waitFor, { timeout: 10000 });
      } catch {
        console.log(`  Warning: waitFor selector "${pageConfig.waitFor}" not found, continuing...`);
      }

      // Extra wait for data/animations
      await page.waitForTimeout(1500);

      // Capture at each viewport size
      for (const viewport of VIEWPORTS) {
        await captureAtViewport(
          page,
          pageConfig.name,
          viewport.name,
          viewport.width,
          viewport.height
        );
      }
    }

    console.log(`\n\nAll screenshots saved to: ${SCREENSHOT_DIR}`);
  });
});
