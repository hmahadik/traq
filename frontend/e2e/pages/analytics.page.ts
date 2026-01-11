import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';

export class AnalyticsPage extends BasePage {
  readonly heading: Locator;
  readonly dateDisplay: Locator;

  // View mode tabs
  readonly dayTab: Locator;
  readonly weekTab: Locator;
  readonly monthTab: Locator;
  readonly yearTab: Locator;
  readonly customTab: Locator;

  // Buttons
  readonly regenerateButton: Locator;
  readonly exportButton: Locator;

  // Stats and charts
  readonly statsGrid: Locator;
  readonly productivityScoreCard: Locator;

  // Content tabs
  readonly activityTab: Locator;
  readonly appsTab: Locator;
  readonly sourcesTab: Locator;

  // Charts
  readonly activityChart: Locator;
  readonly appUsageChart: Locator;
  readonly focusDistributionChart: Locator;

  // Tables and lists
  readonly appUsageTable: Locator;
  readonly topWindowsList: Locator;

  // Loading states
  readonly loadingSkeleton: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByRole('heading', { name: /Analytics/i });
    this.dateDisplay = page.locator('p.text-muted-foreground').first();

    // View mode tabs
    this.dayTab = page.getByRole('tab', { name: 'Day' });
    this.weekTab = page.getByRole('tab', { name: 'Week' });
    this.monthTab = page.getByRole('tab', { name: 'Month' });
    this.yearTab = page.getByRole('tab', { name: 'Year' });
    this.customTab = page.getByRole('tab', { name: 'Custom' });

    // Buttons
    this.regenerateButton = page.getByRole('button', { name: /Regenerate/i });
    this.exportButton = page.getByRole('button', { name: /Export/i });

    // Stats grid (contains stat cards)
    this.statsGrid = page.locator('[class*="grid"]').first();
    this.productivityScoreCard = page.locator('text=Productivity Score').locator('..');

    // Content tabs
    this.activityTab = page.getByRole('tab', { name: 'Activity' });
    this.appsTab = page.getByRole('tab', { name: 'Applications' });
    this.sourcesTab = page.getByRole('tab', { name: 'Data Sources' });

    // Charts (by their container or title)
    this.activityChart = page.locator('text=Hourly Activity').locator('..').locator('..');
    this.appUsageChart = page.locator('text=App Usage').locator('..').locator('..');
    this.focusDistributionChart = page.locator('text=Focus Distribution').locator('..').locator('..');

    // Tables
    this.appUsageTable = page.locator('table');
    this.topWindowsList = page.locator('text=Top Windows').locator('..').locator('..');

    // Loading
    this.loadingSkeleton = page.locator('[class*="skeleton"]');
  }

  async goto() {
    await super.goto('/#/analytics');
  }

  async waitForDataToLoad() {
    // Wait for loading skeletons to disappear or content to appear
    await this.page.waitForTimeout(1000);

    // Check for either data or empty state
    const hasStats = await this.statsGrid.isVisible().catch(() => false);
    if (!hasStats) {
      await this.page.waitForTimeout(2000);
    }
  }

  async switchToView(view: 'day' | 'week' | 'month' | 'year' | 'custom') {
    const tabs = {
      day: this.dayTab,
      week: this.weekTab,
      month: this.monthTab,
      year: this.yearTab,
      custom: this.customTab,
    };
    await tabs[view].click();
    await this.waitForDataToLoad();
  }

  async isViewActive(view: 'day' | 'week' | 'month' | 'year' | 'custom'): Promise<boolean> {
    const tabs = {
      day: this.dayTab,
      week: this.weekTab,
      month: this.monthTab,
      year: this.yearTab,
      custom: this.customTab,
    };
    const ariaSelected = await tabs[view].getAttribute('aria-selected');
    return ariaSelected === 'true';
  }

  async switchToContentTab(tab: 'activity' | 'apps' | 'sources') {
    const tabs = {
      activity: this.activityTab,
      apps: this.appsTab,
      sources: this.sourcesTab,
    };
    await tabs[tab].click();
    await this.page.waitForTimeout(500);
  }

  async getCurrentDateText(): Promise<string | null> {
    return this.dateDisplay.textContent();
  }

  async exportAs(format: 'csv' | 'html' | 'json') {
    await this.exportButton.click();
    const menuItem = this.page.getByRole('menuitem', { name: new RegExp(format, 'i') });
    await menuItem.click();
  }

  async clickRegenerate() {
    await this.regenerateButton.click();
    // Wait for regeneration to complete
    await this.page.waitForTimeout(1000);
  }
}
