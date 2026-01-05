import { test, expect } from '../fixtures/test-fixtures';

test.describe('Timeline Page', () => {
  test.beforeEach(async ({ timelinePage }) => {
    await timelinePage.goto();
  });

  test('should display timeline heading and date', async ({ timelinePage }) => {
    await expect(timelinePage.heading).toBeVisible();
    // Date should be visible
    const dateText = await timelinePage.getCurrentDateText();
    expect(dateText).toBeTruthy();
    // Should contain month and year format like "Monday, January 6, 2025"
    expect(dateText).toMatch(/\w+,\s+\w+\s+\d+,\s+\d+/);
  });

  test('should load sessions or show empty state', async ({ timelinePage }) => {
    await timelinePage.waitForSessionsToLoad();

    const sessionCount = await timelinePage.getSessionCount();
    if (sessionCount === 0) {
      await expect(timelinePage.emptyState).toBeVisible();
    } else {
      await expect(timelinePage.sessionCards.first()).toBeVisible();
    }
  });

  test('should expand session card to show details', async ({ timelinePage }) => {
    await timelinePage.waitForSessionsToLoad();
    const sessionCount = await timelinePage.getSessionCount();

    test.skip(sessionCount === 0, 'No sessions to expand');

    await timelinePage.expandSession(0);

    // Check if expanded
    const isExpanded = await timelinePage.isSessionExpanded(0);
    expect(isExpanded).toBeTruthy();
  });

  test('should navigate between days', async ({ timelinePage }) => {
    await timelinePage.waitForSessionsToLoad();
    const initialDate = await timelinePage.getCurrentDateText();

    // Go to previous day
    await timelinePage.goToPreviousDay();
    await timelinePage.page.waitForTimeout(500);
    const newDate = await timelinePage.getCurrentDateText();

    // Date should have changed
    expect(newDate).not.toBe(initialDate);

    // Go forward (back towards today)
    await timelinePage.goToNextDay();
    await timelinePage.page.waitForTimeout(500);
    const finalDate = await timelinePage.getCurrentDateText();

    // Should be back to initial date
    expect(finalDate).toBe(initialDate);
  });

  test('should show calendar widget on desktop', async ({ timelinePage }) => {
    // Calendar should be visible (may require data-testid)
    // For now, check that the page has the calendar sidebar area
    const calendarArea = timelinePage.page.locator('.w-72');
    await expect(calendarArea).toBeVisible();
  });
});
