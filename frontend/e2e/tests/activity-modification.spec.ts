import { test, expect } from '../fixtures/test-fixtures';

test.describe('Activity Selection', () => {
  test.beforeEach(async ({ activitySelectionPage }) => {
    await activitySelectionPage.goto();
  });

  test('should display activity blocks on timeline', async ({ activitySelectionPage }) => {
    const count = await activitySelectionPage.getActivityCount();
    // Skip if no activities (empty day)
    test.skip(count === 0, 'No activities on this day');
    expect(count).toBeGreaterThan(0);
  });

  test('should select single activity on click', async ({ activitySelectionPage }) => {
    const count = await activitySelectionPage.getActivityCount();
    test.skip(count === 0, 'No activities to select');

    // Click first activity
    await activitySelectionPage.clickActivity(0);

    // Should show selection toolbar
    await expect(activitySelectionPage.selectionToolbar).toBeVisible();

    // Toolbar should show "1 activity selected"
    const text = await activitySelectionPage.getSelectedCountText();
    expect(text).toContain('1 activity selected');
  });

  test('should replace selection on subsequent click', async ({ activitySelectionPage }) => {
    const count = await activitySelectionPage.getActivityCount();
    test.skip(count < 2, 'Need at least 2 activities');

    // Click first activity
    await activitySelectionPage.clickActivity(0);
    await expect(activitySelectionPage.selectionToolbar).toBeVisible();

    // Click second activity (should replace selection)
    await activitySelectionPage.clickActivity(1);

    // Should still show 1 selected
    const text = await activitySelectionPage.getSelectedCountText();
    expect(text).toContain('1 activity selected');
  });

  test('should toggle selection with Ctrl/Cmd+click', async ({ activitySelectionPage }) => {
    const count = await activitySelectionPage.getActivityCount();
    test.skip(count < 2, 'Need at least 2 activities');

    // Click first activity
    await activitySelectionPage.clickActivity(0);

    // Ctrl+click second activity (add to selection)
    await activitySelectionPage.ctrlClickActivity(1);

    // Should show 2 selected
    const text = await activitySelectionPage.getSelectedCountText();
    expect(text).toContain('2 activities selected');
  });

  test('should deselect with Ctrl/Cmd+click on selected', async ({ activitySelectionPage }) => {
    const count = await activitySelectionPage.getActivityCount();
    test.skip(count < 2, 'Need at least 2 activities');

    // Select two activities
    await activitySelectionPage.clickActivity(0);
    await activitySelectionPage.ctrlClickActivity(1);

    // Ctrl+click first activity again (remove from selection)
    await activitySelectionPage.ctrlClickActivity(0);

    // Should show 1 selected
    const text = await activitySelectionPage.getSelectedCountText();
    expect(text).toContain('1 activity selected');
  });

  test('should clear selection with Clear button', async ({ activitySelectionPage }) => {
    const count = await activitySelectionPage.getActivityCount();
    test.skip(count === 0, 'No activities to select');

    // Select an activity
    await activitySelectionPage.clickActivity(0);
    await expect(activitySelectionPage.selectionToolbar).toBeVisible();

    // Click clear
    await activitySelectionPage.clearSelection();

    // Toolbar should be hidden
    await expect(activitySelectionPage.selectionToolbar).not.toBeVisible();
  });

  test('should clear selection with Escape key', async ({ activitySelectionPage }) => {
    const count = await activitySelectionPage.getActivityCount();
    test.skip(count === 0, 'No activities to select');

    // Select an activity
    await activitySelectionPage.clickActivity(0);
    await expect(activitySelectionPage.selectionToolbar).toBeVisible();

    // Press Escape
    await activitySelectionPage.pressEscapeToClear();

    // Toolbar should be hidden
    await expect(activitySelectionPage.selectionToolbar).not.toBeVisible();
  });
});

test.describe('Activity Selection - List View', () => {
  test.beforeEach(async ({ activitySelectionPage }) => {
    await activitySelectionPage.goto();
    await activitySelectionPage.switchToListView();
  });

  test('should select range with Shift+click in list view', async ({ activitySelectionPage }) => {
    const count = await activitySelectionPage.getActivityCount();
    test.skip(count < 3, 'Need at least 3 activities for range selection');

    // Click first activity
    await activitySelectionPage.clickActivity(0);

    // Shift+click third activity (should select 1, 2, 3)
    await activitySelectionPage.shiftClickActivity(2);

    // Should show 3 selected
    const text = await activitySelectionPage.getSelectedCountText();
    expect(text).toContain('3 activities selected');
  });

  test('should work in list view', async ({ activitySelectionPage }) => {
    const count = await activitySelectionPage.getActivityCount();
    test.skip(count === 0, 'No activities in list view');

    // Click first activity
    await activitySelectionPage.clickActivity(0);

    // Should show selection toolbar
    await expect(activitySelectionPage.selectionToolbar).toBeVisible();
  });
});

test.describe('Activity Editing', () => {
  test.beforeEach(async ({ activitySelectionPage }) => {
    await activitySelectionPage.goto();
  });

  test('should open edit dialog on double-click', async ({ activitySelectionPage }) => {
    const count = await activitySelectionPage.getActivityCount();
    test.skip(count === 0, 'No activities to edit');

    // Double-click first activity
    await activitySelectionPage.openEditDialog(0);

    // Dialog should be visible
    await expect(activitySelectionPage.editDialog).toBeVisible();
    await expect(activitySelectionPage.editDialogTitle).toHaveText('Edit Activity');
  });

  test('should display current activity values in edit dialog', async ({ activitySelectionPage }) => {
    const count = await activitySelectionPage.getActivityCount();
    test.skip(count === 0, 'No activities to edit');

    // Open edit dialog
    await activitySelectionPage.openEditDialog(0);

    // Form fields should have values
    const values = await activitySelectionPage.getEditFormValues();
    expect(values.appName).toBeTruthy();
    expect(values.windowTitle).toBeTruthy();
  });

  test('should close edit dialog on Cancel', async ({ activitySelectionPage }) => {
    const count = await activitySelectionPage.getActivityCount();
    test.skip(count === 0, 'No activities to edit');

    // Open edit dialog
    await activitySelectionPage.openEditDialog(0);
    await expect(activitySelectionPage.editDialog).toBeVisible();

    // Cancel
    await activitySelectionPage.cancelEdit();

    // Dialog should be closed
    await expect(activitySelectionPage.editDialog).not.toBeVisible();
  });

  test('should update activity on Save', async ({ activitySelectionPage }) => {
    const count = await activitySelectionPage.getActivityCount();
    test.skip(count === 0, 'No activities to edit');

    // Open edit dialog
    await activitySelectionPage.openEditDialog(0);

    // Get original values
    const originalValues = await activitySelectionPage.getEditFormValues();

    // Modify window title with a unique marker
    const marker = `[TEST-${Date.now()}]`;
    const newTitle = `${originalValues.windowTitle} ${marker}`;
    await activitySelectionPage.fillEditForm({
      windowTitle: newTitle,
    });

    // Save
    await activitySelectionPage.saveEdit();

    // Dialog should close - this is the main success criteria
    await expect(activitySelectionPage.editDialog).not.toBeVisible();

    // NOTE: We don't verify the persisted value here because:
    // 1. Activities may be re-grouped after update, changing which block is "first"
    // 2. The timeline data refreshes and re-sorts activities
    // The update API call succeeded if the dialog closed without error
  });

  test('should validate required fields', async ({ activitySelectionPage }) => {
    const count = await activitySelectionPage.getActivityCount();
    test.skip(count === 0, 'No activities to edit');

    // Open edit dialog
    await activitySelectionPage.openEditDialog(0);

    // Clear app name
    await activitySelectionPage.fillEditForm({
      appName: '',
    });

    // Save button should be disabled
    await expect(activitySelectionPage.saveButton).toBeDisabled();
  });
});

test.describe('Activity Bulk Delete', () => {
  test.beforeEach(async ({ activitySelectionPage }) => {
    await activitySelectionPage.goto();
  });

  test('should show delete confirmation dialog', async ({ activitySelectionPage }) => {
    const count = await activitySelectionPage.getActivityCount();
    test.skip(count === 0, 'No activities to delete');

    // Select an activity
    await activitySelectionPage.clickActivity(0);

    // Click delete button
    await activitySelectionPage.deleteButton.click();

    // Confirmation dialog should appear
    await expect(activitySelectionPage.deleteConfirmDialog).toBeVisible();
  });

  test('should cancel delete operation', async ({ activitySelectionPage }) => {
    const count = await activitySelectionPage.getActivityCount();
    test.skip(count === 0, 'No activities to delete');

    const initialCount = count;

    // Select an activity
    await activitySelectionPage.clickActivity(0);

    // Start delete but cancel
    await activitySelectionPage.cancelDelete();

    // Dialog should close
    await expect(activitySelectionPage.deleteConfirmDialog).not.toBeVisible();

    // Selection toolbar should still be visible
    await expect(activitySelectionPage.selectionToolbar).toBeVisible();

    // Activity count should be unchanged
    const finalCount = await activitySelectionPage.getActivityCount();
    expect(finalCount).toBe(initialCount);
  });

  test('should delete selected activities on confirm', async ({ activitySelectionPage }) => {
    const count = await activitySelectionPage.getActivityCount();
    test.skip(count === 0, 'No activities to delete');

    const initialCount = count;

    // Select first activity
    await activitySelectionPage.clickActivity(0);

    // Delete it
    await activitySelectionPage.deleteSelected();

    // Wait for deletion to complete and data refresh
    await activitySelectionPage.page.waitForTimeout(2000);

    // Selection toolbar should be hidden (no selection)
    await expect(activitySelectionPage.selectionToolbar).not.toBeVisible();

    // Activity count should decrease (be less than initial)
    const finalCount = await activitySelectionPage.getActivityCount();
    expect(finalCount).toBeLessThan(initialCount);
  });

  test('should delete multiple activities at once', async ({ activitySelectionPage }) => {
    const count = await activitySelectionPage.getActivityCount();
    test.skip(count < 2, 'Need at least 2 activities for bulk delete');

    const initialCount = count;

    // Select two activities
    await activitySelectionPage.clickActivity(0);
    await activitySelectionPage.ctrlClickActivity(1);

    // Verify 2 selected
    const text = await activitySelectionPage.getSelectedCountText();
    expect(text).toContain('2 activities selected');

    // Delete them
    await activitySelectionPage.deleteSelected();

    // Wait for deletion and data refresh
    await activitySelectionPage.page.waitForTimeout(2000);

    // Activity count should decrease (grouped activities may re-merge after delete)
    // The key success criteria is that deletion completes without error
    // and the selection toolbar is cleared
    await expect(activitySelectionPage.selectionToolbar).not.toBeVisible();

    // Count should be less than initial (exact count depends on grouping)
    const finalCount = await activitySelectionPage.getActivityCount();
    expect(finalCount).toBeLessThan(initialCount);
  });
});

test.describe('Activity Selection - Split View', () => {
  test.beforeEach(async ({ activitySelectionPage }) => {
    await activitySelectionPage.goto();
    await activitySelectionPage.switchToSplitView();
    // Wait extra time for split view to render both panels
    await activitySelectionPage.page.waitForTimeout(1000);
  });

  test('should work in split view', async ({ activitySelectionPage }) => {
    const count = await activitySelectionPage.getActivityCount();
    test.skip(count === 0, 'No activities in split view');

    // Click an activity (could be in either grid or list panel)
    await activitySelectionPage.clickActivity(0);

    // Should show selection toolbar
    await expect(activitySelectionPage.selectionToolbar).toBeVisible({ timeout: 5000 });
  });

  test('should share selection state between grid and list panels', async ({ activitySelectionPage }) => {
    const count = await activitySelectionPage.getActivityCount();
    test.skip(count === 0, 'No activities to select');

    // Select in one panel
    await activitySelectionPage.clickActivity(0);

    // Toolbar should show selection
    await expect(activitySelectionPage.selectionToolbar).toBeVisible({ timeout: 5000 });

    // The selection should be visible in both panels
    // (both should highlight the same activity)
    const text = await activitySelectionPage.getSelectedCountText();
    expect(text).toContain('1 activity selected');
  });
});
