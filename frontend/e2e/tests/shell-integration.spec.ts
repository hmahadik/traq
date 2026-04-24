import { test, expect } from '../fixtures/test-fixtures';

// Skip the whole suite in CI where the Wails dev server (port 34115) isn't
// running. Without the guard this would hard-timeout every run.
test.beforeAll(async ({ request }) => {
  try {
    const res = await request.get('http://localhost:34115/', { timeout: 2000 });
    if (!res.ok() && res.status() !== 404) {
      test.skip(true, `Wails dev server at :34115 returned ${res.status()}`);
    }
  } catch (err) {
    test.skip(true, `Wails dev server not reachable at :34115 (${(err as Error).message})`);
  }
});

test.describe('Shell integration', () => {
  test('install flow flips pill from Not installed to Active', async ({ page }) => {
    await page.goto('http://localhost:34115/#/settings');
    await page.getByText('Data Sources').click();
    await page.getByText('Shell History').click();

    const strip = page.locator('text=Shell integration').locator('..').locator('..');
    await expect(strip.getByText('Not installed')).toBeVisible();

    await strip.getByRole('button', { name: 'Install plugin' }).click();
    await expect(strip.getByText('Active')).toBeVisible({ timeout: 10000 });
  });
});
