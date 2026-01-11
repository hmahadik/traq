import { Page, Locator, expect } from '@playwright/test';

/**
 * Page object for the Report Issue dialog.
 * This dialog is triggered from the sidebar, not a separate page.
 */
export class IssueReportDialog {
  readonly page: Page;

  // Dialog elements
  readonly dialog: Locator;
  readonly dialogTitle: Locator;
  readonly dialogDescription: Locator;

  // Trigger button (in sidebar)
  readonly reportIssueButton: Locator;

  // Form elements
  readonly descriptionTextarea: Locator;
  readonly contextInfo: Locator;

  // Actions
  readonly cancelButton: Locator;
  readonly submitButton: Locator;

  // Loading state
  readonly submittingSpinner: Locator;

  constructor(page: Page) {
    this.page = page;

    // The dialog itself
    this.dialog = page.locator('[role="dialog"]').filter({ hasText: /Report Issue|Report Crash/i });
    this.dialogTitle = this.dialog.locator('h2').or(this.dialog.getByRole('heading'));
    this.dialogDescription = this.dialog.locator('p').first();

    // Trigger button in sidebar
    this.reportIssueButton = page.getByRole('button', { name: /Report/i }).or(
      page.locator('button').filter({ has: page.locator('svg.lucide-bug') })
    );

    // Form
    this.descriptionTextarea = this.dialog.locator('textarea');
    this.contextInfo = this.dialog.locator('text=Additional context included').locator('..');

    // Buttons
    this.cancelButton = this.dialog.getByRole('button', { name: /Cancel/i });
    this.submitButton = this.dialog.getByRole('button', { name: /Submit Report/i });

    // Loading
    this.submittingSpinner = this.dialog.locator('text=Submitting');
  }

  async open() {
    await this.reportIssueButton.click();
    await expect(this.dialog).toBeVisible();
  }

  async close() {
    await this.cancelButton.click();
    await expect(this.dialog).not.toBeVisible();
  }

  async closeByEscape() {
    await this.page.keyboard.press('Escape');
    await this.page.waitForTimeout(300);
  }

  async setDescription(text: string) {
    await this.descriptionTextarea.fill(text);
  }

  async submit() {
    await this.submitButton.click();
    // Wait for submission to complete (dialog closes or spinner appears then disappears)
    await this.page.waitForTimeout(1000);
  }

  async isOpen(): Promise<boolean> {
    return this.dialog.isVisible();
  }

  async isSubmitting(): Promise<boolean> {
    return this.submittingSpinner.isVisible().catch(() => false);
  }
}
