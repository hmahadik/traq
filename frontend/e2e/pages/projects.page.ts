import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';

export class ProjectsPage extends BasePage {
  readonly heading: Locator;
  readonly description: Locator;
  readonly newProjectButton: Locator;
  readonly projectCards: Locator;
  readonly createFirstProjectButton: Locator;

  // Dialog elements
  readonly projectDialog: Locator;
  readonly nameInput: Locator;
  readonly descriptionInput: Locator;
  readonly colorButtons: Locator;
  readonly cancelButton: Locator;
  readonly saveButton: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByRole('heading', { name: 'Projects' });
    this.description = page.getByText('Organize activities into projects');
    this.newProjectButton = page.getByRole('button', { name: /New Project/i });
    this.projectCards = page.locator('[class*="card"]').filter({ has: page.locator('[class*="rounded-full"]') });
    this.createFirstProjectButton = page.getByRole('button', { name: /Create First Project/i });

    // Dialog
    this.projectDialog = page.locator('[role="dialog"]');
    this.nameInput = page.locator('#name');
    this.descriptionInput = page.locator('#description');
    this.colorButtons = page.locator('[role="dialog"] button[style*="background-color"]');
    this.cancelButton = page.getByRole('button', { name: 'Cancel' });
    this.saveButton = page.getByRole('button', { name: /Create Project|Save Changes/i });
  }

  async goto() {
    await super.goto('/#/projects');
  }

  async openNewProjectDialog() {
    // Try "New Project" button first, fall back to "Create First Project"
    const newBtn = this.newProjectButton;
    const firstBtn = this.createFirstProjectButton;

    if (await newBtn.isVisible()) {
      await newBtn.click();
    } else if (await firstBtn.isVisible()) {
      await firstBtn.click();
    }

    await expect(this.projectDialog).toBeVisible();
  }

  async createProject(name: string, description?: string) {
    await this.openNewProjectDialog();
    await this.nameInput.fill(name);
    if (description) {
      await this.descriptionInput.fill(description);
    }

    // Wait for button to be enabled and click it
    await expect(this.saveButton).toBeEnabled();
    await this.saveButton.click();

    // Wait for either dialog to close OR toast notification
    await this.page.waitForTimeout(1000);

    // Check if dialog closed or if there's an error toast
    const dialogVisible = await this.projectDialog.isVisible();
    if (dialogVisible) {
      // Check for error toast
      const errorToast = this.page.locator('[data-sonner-toast][data-type="error"]');
      const hasError = await errorToast.isVisible().catch(() => false);
      if (hasError) {
        const errorText = await errorToast.textContent();
        throw new Error(`Project creation failed: ${errorText}`);
      }
      // If still visible, maybe just need more time
      await expect(this.projectDialog).not.toBeVisible({ timeout: 10000 });
    }
  }

  async selectColor(index: number) {
    const colorBtn = this.colorButtons.nth(index);
    await colorBtn.click();
  }

  async getProjectCount(): Promise<number> {
    // Wait a moment for the list to load
    await this.page.waitForTimeout(500);
    return await this.projectCards.count();
  }

  async isProjectVisible(name: string): Promise<boolean> {
    const projectCard = this.page.locator('[class*="card"]').filter({ hasText: name });
    return await projectCard.isVisible();
  }

  async deleteProject(name: string) {
    const projectCard = this.page.locator('[class*="card"]').filter({ hasText: name });
    const deleteBtn = projectCard.getByRole('button').filter({ has: this.page.locator('svg.lucide-trash-2') });
    await deleteBtn.click();

    // Confirm deletion in alert dialog
    const confirmBtn = this.page.getByRole('button', { name: 'Delete' }).last();
    await confirmBtn.click();
  }
}
