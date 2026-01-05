import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';

export class TimelinePage extends BasePage {
  readonly heading: Locator;
  readonly dateDisplay: Locator;
  readonly sessionCards: Locator;
  readonly calendarWidget: Locator;
  readonly prevDayButton: Locator;
  readonly nextDayButton: Locator;
  readonly todayButton: Locator;
  readonly emptyState: Locator;
  readonly loadingSkeleton: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByRole('heading', { name: /Timeline/i });
    this.dateDisplay = page.locator('p.text-muted-foreground').first();
    this.sessionCards = page.locator('[data-testid="session-card"]');
    this.calendarWidget = page.locator('[data-testid="calendar-widget"]');
    this.prevDayButton = page.locator('button').filter({ has: page.locator('svg.lucide-chevron-left') }).first();
    this.nextDayButton = page.locator('button').filter({ has: page.locator('svg.lucide-chevron-right') }).first();
    // The Today button in the header navigation area (not the calendar widget)
    this.todayButton = page.locator('.flex.items-center.gap-2').filter({ has: page.locator('button:has-text("Today")') }).getByRole('button', { name: 'Today' });
    this.emptyState = page.getByText('No sessions recorded');
    this.loadingSkeleton = page.locator('[class*="skeleton"]');
  }

  async goto() {
    await super.goto('/');
  }

  async waitForSessionsToLoad() {
    // Wait for loading to complete - either sessions appear or empty state
    await this.page.waitForTimeout(1000);

    // Check if we have sessions or empty state
    const hasSessionCards = await this.sessionCards.count() > 0;
    const hasEmptyState = await this.emptyState.isVisible().catch(() => false);

    if (!hasSessionCards && !hasEmptyState) {
      // Wait a bit more for data to load
      await this.page.waitForTimeout(2000);
    }
  }

  async getSessionCount(): Promise<number> {
    return this.sessionCards.count();
  }

  async expandSession(index: number) {
    const card = this.sessionCards.nth(index);
    // Click the chevron button to expand
    const expandButton = card.locator('button').first();
    await expandButton.click();
    // Wait for expanded content to appear
    await this.page.waitForTimeout(300);
  }

  async isSessionExpanded(index: number): Promise<boolean> {
    const card = this.sessionCards.nth(index);
    // When expanded, there's a border-t class on the expanded content
    const expandedContent = card.locator('.border-t');
    return expandedContent.isVisible();
  }

  async clickViewDetails(index: number) {
    const card = this.sessionCards.nth(index);
    await card.getByRole('button', { name: /View Details/i }).click();
  }

  async goToPreviousDay() {
    await this.prevDayButton.click();
    await this.waitForSessionsToLoad();
  }

  async goToNextDay() {
    await this.nextDayButton.click();
    await this.waitForSessionsToLoad();
  }

  async goToToday() {
    if (await this.todayButton.isVisible()) {
      await this.todayButton.click();
      await this.waitForSessionsToLoad();
    }
  }

  async getCurrentDateText(): Promise<string | null> {
    return this.dateDisplay.textContent();
  }
}
