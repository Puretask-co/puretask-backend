// tests/e2e/recurring-booking.spec.ts
// E2E test for client recurring booking flow

import { test, expect } from "@playwright/test";

test.describe("Client Recurring Booking Flow", () => {
  test("client can create and manage recurring booking", async ({ page }) => {
    // Step 1: Client logs in
    await page.goto("/login");
    await page.fill('[name="email"]', "client@example.com");
    await page.fill('[name="password"]', "password123");
    await page.click('button[type="submit"]');

    // Wait for dashboard
    await expect(page).toHaveURL(/\/client\/dashboard/);

    // Step 2: Navigate to create booking
    await page.click("text=New Booking");
    await expect(page).toHaveURL(/\/client\/bookings\/new/);

    // Step 3: Fill booking form
    await page.fill('[name="address"]', "123 Main St");
    await page.fill('[name="scheduledStartAt"]', "2024-01-15T10:00");
    await page.fill('[name="scheduledEndAt"]', "2024-01-15T14:00");

    // Step 4: Enable recurring
    await page.check('input[name="isRecurring"]');

    // Step 5: Set recurrence frequency
    await page.selectOption('select[name="recurrenceFrequency"]', "weekly");
    await page.fill('input[name="recurrenceEndDate"]', "2024-03-15");

    // Step 6: Submit booking
    await page.click('button[type="submit"]');

    // Step 7: Verify booking created
    await expect(page.locator("text=Recurring booking created")).toBeVisible();

    // Step 8: Verify first job created
    await page.goto("/client/dashboard");
    await expect(page.locator("text=Upcoming Bookings")).toBeVisible();

    // Step 9: Navigate to recurring bookings
    await page.click("text=Recurring Bookings");
    await expect(page).toHaveURL(/\/client\/bookings\/recurring/);

    // Step 10: Verify recurring schedule visible
    await expect(page.locator("text=Weekly")).toBeVisible();

    // Step 11: Cancel recurring booking
    await page.click('button:has-text("Cancel Recurring")');
    await page.click('button:has-text("Confirm")');

    // Step 12: Verify cancellation confirmed
    await expect(page.locator("text=Recurring booking cancelled")).toBeVisible();
  });
});
