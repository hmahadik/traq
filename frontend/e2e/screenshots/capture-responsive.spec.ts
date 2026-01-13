/**
 * Responsive screenshot capture for layout verification
 *
 * Captures screenshots of main views at various screen sizes to verify
 * responsive layout behavior.
 *
 * IMPORTANT: This script uses MOCK DATA for clean, professional screenshots.
 * Mock data is defined in frontend/src/api/mockData.ts.
 * Update mock data when adding new features to keep screenshots current.
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

// Pages to capture (using mock data for clean screenshots)
// Note: App uses hash-based routing, so paths need /#/ prefix
const MOCK_PARAM = '?mock=true';
const PAGES = [
  { name: 'timeline', path: `/${MOCK_PARAM}#/timeline`, waitFor: '.timeline-grid, [data-testid="daily-summary"], main' },
  { name: 'analytics', path: `/${MOCK_PARAM}#/analytics`, waitFor: '.recharts-wrapper, [data-testid="stats-grid"], main' },
  { name: 'reports', path: `/${MOCK_PARAM}#/reports`, waitFor: '[data-testid="report-form"], main' },
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

      // Wait for content to load - try multiple selectors
      try {
        const selectors = pageConfig.waitFor.split(', ');
        await Promise.race(
          selectors.map(s => page.waitForSelector(s, { timeout: 10000 }))
        );
      } catch {
        console.log(`  Warning: waitFor selector "${pageConfig.waitFor}" not found, continuing...`);
      }

      // Special handling for reports page - generate a report
      if (pageConfig.name === 'reports') {
        try {
          // Click the "Generate Report" button
          const generateButton = page.getByRole('button', { name: /Generate Report/i });
          await generateButton.waitFor({ state: 'visible', timeout: 5000 });
          await generateButton.click();

          // Wait for the report to be generated
          await page.waitForFunction(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const generatingBtn = buttons.find(btn => btn.textContent?.includes('Generating...'));
            return !generatingBtn;
          }, { timeout: 15000 });

          // Wait for report content to fully render - look for bullet points or list content
          try {
            await page.waitForFunction(() => {
              // Check if there's actual list content (ul/ol with li elements) in the report
              const lists = document.querySelectorAll('ul li, ol li');
              return lists.length > 0;
            }, { timeout: 10000 });
          } catch {
            console.log(`  Warning: Report content may not be fully loaded`);
          }

          // Extra buffer for any final rendering
          await page.waitForTimeout(1000);
        } catch (error) {
          console.log(`  Warning: Could not generate report, continuing with form view...`);
        }
      }

      // Extra wait for data/animations
      await page.waitForTimeout(2000);

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
