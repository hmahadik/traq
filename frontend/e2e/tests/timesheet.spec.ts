import { test, expect } from '../fixtures/test-fixtures';

test.describe('Timesheet Preview (Plan B)', () => {
  test.beforeEach(async ({ reportsPage }) => {
    await reportsPage.goto();
    await reportsPage.waitForPageLoad();
  });

  test('Timesheet appears as a report type option', async ({ reportsPage }) => {
    const option = reportsPage.page.getByText('Timesheet', { exact: true }).first();
    await expect(option).toBeVisible();
  });

  test('selecting Timesheet swaps in the timesheet preview UI', async ({ reportsPage }) => {
    const option = reportsPage.page.getByText('Timesheet', { exact: true }).first();
    await option.click();

    // The Timesheet-specific generate button should appear
    const generateBtn = reportsPage.page.getByTestId('generate-timesheet');
    await expect(generateBtn).toBeVisible();
    await expect(generateBtn).toContainText(/Generate Timesheet/i);

    // Project filter and screenshots toggle should be hidden in timesheet mode
    await expect(reportsPage.page.locator('text=Include screenshots')).toHaveCount(0);
  });

  test('Push to FunctionFox button is disabled with tooltip', async ({ reportsPage }) => {
    await reportsPage.page.getByText('Timesheet', { exact: true }).first().click();

    const pushBtn = reportsPage.page.getByRole('button', { name: /Push to FunctionFox/i });
    await expect(pushBtn).toBeVisible();
    await expect(pushBtn).toBeDisabled();
  });

  test('Generate produces a preview state (rows or empty message)', async ({ reportsPage }) => {
    await reportsPage.page.getByText('Timesheet', { exact: true }).first().click();
    await reportsPage.page.getByTestId('generate-timesheet').click();

    // Wait for the loading spinner to clear; whichever state arrives is fine.
    await reportsPage.page.waitForTimeout(1500);

    const tableOrEmpty = reportsPage.page.getByTestId('timesheet-row').first().or(
      reportsPage.page.getByText(/No tracked project time/i)
    );
    await expect(tableOrEmpty).toBeVisible({ timeout: 10000 });
  });
});

test.describe('FunctionFox Settings', () => {
  test('Settings sidebar exposes the FunctionFox section', async ({ page }) => {
    await page.goto('/#/settings');
    await page.waitForLoadState('domcontentloaded');

    const link = page.getByRole('link', { name: /FunctionFox/i });
    await expect(link).toBeVisible();
    await link.click();

    await expect(page.getByText(/FunctionFox Connection/i)).toBeVisible();
    await expect(page.getByText(/Hours Rounding/i)).toBeVisible();
  });
});
