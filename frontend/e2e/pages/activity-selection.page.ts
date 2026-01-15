import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * Page object for Activity Selection and Editing features
 *
 * Tests activity block selection (click, shift+click, lasso),
 * activity editing dialog, and bulk delete functionality.
 */
export class ActivitySelectionPage extends BasePage {
  // Activity blocks in grid and list views
  readonly activityBlocks: Locator;
  readonly activityListItems: Locator;

  // Selection toolbar
  readonly selectionToolbar: Locator;
  readonly selectedCountText: Locator;
  readonly deleteButton: Locator;
  readonly clearSelectionButton: Locator;

  // Delete confirmation dialog
  readonly deleteConfirmDialog: Locator;
  readonly confirmDeleteButton: Locator;
  readonly cancelDeleteButton: Locator;

  // Activity edit dialog
  readonly editDialog: Locator;
  readonly editDialogTitle: Locator;
  readonly appNameInput: Locator;
  readonly windowTitleInput: Locator;
  readonly categorySelect: Locator;
  readonly startTimeInput: Locator;
  readonly endTimeInput: Locator;
  readonly saveButton: Locator;
  readonly cancelButton: Locator;

  // View mode toggles
  readonly gridViewToggle: Locator;
  readonly listViewToggle: Locator;
  readonly splitViewToggle: Locator;

  // Lasso selection overlay
  readonly lassoOverlay: Locator;

  constructor(page: Page) {
    super(page);

    // Activity blocks - elements with data-activity-id attribute
    this.activityBlocks = page.locator('[data-activity-id]');
    this.activityListItems = page.locator('[data-activity-id][aria-selected]');

    // Selection toolbar (fixed at bottom)
    this.selectionToolbar = page.locator('.fixed.bottom-6');
    this.selectedCountText = this.selectionToolbar.locator('span.text-sm.font-medium');
    this.deleteButton = this.selectionToolbar.getByRole('button', { name: /Delete/i });
    this.clearSelectionButton = this.selectionToolbar.getByRole('button', { name: /Clear/i });

    // Delete confirmation dialog
    this.deleteConfirmDialog = page.getByRole('alertdialog');
    this.confirmDeleteButton = this.deleteConfirmDialog.getByRole('button', { name: /Delete/i });
    this.cancelDeleteButton = this.deleteConfirmDialog.getByRole('button', { name: /Cancel/i });

    // Activity edit dialog
    this.editDialog = page.getByRole('dialog').filter({ hasText: 'Edit Activity' });
    this.editDialogTitle = this.editDialog.getByRole('heading', { name: 'Edit Activity' });
    this.appNameInput = this.editDialog.locator('#appName');
    this.windowTitleInput = this.editDialog.locator('#windowTitle');
    this.categorySelect = this.editDialog.getByRole('combobox');
    this.startTimeInput = this.editDialog.locator('#startTime');
    this.endTimeInput = this.editDialog.locator('#endTime');
    this.saveButton = this.editDialog.getByRole('button', { name: /Save/i });
    this.cancelButton = this.editDialog.getByRole('button', { name: /Cancel/i });

    // View mode toggles
    this.gridViewToggle = page.getByRole('button', { name: /Grid/i });
    this.listViewToggle = page.getByRole('button', { name: /List/i });
    this.splitViewToggle = page.getByRole('button', { name: /Split/i });

    // Lasso selection overlay (blue semi-transparent rectangle)
    this.lassoOverlay = page.locator('.border-blue-500.bg-blue-500\\/10');
  }

  async goto() {
    await super.goto('/');
    await this.waitForActivitiesToLoad();
  }

  async waitForActivitiesToLoad() {
    // Wait for timeline to load
    await this.page.waitForTimeout(1500);
    // Wait for activity blocks to be present
    await this.page.waitForSelector('[data-activity-id]', { timeout: 10000 }).catch(() => {});
  }

  async getActivityCount(): Promise<number> {
    return this.activityBlocks.count();
  }

  async getSelectedActivityCount(): Promise<number> {
    return this.activityBlocks.filter({ has: this.page.locator('[aria-selected="true"]') }).count();
  }

  /**
   * Click a single activity block to select it
   */
  async clickActivity(index: number) {
    const activity = this.activityBlocks.nth(index);
    // Scroll into view and use force click to handle sticky header overlaps
    await activity.scrollIntoViewIfNeeded();
    await activity.click({ force: true });
  }

  /**
   * Shift+click to select a range from last selected to this activity
   */
  async shiftClickActivity(index: number) {
    const activity = this.activityBlocks.nth(index);
    await activity.scrollIntoViewIfNeeded();
    await activity.click({ modifiers: ['Shift'], force: true });
  }

  /**
   * Ctrl/Cmd+click to toggle an activity in the selection
   */
  async ctrlClickActivity(index: number) {
    const activity = this.activityBlocks.nth(index);
    const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
    await activity.scrollIntoViewIfNeeded();
    await activity.click({ modifiers: [modifier], force: true });
  }

  /**
   * Double-click to open edit dialog
   */
  async doubleClickActivity(index: number) {
    const activity = this.activityBlocks.nth(index);
    await activity.scrollIntoViewIfNeeded();
    await activity.dblclick({ force: true });
  }

  /**
   * Check if an activity is selected
   */
  async isActivitySelected(index: number): Promise<boolean> {
    const activity = this.activityBlocks.nth(index);
    const ariaSelected = await activity.getAttribute('aria-selected');
    return ariaSelected === 'true';
  }

  /**
   * Perform lasso selection by dragging from start to end position
   * Coordinates are relative to the timeline grid container
   */
  async lassoSelect(startX: number, startY: number, endX: number, endY: number) {
    const gridContainer = this.page.locator('.bg-card.border.border-border').first();
    const box = await gridContainer.boundingBox();
    if (!box) throw new Error('Grid container not found');

    await this.page.mouse.move(box.x + startX, box.y + startY);
    await this.page.mouse.down();
    await this.page.mouse.move(box.x + endX, box.y + endY, { steps: 10 });
    await this.page.mouse.up();
  }

  /**
   * Clear current selection
   */
  async clearSelection() {
    if (await this.clearSelectionButton.isVisible()) {
      await this.clearSelectionButton.click();
    }
  }

  /**
   * Press Escape to clear selection
   */
  async pressEscapeToClear() {
    await this.page.keyboard.press('Escape');
  }

  /**
   * Delete selected activities
   */
  async deleteSelected() {
    await this.deleteButton.click();
    await expect(this.deleteConfirmDialog).toBeVisible();
    await this.confirmDeleteButton.click();
  }

  /**
   * Cancel delete operation
   */
  async cancelDelete() {
    await this.deleteButton.click();
    await expect(this.deleteConfirmDialog).toBeVisible();
    await this.cancelDeleteButton.click();
  }

  /**
   * Get the selected count text from toolbar
   */
  async getSelectedCountText(): Promise<string | null> {
    if (await this.selectionToolbar.isVisible()) {
      return this.selectedCountText.textContent();
    }
    return null;
  }

  /**
   * Switch to grid view
   */
  async switchToGridView() {
    await this.gridViewToggle.click();
    await this.waitForActivitiesToLoad();
  }

  /**
   * Switch to list view
   */
  async switchToListView() {
    await this.listViewToggle.click();
    await this.waitForActivitiesToLoad();
  }

  /**
   * Switch to split view
   */
  async switchToSplitView() {
    await this.splitViewToggle.click();
    await this.waitForActivitiesToLoad();
  }

  // Edit dialog methods

  /**
   * Open edit dialog for an activity
   */
  async openEditDialog(activityIndex: number) {
    await this.doubleClickActivity(activityIndex);
    await expect(this.editDialog).toBeVisible();
  }

  /**
   * Fill the edit dialog form
   */
  async fillEditForm(data: {
    appName?: string;
    windowTitle?: string;
    category?: string;
    startTime?: string;
    endTime?: string;
  }) {
    if (data.appName !== undefined) {
      await this.appNameInput.clear();
      await this.appNameInput.fill(data.appName);
    }
    if (data.windowTitle !== undefined) {
      await this.windowTitleInput.clear();
      await this.windowTitleInput.fill(data.windowTitle);
    }
    if (data.category !== undefined) {
      await this.categorySelect.click();
      await this.page.getByRole('option', { name: data.category }).click();
    }
    if (data.startTime !== undefined) {
      await this.startTimeInput.fill(data.startTime);
    }
    if (data.endTime !== undefined) {
      await this.endTimeInput.fill(data.endTime);
    }
  }

  /**
   * Save changes in edit dialog
   */
  async saveEdit() {
    await this.saveButton.click();
    // Wait for dialog to close
    await expect(this.editDialog).not.toBeVisible();
  }

  /**
   * Cancel edit dialog
   */
  async cancelEdit() {
    await this.cancelButton.click();
    await expect(this.editDialog).not.toBeVisible();
  }

  /**
   * Get current values from edit dialog
   */
  async getEditFormValues() {
    return {
      appName: await this.appNameInput.inputValue(),
      windowTitle: await this.windowTitleInput.inputValue(),
      startTime: await this.startTimeInput.inputValue(),
      endTime: await this.endTimeInput.inputValue(),
    };
  }
}
