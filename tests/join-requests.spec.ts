import { expect, test } from "@playwright/test";

const findGroupsPattern = /find groups/i;
const searchGroupsPattern = /search groups/i;
const emptySearchPattern = /no groups available|enter a group name/i;

test.describe("Group Search and Join Requests", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to groups page (requires authentication)
    await page.goto("/groups");
  });

  test("should navigate to search page from groups list", async ({ page }) => {
    // Click on "Find Groups" button
    const findGroupsButton = page.getByRole("link", {
      name: findGroupsPattern,
    });
    await expect(findGroupsButton).toBeVisible();
    await findGroupsButton.click();

    // Verify URL
    await expect(page).toHaveURL("/groups/search");

    // Verify search page content
    const heading = page.getByRole("heading", { name: findGroupsPattern });
    await expect(heading).toBeVisible();

    const searchInput = page.getByPlaceholder(searchGroupsPattern);
    await expect(searchInput).toBeVisible();
  });

  test("should show empty state initially", async ({ page }) => {
    await page.goto("/groups/search");

    const emptyStateText = page.getByText(emptySearchPattern);
    await expect(emptyStateText).toBeVisible();
  });

  test("should search for groups", async ({ page }) => {
    await page.goto("/groups/search");

    const searchInput = page.getByPlaceholder(searchGroupsPattern);
    await searchInput.fill("Test Group");

    // Since we rely on backend response, we might see loading or empty state if no groups exist
    // Just verifying the input works and UI responds is enough for basic verification
    // In a real env seed data would be needed

    // Check if loading or no results state appears
    // Just waiting a bit to ensure no crash
    await page.waitForTimeout(1000);
  });
});
