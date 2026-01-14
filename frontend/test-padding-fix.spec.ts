import { test } from '@playwright/test';

test('visual check - timeline grid padding', async ({ page }) => {
  await page.goto('http://localhost:34115/#/');
  await page.waitForTimeout(2000);
  
  // Take full page screenshot
  await page.screenshot({ path: 'timeline-padding-check.png', fullPage: true });
  
  console.log('Screenshot saved to timeline-padding-check.png');
});
