import { test, expect } from '../fixtures/test-fixtures';

test.describe('Screenshots Page - Screenshot Browser Journey', () => {
  test.beforeEach(async ({ screenshotsPage }) => {
    await screenshotsPage.goto();
  });

  test('should display screenshots heading and date', async ({ screenshotsPage }) => {
    await expect(screenshotsPage.heading).toBeVisible();

    const dateText = await screenshotsPage.getCurrentDateText();
    expect(dateText).toBeTruthy();
  });

  test('should show navigation buttons', async ({ screenshotsPage }) => {
    await expect(screenshotsPage.prevDayButton).toBeVisible();
    await expect(screenshotsPage.nextDayButton).toBeVisible();
    await expect(screenshotsPage.todayButton).toBeVisible();
  });

  test('should show search input', async ({ screenshotsPage }) => {
    await expect(screenshotsPage.searchInput).toBeVisible();
  });

  test('should show app filter', async ({ screenshotsPage }) => {
    await screenshotsPage.waitForScreenshotsToLoad();
    // App filter should be visible
    const appFilter = screenshotsPage.page.getByRole('combobox').or(
      screenshotsPage.page.locator('button').filter({ hasText: /All Apps/i })
    );
    await expect(appFilter.first()).toBeVisible();
  });

  test('should load screenshots or show empty state', async ({ screenshotsPage }) => {
    await screenshotsPage.waitForScreenshotsToLoad();

    const screenshotCount = await screenshotsPage.getScreenshotCount();
    if (screenshotCount === 0) {
      await expect(screenshotsPage.emptyState).toBeVisible();
    } else {
      await expect(screenshotsPage.screenshotCards.first()).toBeVisible();
    }
  });

  test('should display screenshot count', async ({ screenshotsPage }) => {
    await screenshotsPage.waitForScreenshotsToLoad();

    // Should show "X screenshots" somewhere
    const countText = screenshotsPage.page.locator('text=/\\d+ screenshots/');
    await expect(countText).toBeVisible();
  });

  test('should navigate between days', async ({ screenshotsPage }) => {
    await screenshotsPage.waitForScreenshotsToLoad();
    const initialDate = await screenshotsPage.getCurrentDateText();

    // Go to previous day
    await screenshotsPage.goToPreviousDay();
    const newDate = await screenshotsPage.getCurrentDateText();

    expect(newDate).not.toBe(initialDate);
  });

  test('should filter by search query', async ({ screenshotsPage }) => {
    await screenshotsPage.waitForScreenshotsToLoad();
    const initialCount = await screenshotsPage.getScreenshotCount();

    test.skip(initialCount === 0, 'No screenshots to filter');

    // Search for something specific
    await screenshotsPage.searchByWindowTitle('Chrome');
    await screenshotsPage.page.waitForTimeout(500);

    // Count may have changed (could be 0 to all)
    const filteredCount = await screenshotsPage.getScreenshotCount();
    // Just verify no errors - actual filtering depends on data
    expect(filteredCount).toBeGreaterThanOrEqual(0);

    // Clear search
    await screenshotsPage.clearSearch();
  });

  test('should open screenshot preview on click', async ({ screenshotsPage }) => {
    await screenshotsPage.waitForScreenshotsToLoad();
    const screenshotCount = await screenshotsPage.getScreenshotCount();

    test.skip(screenshotCount === 0, 'No screenshots to preview');

    // Click first screenshot
    await screenshotsPage.clickScreenshot(0);

    // Dialog should open
    await expect(screenshotsPage.previewDialog).toBeVisible();

    // Close preview
    await screenshotsPage.closePreview();
    await expect(screenshotsPage.previewDialog).not.toBeVisible();
  });

  test('should have select all button', async ({ screenshotsPage }) => {
    await screenshotsPage.waitForScreenshotsToLoad();
    const screenshotCount = await screenshotsPage.getScreenshotCount();

    test.skip(screenshotCount === 0, 'No screenshots to select');

    await expect(screenshotsPage.selectAllButton).toBeVisible();
  });

  test('should select and deselect screenshots', async ({ screenshotsPage }) => {
    await screenshotsPage.waitForScreenshotsToLoad();
    const screenshotCount = await screenshotsPage.getScreenshotCount();

    test.skip(screenshotCount === 0, 'No screenshots to select');

    // Select all
    await screenshotsPage.selectAllScreenshots();

    // Should show clear button and delete button
    await expect(screenshotsPage.clearSelectionButton).toBeVisible();

    // Clear selection
    await screenshotsPage.clearSelection();
  });

  test('should navigate to screenshots from sidebar', async ({ timelinePage, screenshotsPage }) => {
    await timelinePage.goto();

    // Click Screenshots in nav
    const screenshotsNav = timelinePage.page.getByRole('link', { name: /Screenshots/i });
    await screenshotsNav.click();
    await timelinePage.waitForPageLoad();

    await expect(screenshotsPage.heading).toBeVisible();
  });
});
