import { test as base } from '@playwright/test';
import { TimelinePage } from '../pages/timeline.page';
import { DayPage } from '../pages/day.page';
import { AnalyticsPage } from '../pages/analytics.page';
import { ReportsPage } from '../pages/reports.page';
import { ScreenshotsPage } from '../pages/screenshots.page';
import { IssueReportDialog } from '../pages/issue-dialog';
import { ActivitySelectionPage } from '../pages/activity-selection.page';
import { ProjectsPage } from '../pages/projects.page';

type Fixtures = {
  timelinePage: TimelinePage;
  dayPage: DayPage;
  analyticsPage: AnalyticsPage;
  reportsPage: ReportsPage;
  screenshotsPage: ScreenshotsPage;
  issueDialog: IssueReportDialog;
  activitySelectionPage: ActivitySelectionPage;
  projectsPage: ProjectsPage;
};

export const test = base.extend<Fixtures>({
  timelinePage: async ({ page }, use) => {
    await use(new TimelinePage(page));
  },
  dayPage: async ({ page }, use) => {
    await use(new DayPage(page));
  },
  analyticsPage: async ({ page }, use) => {
    await use(new AnalyticsPage(page));
  },
  reportsPage: async ({ page }, use) => {
    await use(new ReportsPage(page));
  },
  screenshotsPage: async ({ page }, use) => {
    await use(new ScreenshotsPage(page));
  },
  issueDialog: async ({ page }, use) => {
    await use(new IssueReportDialog(page));
  },
  activitySelectionPage: async ({ page }, use) => {
    await use(new ActivitySelectionPage(page));
  },
  projectsPage: async ({ page }, use) => {
    await use(new ProjectsPage(page));
  },
});

export { expect } from '@playwright/test';
