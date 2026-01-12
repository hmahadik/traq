import { test, expect } from '../fixtures/test-fixtures';

test.describe('Settings Drawer', () => {
  test.beforeEach(async ({ timelinePage, settingsDrawer }) => {
    await timelinePage.goto();
    await timelinePage.openSettings();
    await settingsDrawer.expectVisible();
  });

  test('should open and close settings drawer', async ({ settingsDrawer }) => {
    await settingsDrawer.expectVisible();

    await settingsDrawer.close();
    await settingsDrawer.expectNotVisible();
  });

  test('should display capture settings tab by default', async ({ settingsDrawer }) => {
    const isActive = await settingsDrawer.isTabActive('capture');
    expect(isActive).toBeTruthy();

    // Capture settings should be visible
    await expect(settingsDrawer.enableCaptureSwitch).toBeVisible();
    await expect(settingsDrawer.captureIntervalSlider).toBeVisible();
  });

  test('should display capture interval slider with value', async ({ settingsDrawer }) => {
    // Verify slider is visible and shows a value
    await expect(settingsDrawer.captureIntervalSlider).toBeVisible();

    const value = await settingsDrawer.getCaptureIntervalValue();
    // Value should match the format "XXs" (e.g., "30s")
    expect(value).toMatch(/\d+s/);
  });

  test('should switch to Sources tab and display data source toggles', async ({ settingsDrawer }) => {
    await settingsDrawer.selectTab('sources');

    const isSourcesActive = await settingsDrawer.isTabActive('sources');
    expect(isSourcesActive).toBeTruthy();

    // All data source switches should be visible
    await expect(settingsDrawer.shellHistorySwitch).toBeVisible();
    await expect(settingsDrawer.gitActivitySwitch).toBeVisible();
    await expect(settingsDrawer.fileChangesSwitch).toBeVisible();
    await expect(settingsDrawer.browserHistorySwitch).toBeVisible();
  });

  test('should navigate through all tabs', async ({ settingsDrawer }) => {
    const tabs = ['capture', 'ai', 'sources', 'system'] as const;

    for (const tab of tabs) {
      await settingsDrawer.selectTab(tab);
      const isActive = await settingsDrawer.isTabActive(tab);
      expect(isActive).toBeTruthy();
    }
  });

  test('sources tab content should stay within container bounds', async ({ page, settingsDrawer }) => {
    // Navigate to sources tab
    await settingsDrawer.selectTab('sources');

    // Wait for tab to be active
    const isActive = await settingsDrawer.isTabActive('sources');
    expect(isActive).toBeTruthy();

    // Get the dialog content container
    const dialogContent = page.locator('[role="dialog"]');
    await expect(dialogContent).toBeVisible();

    // Get the sources tab content
    const sourcesContent = dialogContent.locator('[role="tabpanel"][data-state="active"]');
    await expect(sourcesContent).toBeVisible();

    // Get bounding boxes
    const dialogBox = await dialogContent.boundingBox();
    const sourcesBox = await sourcesContent.boundingBox();

    expect(dialogBox).not.toBeNull();
    expect(sourcesBox).not.toBeNull();

    if (dialogBox && sourcesBox) {
      // Verify content doesn't overflow vertically beyond the dialog
      expect(sourcesBox.y + sourcesBox.height).toBeLessThanOrEqual(
        dialogBox.y + dialogBox.height + 1 // +1 for rounding
      );

      // Verify content doesn't overflow horizontally beyond the dialog
      expect(sourcesBox.x + sourcesBox.width).toBeLessThanOrEqual(
        dialogBox.x + dialogBox.width + 1 // +1 for rounding
      );

      // Verify content is scrollable if needed (has overflow)
      const isScrollable = await sourcesContent.evaluate((el) => {
        return el.scrollHeight > el.clientHeight;
      });

      // If content is scrollable, verify it can be scrolled
      if (isScrollable) {
        const initialScrollTop = await sourcesContent.evaluate((el) => el.scrollTop);

        // Scroll down
        await sourcesContent.evaluate((el) => {
          el.scrollTop = el.scrollHeight;
        });

        const finalScrollTop = await sourcesContent.evaluate((el) => el.scrollTop);

        // Verify scrolling occurred
        expect(finalScrollTop).toBeGreaterThan(initialScrollTop);
      }
    }
  });
});
