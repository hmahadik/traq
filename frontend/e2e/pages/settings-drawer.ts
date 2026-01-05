import { Page, Locator, expect } from '@playwright/test';

export class SettingsDrawer {
  readonly page: Page;
  readonly drawer: Locator;
  readonly closeButton: Locator;

  // Tabs
  readonly captureTab: Locator;
  readonly aiTab: Locator;
  readonly sourcesTab: Locator;
  readonly systemTab: Locator;

  // Capture settings
  readonly enableCaptureSwitch: Locator;
  readonly captureIntervalSlider: Locator;
  readonly captureIntervalValue: Locator;
  readonly imageQualitySlider: Locator;
  readonly afkTimeoutSlider: Locator;

  // Data sources
  readonly shellHistorySwitch: Locator;
  readonly gitActivitySwitch: Locator;
  readonly fileChangesSwitch: Locator;
  readonly browserHistorySwitch: Locator;

  // System
  readonly themeSelect: Locator;
  readonly startOnLoginSwitch: Locator;
  readonly showNotificationsSwitch: Locator;

  constructor(page: Page) {
    this.page = page;
    this.drawer = page.locator('[role="dialog"]');
    this.closeButton = this.drawer.locator('button[aria-label="Close"]');

    // Tabs
    this.captureTab = this.drawer.getByRole('tab', { name: /Capture/i });
    this.aiTab = this.drawer.getByRole('tab', { name: /AI/i });
    this.sourcesTab = this.drawer.getByRole('tab', { name: /Sources/i });
    this.systemTab = this.drawer.getByRole('tab', { name: /System/i });

    // Capture tab elements
    this.enableCaptureSwitch = this.drawer.locator('text=Enable Capture').locator('..').locator('..').locator('[role="switch"]');
    this.captureIntervalSlider = this.drawer.locator('text=Capture Interval').locator('..').locator('..').locator('[role="slider"]');
    this.captureIntervalValue = this.drawer.locator('text=Capture Interval').locator('..').locator('span').filter({ hasText: /\d+s/ });
    this.imageQualitySlider = this.drawer.locator('text=Image Quality').locator('..').locator('..').locator('[role="slider"]');
    this.afkTimeoutSlider = this.drawer.locator('text=AFK Timeout').locator('..').locator('..').locator('[role="slider"]');

    // Data sources
    this.shellHistorySwitch = this.drawer.locator('text=Shell History').locator('..').locator('..').locator('[role="switch"]');
    this.gitActivitySwitch = this.drawer.locator('text=Git Activity').locator('..').locator('..').locator('[role="switch"]');
    this.fileChangesSwitch = this.drawer.locator('text=File Changes').locator('..').locator('..').locator('[role="switch"]');
    this.browserHistorySwitch = this.drawer.locator('text=Browser History').locator('..').locator('..').locator('[role="switch"]');

    // System
    this.themeSelect = this.drawer.locator('text=Theme').locator('..').locator('[role="combobox"]');
    this.startOnLoginSwitch = this.drawer.locator('text=Start on Login').locator('..').locator('..').locator('[role="switch"]');
    this.showNotificationsSwitch = this.drawer.locator('text=Show Notifications').locator('..').locator('..').locator('[role="switch"]');
  }

  async expectVisible() {
    await expect(this.drawer).toBeVisible();
  }

  async expectNotVisible() {
    await expect(this.drawer).not.toBeVisible();
  }

  async close() {
    await this.page.keyboard.press('Escape');
    await this.page.waitForTimeout(300);
  }

  async selectTab(tab: 'capture' | 'ai' | 'sources' | 'system') {
    const tabs = {
      capture: this.captureTab,
      ai: this.aiTab,
      sources: this.sourcesTab,
      system: this.systemTab,
    };
    await tabs[tab].click();
    await this.page.waitForTimeout(200);
  }

  async isTabActive(tab: 'capture' | 'ai' | 'sources' | 'system'): Promise<boolean> {
    const tabs = {
      capture: this.captureTab,
      ai: this.aiTab,
      sources: this.sourcesTab,
      system: this.systemTab,
    };
    const state = await tabs[tab].getAttribute('data-state');
    return state === 'active';
  }

  async getCaptureIntervalValue(): Promise<string | null> {
    return this.captureIntervalValue.textContent();
  }

  async adjustSlider(slider: Locator, steps: number) {
    await slider.focus();
    await this.page.waitForTimeout(100);
    const key = steps > 0 ? 'ArrowRight' : 'ArrowLeft';
    for (let i = 0; i < Math.abs(steps); i++) {
      await this.page.keyboard.press(key);
      await this.page.waitForTimeout(50);
    }
    await this.page.waitForTimeout(200);
  }

  async toggleSwitch(switchLocator: Locator) {
    await switchLocator.click({ force: true });
    await this.page.waitForTimeout(500);
  }

  async getSwitchState(switchLocator: Locator): Promise<boolean> {
    const state = await switchLocator.getAttribute('data-state');
    return state === 'checked';
  }
}
