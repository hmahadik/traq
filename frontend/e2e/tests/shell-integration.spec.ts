import { test, expect } from '../fixtures/test-fixtures';

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
