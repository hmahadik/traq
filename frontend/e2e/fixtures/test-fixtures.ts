import { test as base } from '@playwright/test';
import { TimelinePage } from '../pages/timeline.page';
import { DayPage } from '../pages/day.page';
import { SettingsDrawer } from '../pages/settings-drawer';

type Fixtures = {
  timelinePage: TimelinePage;
  dayPage: DayPage;
  settingsDrawer: SettingsDrawer;
};

export const test = base.extend<Fixtures>({
  timelinePage: async ({ page }, use) => {
    await use(new TimelinePage(page));
  },
  dayPage: async ({ page }, use) => {
    await use(new DayPage(page));
  },
  settingsDrawer: async ({ page }, use) => {
    await use(new SettingsDrawer(page));
  },
});

export { expect } from '@playwright/test';
