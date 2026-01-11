import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';

export class ReportsPage extends BasePage {
  readonly heading: Locator;
  readonly description: Locator;

  // Quick presets
  readonly quickPresetsCard: Locator;
  readonly yesterdayStandupButton: Locator;
  readonly lastWeekSummaryButton: Locator;
  readonly todayDetailedButton: Locator;

  // Time range input
  readonly timeRangeInput: Locator;

  // Report type selector
  readonly summaryType: Locator;
  readonly detailedType: Locator;
  readonly standupType: Locator;

  // Options
  readonly includeScreenshotsSwitch: Locator;

  // Generate button
  readonly generateButton: Locator;

  // Preview area
  readonly previewCard: Locator;
  readonly previewTitle: Locator;
  readonly previewContent: Locator;

  // Export buttons (in preview)
  readonly exportMarkdownButton: Locator;
  readonly exportHtmlButton: Locator;
  readonly exportJsonButton: Locator;

  // Report history
  readonly reportHistorySection: Locator;

  // Daily summaries
  readonly dailySummariesSection: Locator;

  // Loading states
  readonly generatingSpinner: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByRole('heading', { name: /Reports/i });
    this.description = page.locator('text=Generate and export activity reports');

    // Quick presets
    this.quickPresetsCard = page.locator('text=Quick Generate').locator('..');
    this.yesterdayStandupButton = page.getByRole('button', { name: /Yesterday.*Standup/i });
    this.lastWeekSummaryButton = page.getByRole('button', { name: /Last Week.*Summary/i });
    this.todayDetailedButton = page.getByRole('button', { name: /Today.*Detailed/i });

    // Time range input
    this.timeRangeInput = page.getByPlaceholder(/yesterday|last week/i).or(
      page.locator('input[type="text"]').first()
    );

    // Report types (radio buttons or cards)
    this.summaryType = page.locator('text=Summary').first();
    this.detailedType = page.locator('text=Detailed').first();
    this.standupType = page.locator('text=Standup').first();

    // Options
    this.includeScreenshotsSwitch = page.locator('#includeScreenshots');

    // Generate button
    this.generateButton = page.getByRole('button', { name: /Generate Report/i });

    // Preview
    this.previewCard = page.locator('text=Report Preview').locator('..').locator('..');
    this.previewTitle = page.locator('[class*="preview"]').locator('h3').first();
    this.previewContent = page.locator('[class*="preview"]').locator('[class*="prose"]');

    // Export buttons
    this.exportMarkdownButton = page.getByRole('button', { name: /Markdown|\.md/i });
    this.exportHtmlButton = page.getByRole('button', { name: /HTML/i });
    this.exportJsonButton = page.getByRole('button', { name: /JSON/i });

    // History sections
    this.reportHistorySection = page.locator('text=Report History').locator('..').locator('..');
    this.dailySummariesSection = page.locator('text=Daily Summaries').locator('..').locator('..');

    // Loading
    this.generatingSpinner = page.locator('text=Generating').or(
      page.locator('[class*="animate-spin"]')
    );
  }

  async goto() {
    await super.goto('/#/reports');
  }

  async waitForPageLoad() {
    await super.waitForPageLoad();
    await expect(this.heading).toBeVisible();
  }

  async setTimeRange(range: string) {
    await this.timeRangeInput.fill(range);
  }

  async selectReportType(type: 'summary' | 'detailed' | 'standup') {
    const types = {
      summary: this.summaryType,
      detailed: this.detailedType,
      standup: this.standupType,
    };
    await types[type].click();
  }

  async toggleIncludeScreenshots() {
    await this.includeScreenshotsSwitch.click();
  }

  async generateReport() {
    await this.generateButton.click();
    // Wait for generation to start
    await this.page.waitForTimeout(500);
    // Wait for generation to complete (spinner disappears or preview appears)
    await this.page.waitForSelector('text=Generating', { state: 'hidden', timeout: 30000 }).catch(() => {});
    await this.page.waitForTimeout(1000);
  }

  async quickGenerate(preset: 'yesterday-standup' | 'last-week-summary' | 'today-detailed') {
    const buttons = {
      'yesterday-standup': this.yesterdayStandupButton,
      'last-week-summary': this.lastWeekSummaryButton,
      'today-detailed': this.todayDetailedButton,
    };
    await buttons[preset].click();
    // Wait for generation
    await this.page.waitForSelector('text=Generating', { state: 'hidden', timeout: 30000 }).catch(() => {});
    await this.page.waitForTimeout(1000);
  }

  async isReportGenerated(): Promise<boolean> {
    // Check if preview has content
    const previewContent = this.page.locator('[class*="prose"]').or(
      this.page.locator('text=## Summary').or(this.page.locator('text=## Detailed'))
    );
    return previewContent.isVisible().catch(() => false);
  }

  async getReportHistoryCount(): Promise<number> {
    const rows = this.reportHistorySection.locator('table tbody tr');
    return rows.count().catch(() => 0);
  }
}
