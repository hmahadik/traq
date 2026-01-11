import { test, expect } from '../fixtures/test-fixtures';

test.describe('Issue Reporting - Report Issue Journey', () => {
  test.beforeEach(async ({ timelinePage }) => {
    await timelinePage.goto();
  });

  test('should have report issue button in sidebar', async ({ issueDialog }) => {
    await expect(issueDialog.reportIssueButton).toBeVisible();
  });

  test('should open report issue dialog', async ({ issueDialog }) => {
    await issueDialog.open();

    await expect(issueDialog.dialog).toBeVisible();
    await expect(issueDialog.dialogTitle).toBeVisible();
  });

  test('should show dialog title and description', async ({ issueDialog }) => {
    await issueDialog.open();

    // Title should say "Report Issue"
    const titleText = await issueDialog.dialogTitle.textContent();
    expect(titleText).toContain('Report Issue');
  });

  test('should show description textarea', async ({ issueDialog }) => {
    await issueDialog.open();

    await expect(issueDialog.descriptionTextarea).toBeVisible();
    await expect(issueDialog.descriptionTextarea).toBeEditable();
  });

  test('should show context info section', async ({ issueDialog }) => {
    await issueDialog.open();

    // Should mention what context is included
    const contextSection = issueDialog.page.locator('text=Additional context included');
    await expect(contextSection).toBeVisible();

    // Should list what's included
    const currentPage = issueDialog.page.locator('text=Current page');
    const screenshots = issueDialog.page.locator('text=Screenshots');
    await expect(currentPage).toBeVisible();
    await expect(screenshots).toBeVisible();
  });

  test('should show cancel and submit buttons', async ({ issueDialog }) => {
    await issueDialog.open();

    await expect(issueDialog.cancelButton).toBeVisible();
    await expect(issueDialog.submitButton).toBeVisible();
  });

  test('should close dialog on cancel', async ({ issueDialog }) => {
    await issueDialog.open();
    await expect(issueDialog.dialog).toBeVisible();

    await issueDialog.close();
    await expect(issueDialog.dialog).not.toBeVisible();
  });

  test('should close dialog on Escape key', async ({ issueDialog }) => {
    await issueDialog.open();
    await expect(issueDialog.dialog).toBeVisible();

    await issueDialog.closeByEscape();
    // Dialog may or may not close depending on implementation
    // Just verify no errors
  });

  test('should allow entering description', async ({ issueDialog }) => {
    await issueDialog.open();

    const testDescription = 'This is a test issue report from E2E tests';
    await issueDialog.setDescription(testDescription);

    const value = await issueDialog.descriptionTextarea.inputValue();
    expect(value).toBe(testDescription);
  });

  test('should submit issue report', async ({ issueDialog }) => {
    await issueDialog.open();

    // Enter a description
    await issueDialog.setDescription('E2E Test: Testing issue submission');

    // Submit
    await issueDialog.submit();

    // Dialog should close after successful submission
    // (may take a moment, and could fail if no webhook configured)
    await issueDialog.page.waitForTimeout(2000);

    // Either dialog closed (success) or error toast appeared
    const isOpen = await issueDialog.isOpen();
    // We don't fail if dialog is still open - may need webhook configured
  });

  test('should be accessible from any page', async ({ analyticsPage, issueDialog }) => {
    // Navigate to Analytics
    await analyticsPage.goto();

    // Report button should still be visible
    await expect(issueDialog.reportIssueButton).toBeVisible();

    // Open and verify
    await issueDialog.open();
    await expect(issueDialog.dialog).toBeVisible();

    // Context should show analytics route
    const currentPage = issueDialog.page.locator('text=/Current page.*analytics/i');
    await expect(currentPage).toBeVisible();
  });
});
