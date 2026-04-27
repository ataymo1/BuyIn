import { expect, test } from "@playwright/test";

const groupsHeadingPattern = /groups|your groups/i;
const createGroupLinkPattern = /create|new group/i;
const nameFieldPattern = /name/i;
const submitGroupPattern = /create|submit/i;
const groupNameRequiredPattern = /required|name is required/i;

test.describe("Groups", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to groups page (requires authentication)
    await page.goto("/groups");
  });

  test("should display groups page", async ({ page }) => {
    // Check for groups-related content
    const heading = page.getByRole("heading", { name: groupsHeadingPattern });
    await expect(heading).toBeVisible();
  });

  test("should have create group button", async ({ page }) => {
    const createButton = page.getByRole("link", {
      name: createGroupLinkPattern,
    });
    await expect(createButton).toBeVisible();
  });

  test("create group form should be accessible", async ({ page }) => {
    // Navigate to create group page
    await page.goto("/groups/new");

    // Check for form elements
    const nameInput = page.getByLabel(nameFieldPattern);
    await expect(nameInput).toBeVisible();

    const submitButton = page.getByRole("button", {
      name: submitGroupPattern,
    });
    await expect(submitButton).toBeVisible();
  });

  test("should validate group name is required", async ({ page }) => {
    await page.goto("/groups/new");

    // Try to submit empty form
    const submitButton = page.getByRole("button", {
      name: submitGroupPattern,
    });
    await submitButton.click();

    // Check for validation error
    const errorMessage = page.getByText(groupNameRequiredPattern);
    await expect(errorMessage).toBeVisible();
  });
});
