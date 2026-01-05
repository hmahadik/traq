import { Page, Locator, expect } from '@playwright/test';

export class BasePage {
  readonly page: Page;
  readonly header: Locator;
  readonly navTimeline: Locator;
  readonly navAnalytics: Locator;
  readonly navReports: Locator;
  readonly settingsButton: Locator;
  readonly logo: Locator;

  constructor(page: Page) {
    this.page = page;
    this.header = page.locator('header');
    this.logo = page.getByText('Traq', { exact: true });
    this.navTimeline = page.getByRole('link', { name: /Timeline/i });
    this.navAnalytics = page.getByRole('link', { name: /Analytics/i });
    this.navReports = page.getByRole('link', { name: /Reports/i });
    this.settingsButton = page.getByRole('button', { name: /Settings/i });
  }

  async goto(path: string = '/') {
    await this.page.goto(path);
    await this.waitForPageLoad();
  }

  async waitForPageLoad() {
    // Wait for React to mount
    await this.page.waitForLoadState('domcontentloaded');
    // Give React Query time to fetch initial data
    await this.page.waitForTimeout(500);
  }

  async openSettings() {
    await this.settingsButton.click();
    await this.page.waitForSelector('[role="dialog"]');
  }

  async navigateTo(pageName: 'timeline' | 'analytics' | 'reports') {
    const nav = {
      timeline: this.navTimeline,
      analytics: this.navAnalytics,
      reports: this.navReports,
    };
    await nav[pageName].click();
    await this.waitForPageLoad();
  }

  async expectCurrentPath(pathPattern: string | RegExp) {
    const pattern = typeof pathPattern === 'string' ? new RegExp(pathPattern) : pathPattern;
    await expect(this.page).toHaveURL(pattern);
  }

  async goHome() {
    await this.logo.click();
    await this.waitForPageLoad();
  }
}
