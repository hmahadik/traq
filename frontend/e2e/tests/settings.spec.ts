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
});
