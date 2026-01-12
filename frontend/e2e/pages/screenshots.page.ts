import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';

export class ScreenshotsPage extends BasePage {
  readonly heading: Locator;
  readonly dateDisplay: Locator;

  // Navigation
  readonly prevDayButton: Locator;
  readonly nextDayButton: Locator;
  readonly todayButton: Locator;

  // Filters
  readonly searchInput: Locator;
  readonly appFilter: Locator;

  // Selection
  readonly selectAllButton: Locator;
  readonly clearSelectionButton: Locator;
  readonly deleteSelectedButton: Locator;

  // Screenshot grid
  readonly screenshotGrid: Locator;
  readonly screenshotCards: Locator;
  readonly screenshotCount: Locator;

  // Empty state
  readonly emptyState: Locator;

  // Preview dialog
  readonly previewDialog: Locator;
  readonly previewImage: Locator;
  readonly previewCloseButton: Locator;
  readonly previewDeleteButton: Locator;
  readonly previewPrevButton: Locator;
  readonly previewNextButton: Locator;
  readonly previewCounter: Locator;

  // Loading
  readonly loadingSpinner: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByRole('heading', { name: /Screenshots/i });
    this.dateDisplay = page.locator('p.text-muted-foreground').first();

    // Navigation buttons (using icon detection)
    this.prevDayButton = page.locator('button').filter({ has: page.locator('svg.lucide-chevron-left') }).first();
    this.nextDayButton = page.locator('button').filter({ has: page.locator('svg.lucide-chevron-right') }).first();
    this.todayButton = page.getByRole('button', { name: 'Today' });

    // Filters
    this.searchInput = page.getByPlaceholder(/Search by window title/i);
    this.appFilter = page.locator('button[role="combobox"]').filter({ hasText: /All Apps|Filter by app/i });

    // Selection controls
    this.selectAllButton = page.getByRole('button', { name: /Select All/i });
    this.clearSelectionButton = page.getByRole('button', { name: /Clear/i });
    this.deleteSelectedButton = page.getByRole('button', { name: /Delete/i });

    // Grid
    this.screenshotGrid = page.locator('[class*="grid"]').filter({ has: page.locator('[class*="aspect-video"]') });
    this.screenshotCards = page.locator('[class*="group relative cursor-pointer"]');
    this.screenshotCount = page.locator('text=/\\d+ screenshots/');

    // Empty state
    this.emptyState = page.locator('text=No screenshots found');

    // Preview dialog
    this.previewDialog = page.locator('[role="dialog"]');
    this.previewImage = this.previewDialog.locator('img');
    this.previewCloseButton = this.previewDialog.locator('button[class*="close"]').or(
      this.previewDialog.locator('button').filter({ has: page.locator('svg.lucide-x') })
    );
    this.previewDeleteButton = this.previewDialog.getByRole('button', { name: /Delete/i });
    this.previewPrevButton = this.previewDialog.getByTestId('gallery-prev');
    this.previewNextButton = this.previewDialog.getByTestId('gallery-next');
    this.previewCounter = this.previewDialog.locator('text=/\\d+ \\/ \\d+/');

    // Loading
    this.loadingSpinner = page.locator('[class*="animate-spin"]');
  }

  async goto() {
    await super.goto('/#/screenshots');
  }

  async waitForScreenshotsToLoad() {
    await this.page.waitForTimeout(1000);

    // Wait for either screenshots or empty state
    const hasScreenshots = await this.screenshotCards.count() > 0;
    const hasEmptyState = await this.emptyState.isVisible().catch(() => false);

    if (!hasScreenshots && !hasEmptyState) {
      await this.page.waitForTimeout(2000);
    }
  }

  async getScreenshotCount(): Promise<number> {
    return this.screenshotCards.count();
  }

  async getCurrentDateText(): Promise<string | null> {
    return this.dateDisplay.textContent();
  }

  async goToPreviousDay() {
    await this.prevDayButton.click();
    await this.waitForScreenshotsToLoad();
  }

  async goToNextDay() {
    await this.nextDayButton.click();
    await this.waitForScreenshotsToLoad();
  }

  async goToToday() {
    await this.todayButton.click();
    await this.waitForScreenshotsToLoad();
  }

  async searchByWindowTitle(query: string) {
    await this.searchInput.fill(query);
    await this.page.waitForTimeout(500);
  }

  async clearSearch() {
    await this.searchInput.clear();
    await this.page.waitForTimeout(500);
  }

  async openAppFilter() {
    await this.appFilter.click();
  }

  async selectApp(appName: string) {
    await this.openAppFilter();
    await this.page.getByRole('option', { name: appName }).click();
    await this.page.waitForTimeout(500);
  }

  async clickScreenshot(index: number) {
    const card = this.screenshotCards.nth(index);
    await card.click();
    // Wait for dialog to open
    await this.page.waitForSelector('[role="dialog"]', { timeout: 5000 });
  }

  async closePreview() {
    // Press Escape or click close button
    await this.page.keyboard.press('Escape');
    await this.page.waitForTimeout(300);
  }

  async selectScreenshot(index: number) {
    const card = this.screenshotCards.nth(index);
    // Click the selection indicator (checkbox area)
    const checkbox = card.locator('[class*="rounded-full"]').first();
    await checkbox.click({ force: true });
  }

  async selectAllScreenshots() {
    await this.selectAllButton.click();
  }

  async clearSelection() {
    await this.clearSelectionButton.click();
  }

  async getSelectedCount(): Promise<number> {
    // Count cards with ring-primary class (selected state)
    return this.page.locator('[class*="ring-primary"]').count();
  }

  async clickPrevInGallery() {
    await this.previewPrevButton.click();
    await this.page.waitForTimeout(300);
  }

  async clickNextInGallery() {
    await this.previewNextButton.click();
    await this.page.waitForTimeout(300);
  }

  async getGalleryCounter(): Promise<string | null> {
    return this.previewCounter.textContent();
  }

  async navigateGalleryWithKeyboard(direction: 'left' | 'right') {
    await this.page.keyboard.press(direction === 'left' ? 'ArrowLeft' : 'ArrowRight');
    await this.page.waitForTimeout(300);
  }
}
