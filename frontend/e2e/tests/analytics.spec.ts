import { test, expect } from '../fixtures/test-fixtures';

test.describe('Analytics Page - Productivity Analysis Journey', () => {
  test.beforeEach(async ({ analyticsPage }) => {
    await analyticsPage.goto();
  });

  test('should display analytics heading and date', async ({ analyticsPage }) => {
    await expect(analyticsPage.heading).toBeVisible();

    const dateText = await analyticsPage.getCurrentDateText();
    expect(dateText).toBeTruthy();
  });

  test('should show day view by default', async ({ analyticsPage }) => {
    const isDayActive = await analyticsPage.isViewActive('day');
    expect(isDayActive).toBeTruthy();
  });

  test('should switch between view modes', async ({ analyticsPage }) => {
    // Switch to Week view
    await analyticsPage.switchToView('week');
    const isWeekActive = await analyticsPage.isViewActive('week');
    expect(isWeekActive).toBeTruthy();

    // Switch to Month view
    await analyticsPage.switchToView('month');
    const isMonthActive = await analyticsPage.isViewActive('month');
    expect(isMonthActive).toBeTruthy();

    // Switch back to Day view
    await analyticsPage.switchToView('day');
    const isDayActive = await analyticsPage.isViewActive('day');
    expect(isDayActive).toBeTruthy();
  });

  test('should display stats grid in day view', async ({ analyticsPage }) => {
    await analyticsPage.waitForDataToLoad();
    await expect(analyticsPage.statsGrid).toBeVisible();
  });

  test('should display productivity score card', async ({ analyticsPage }) => {
    await analyticsPage.waitForDataToLoad();
    // The productivity score card should be visible
    const scoreCard = analyticsPage.page.locator('text=Productivity Score');
    await expect(scoreCard).toBeVisible();
  });

  test('should switch between content tabs', async ({ analyticsPage }) => {
    await analyticsPage.waitForDataToLoad();

    // Activity tab is default
    await expect(analyticsPage.activityTab).toBeVisible();

    // Switch to Applications tab
    await analyticsPage.switchToContentTab('apps');
    // Should show app-related content
    const appUsageContent = analyticsPage.page.locator('text=App Usage');
    await expect(appUsageContent).toBeVisible();

    // Switch to Data Sources tab
    await analyticsPage.switchToContentTab('sources');
    // Should show data sources content
    const dataSourcesContent = analyticsPage.page.locator('text=Shell Commands').or(
      analyticsPage.page.locator('text=Git Activity')
    ).or(analyticsPage.page.locator('text=No data source activity'));
    await expect(dataSourcesContent.first()).toBeVisible();
  });

  test('should have export button with dropdown', async ({ analyticsPage }) => {
    await expect(analyticsPage.exportButton).toBeVisible();

    // Click to open dropdown
    await analyticsPage.exportButton.click();

    // Should show export options
    const csvOption = analyticsPage.page.getByRole('menuitem', { name: /CSV/i });
    const htmlOption = analyticsPage.page.getByRole('menuitem', { name: /HTML/i });
    const jsonOption = analyticsPage.page.getByRole('menuitem', { name: /JSON/i });

    await expect(csvOption).toBeVisible();
    await expect(htmlOption).toBeVisible();
    await expect(jsonOption).toBeVisible();

    // Close dropdown by pressing Escape
    await analyticsPage.page.keyboard.press('Escape');
  });

  test('should have regenerate button', async ({ analyticsPage }) => {
    await expect(analyticsPage.regenerateButton).toBeVisible();
  });

  test('should navigate to analytics from sidebar', async ({ timelinePage, analyticsPage }) => {
    await timelinePage.goto();
    await timelinePage.navigateTo('analytics');

    await expect(analyticsPage.heading).toBeVisible();
  });

  test('should have date navigation buttons', async ({ analyticsPage }) => {
    await expect(analyticsPage.prevButton).toBeVisible();
    await expect(analyticsPage.nextButton).toBeVisible();
  });

  test('should navigate to previous day in day view', async ({ analyticsPage }) => {
    await analyticsPage.waitForDataToLoad();

    // Get current date
    const beforeDate = await analyticsPage.getCurrentDateText();

    // Click previous
    await analyticsPage.clickPrevious();

    // Date should change
    const afterDate = await analyticsPage.getCurrentDateText();
    expect(afterDate).not.toBe(beforeDate);
  });

  test('should navigate to next day in day view when not at today', async ({ analyticsPage }) => {
    await analyticsPage.waitForDataToLoad();

    // Go to previous day first
    await analyticsPage.clickPrevious();

    // Get current date
    const beforeDate = await analyticsPage.getCurrentDateText();

    // Next button should be enabled
    const isDisabled = await analyticsPage.isNextButtonDisabled();
    expect(isDisabled).toBe(false);

    // Click next
    await analyticsPage.clickNext();

    // Date should change
    const afterDate = await analyticsPage.getCurrentDateText();
    expect(afterDate).not.toBe(beforeDate);
  });

  test('should disable next button when at current period', async ({ analyticsPage }) => {
    await analyticsPage.waitForDataToLoad();

    // At today in day view, next should be disabled
    const isDisabled = await analyticsPage.isNextButtonDisabled();
    expect(isDisabled).toBe(true);
  });

  test('should navigate weeks in week view', async ({ analyticsPage }) => {
    await analyticsPage.switchToView('week');

    // Get current date
    const beforeDate = await analyticsPage.getCurrentDateText();

    // Click previous week
    await analyticsPage.clickPrevious();

    // Date should change
    const afterDate = await analyticsPage.getCurrentDateText();
    expect(afterDate).not.toBe(beforeDate);

    // Click next week
    await analyticsPage.clickNext();

    // Should return to original or close to it
    const returnDate = await analyticsPage.getCurrentDateText();
    expect(returnDate).not.toBe(afterDate);
  });

  test('should navigate months in month view', async ({ analyticsPage }) => {
    await analyticsPage.switchToView('month');

    // Get current date
    const beforeDate = await analyticsPage.getCurrentDateText();

    // Click previous month
    await analyticsPage.clickPrevious();

    // Date should change
    const afterDate = await analyticsPage.getCurrentDateText();
    expect(afterDate).not.toBe(beforeDate);

    // Click next month
    await analyticsPage.clickNext();

    // Should return to original or close to it
    const returnDate = await analyticsPage.getCurrentDateText();
    expect(returnDate).not.toBe(afterDate);
  });

  test('should navigate years in year view', async ({ analyticsPage }) => {
    await analyticsPage.switchToView('year');

    // Get current date (should show year)
    const beforeDate = await analyticsPage.getCurrentDateText();

    // Click previous year
    await analyticsPage.clickPrevious();

    // Date should change
    const afterDate = await analyticsPage.getCurrentDateText();
    expect(afterDate).not.toBe(beforeDate);

    // Click next year
    await analyticsPage.clickNext();

    // Should return to original year
    const returnDate = await analyticsPage.getCurrentDateText();
    expect(returnDate).not.toBe(afterDate);
  });
});
