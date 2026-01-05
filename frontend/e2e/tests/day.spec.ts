import { test, expect } from '../fixtures/test-fixtures';

test.describe('Day Page', () => {
  test('should display day view with date in header', async ({ dayPage }) => {
    const today = new Date().toISOString().split('T')[0];
    await dayPage.goto(today);

    await expect(dayPage.heading).toBeVisible();
    await expect(dayPage.statsBar).toBeVisible();
  });

  test('should show stats bar with screenshot count', async ({ dayPage }) => {
    const today = new Date().toISOString().split('T')[0];
    await dayPage.goto(today);
    await dayPage.waitForHourGroupsToLoad();

    // Stats bar should show screenshots count
    const statsText = await dayPage.statsBar.textContent();
    expect(statsText).toContain('screenshots');
    expect(statsText).toContain('sessions');
  });

  test('should navigate between days using arrows', async ({ dayPage }) => {
    const today = new Date().toISOString().split('T')[0];
    await dayPage.goto(today);

    const initialHeading = await dayPage.getDateFromHeading();

    // Go to previous day
    await dayPage.goToPreviousDay();

    // URL should have changed
    const url = dayPage.page.url();
    expect(url).not.toContain(today);

    // Heading should show different date
    const newHeading = await dayPage.getDateFromHeading();
    expect(newHeading).not.toBe(initialHeading);
  });

  test('should navigate to day page from URL', async ({ dayPage }) => {
    // Navigate to a specific date
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    await dayPage.goto(yesterdayStr);

    // Should be on the correct URL
    await expect(dayPage.page).toHaveURL(new RegExp(yesterdayStr));
  });
});
