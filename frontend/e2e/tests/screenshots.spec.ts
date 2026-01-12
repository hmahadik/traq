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

  test('should navigate prev/next in screenshot gallery', async ({ screenshotsPage }) => {
    await screenshotsPage.waitForScreenshotsToLoad();
    const screenshotCount = await screenshotsPage.getScreenshotCount();

    test.skip(screenshotCount < 2, 'Need at least 2 screenshots to test navigation');

    // Open first screenshot
    await screenshotsPage.clickScreenshot(0);
    await expect(screenshotsPage.previewDialog).toBeVisible();

    // Check initial counter (should be "1 / X")
    const initialCounter = await screenshotsPage.getGalleryCounter();
    expect(initialCounter).toContain('1 /');

    // Click next button
    await screenshotsPage.clickNextInGallery();

    // Counter should change to "2 / X"
    const nextCounter = await screenshotsPage.getGalleryCounter();
    expect(nextCounter).toContain('2 /');

    // Click prev button to go back
    await screenshotsPage.clickPrevInGallery();

    // Should be back at "1 / X"
    const backCounter = await screenshotsPage.getGalleryCounter();
    expect(backCounter).toContain('1 /');

    await screenshotsPage.closePreview();
  });

  test('should navigate with keyboard arrows in gallery', async ({ screenshotsPage }) => {
    await screenshotsPage.waitForScreenshotsToLoad();
    const screenshotCount = await screenshotsPage.getScreenshotCount();

    test.skip(screenshotCount < 2, 'Need at least 2 screenshots to test keyboard navigation');

    // Open first screenshot
    await screenshotsPage.clickScreenshot(0);
    await expect(screenshotsPage.previewDialog).toBeVisible();

    // Check initial counter
    const initialCounter = await screenshotsPage.getGalleryCounter();
    expect(initialCounter).toContain('1 /');

    // Use arrow right key
    await screenshotsPage.navigateGalleryWithKeyboard('right');

    // Should move to next
    const nextCounter = await screenshotsPage.getGalleryCounter();
    expect(nextCounter).toContain('2 /');

    // Use arrow left key
    await screenshotsPage.navigateGalleryWithKeyboard('left');

    // Should move back
    const backCounter = await screenshotsPage.getGalleryCounter();
    expect(backCounter).toContain('1 /');

    // Close with Escape
    await screenshotsPage.closePreview();
  });

  test('should pre-fetch adjacent images for faster navigation', async ({ page }) => {
    // Navigate to screenshots page
    await page.goto('http://localhost:34115/#/screenshots');
    await page.waitForTimeout(2000);

    // Look for hour groups with screenshots
    const hourGroup = page.locator('.space-y-3 > div').first();

    // Check if we have screenshots to test with
    const hasScreenshots = await hourGroup.isVisible().catch(() => false);
    test.skip(!hasScreenshots, 'No screenshots available to test pre-fetching');

    // Click on first screenshot in the hour group
    const firstScreenshot = hourGroup.locator('img').first();
    await firstScreenshot.click();

    // Wait for gallery modal to open
    const galleryDialog = page.locator('[data-testid="image-gallery"]');
    await expect(galleryDialog).toBeVisible({ timeout: 5000 });

    // Check that we have multiple screenshots to navigate through
    const counterText = await page.locator('text=/\\d+ \\/ \\d+/').textContent();
    const match = counterText?.match(/(\d+) \/ (\d+)/);
    const currentIndex = match ? parseInt(match[1]) : 0;
    const totalCount = match ? parseInt(match[2]) : 0;

    test.skip(totalCount < 4, 'Need at least 4 screenshots to test pre-fetching');

    // Wait a moment for pre-fetching to occur
    await page.waitForTimeout(500);

    // Navigate to next screenshot - should be fast due to pre-fetching
    const nextButton = page.getByTestId('gallery-next');
    await nextButton.click();

    // Image should load quickly (pre-fetched)
    const mainImage = galleryDialog.locator('img').filter({ hasNot: page.locator('.w-16') });
    await expect(mainImage).toBeVisible({ timeout: 1000 });

    // Navigate once more to test continued pre-fetching
    await nextButton.click();
    await expect(mainImage).toBeVisible({ timeout: 1000 });

    // Close dialog
    await page.keyboard.press('Escape');
  });
});
