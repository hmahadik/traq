import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';

export class DayPage extends BasePage {
  readonly heading: Locator;
  readonly statsBar: Locator;
  readonly hourGroups: Locator;
  readonly imageGallery: Locator;
  readonly galleryNextButton: Locator;
  readonly galleryPrevButton: Locator;
  readonly galleryCloseButton: Locator;
  readonly prevDayButton: Locator;
  readonly nextDayButton: Locator;
  readonly datePicker: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.locator('h1.text-2xl');
    this.statsBar = page.locator('.flex.items-center.gap-6.text-sm.text-muted-foreground');
    this.hourGroups = page.locator('[data-testid="hour-group"]');
    this.imageGallery = page.locator('[data-testid="image-gallery"]');
    this.galleryNextButton = page.locator('[data-testid="gallery-next"]');
    this.galleryPrevButton = page.locator('[data-testid="gallery-prev"]');
    this.galleryCloseButton = page.locator('[data-testid="gallery-close"]');
    this.prevDayButton = page.locator('button').filter({ has: page.locator('svg.lucide-chevron-left') }).first();
    this.nextDayButton = page.locator('button').filter({ has: page.locator('svg.lucide-chevron-right') }).first();
    this.datePicker = page.locator('[data-testid="date-picker"]');
  }

  async goto(date?: string) {
    const path = date ? `/day/${date}` : `/day/${this.getTodayDateString()}`;
    await super.goto(path);
  }

  private getTodayDateString(): string {
    return new Date().toISOString().split('T')[0];
  }

  async waitForHourGroupsToLoad() {
    await this.page.waitForTimeout(1000);
  }

  async hasScreenshots(): Promise<boolean> {
    // Check if any screenshot thumbnails exist
    const screenshots = this.page.locator('[data-testid="screenshot-thumbnail"]');
    const count = await screenshots.count();
    return count > 0;
  }

  async clickFirstScreenshot() {
    const screenshot = this.page.locator('[data-testid="screenshot-thumbnail"]').first();
    await screenshot.click();
    // Wait for gallery to open
    await this.page.waitForTimeout(300);
  }

  async closeGallery() {
    // Press Escape to close
    await this.page.keyboard.press('Escape');
    await this.page.waitForTimeout(300);
  }

  async goToPreviousDay() {
    await this.prevDayButton.click();
    await this.waitForHourGroupsToLoad();
  }

  async goToNextDay() {
    await this.nextDayButton.click();
    await this.waitForHourGroupsToLoad();
  }

  async getHourGroupCount(): Promise<number> {
    return this.hourGroups.count();
  }

  async expandHourGroup(index: number) {
    const group = this.hourGroups.nth(index);
    await group.click();
    await this.page.waitForTimeout(200);
  }

  async getDateFromHeading(): Promise<string | null> {
    return this.heading.textContent();
  }
}
