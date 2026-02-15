// tests/e2e/admin-id-verification.spec.ts
// E2E test for admin ID verification workflow

import { test, expect } from "@playwright/test";

test.describe("Admin ID Verification Workflow", () => {
  test("admin can review and approve ID verification", async ({ page }) => {
    // Step 1: Admin logs in
    await page.goto("/login");
    await page.fill('[name="email"]', "admin@example.com");
    await page.fill('[name="password"]', "password123");
    await page.click('button[type="submit"]');

    // Wait for dashboard to load
    await expect(page).toHaveURL(/\/admin/);

    // Step 2: Navigate to ID verifications
    await page.click("text=ID Verifications");
    await expect(page).toHaveURL(/\/admin\/id-verifications/);

    // Step 3: Verify verifications list is visible
    await expect(page.locator("text=ID Verifications")).toBeVisible();

    // Step 4: Click "Review" on first verification
    const reviewButton = page.locator('button:has-text("Review")').first();
    if (await reviewButton.isVisible()) {
      await reviewButton.click();

      // Step 5: Verify document preview modal opens
      await expect(page.locator("text=Document Preview")).toBeVisible();

      // Step 6: Click "Approve"
      await page.click('button:has-text("Approve")');

      // Step 7: Verify success message
      await expect(page.locator("text=Verification approved")).toBeVisible();
    }
  });

  test("admin can filter verifications by status", async ({ page }) => {
    await page.goto("/admin/id-verifications");

    // Filter by pending
    await page.selectOption('select[name="status"]', "pending");
    await expect(page).toHaveURL(/status=pending/);

    // Verify only pending verifications shown
    const statusBadges = page.locator('[data-status="pending"]');
    const count = await statusBadges.count();
    expect(count).toBeGreaterThan(0);
  });

  test("admin can search verifications", async ({ page }) => {
    await page.goto("/admin/id-verifications");

    // Search for cleaner name
    await page.fill('input[placeholder*="Search"]', "John");
    await page.press('input[placeholder*="Search"]', "Enter");

    // Verify results filtered
    await expect(page.locator("text=John")).toBeVisible();
  });
});
