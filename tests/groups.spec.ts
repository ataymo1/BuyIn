import { expect, test } from "@playwright/test";

test.describe("Groups", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to groups page (requires authentication)
    await page.goto("/groups");
  });

  test("should display groups page", async ({ page }) => {
    // Check for groups-related content
    const heading = page.getByRole("heading", { name: /groups|your groups/i });
    await expect(heading).toBeVisible();
  });

  test("should have create group button", async ({ page }) => {
    const createButton = page.getByRole("link", { name: /create|new group/i });
    await expect(createButton).toBeVisible();
  });

  test("create group form should be accessible", async ({ page }) => {
    // Navigate to create group page
    await page.goto("/groups/new");

    // Check for form elements
    const nameInput = page.getByLabel(/name/i);
    await expect(nameInput).toBeVisible();

    const submitButton = page.getByRole("button", { name: /create|submit/i });
    await expect(submitButton).toBeVisible();
  });

  test("should validate group name is required", async ({ page }) => {
    await page.goto("/groups/new");

    // Try to submit empty form
    const submitButton = page.getByRole("button", { name: /create|submit/i });
    await submitButton.click();

    // Check for validation error
    const errorMessage = page.getByText(/required|name is required/i);
    await expect(errorMessage).toBeVisible();
  });
});
