import { expect, test } from "@playwright/test";

const sessionsHeadingPattern = /sessions|games/i;
const gameDetailUrlPattern = /\/games\/.+/;
const dateInfoPattern = /date|when/i;
const buyInPattern = /buy.?in/i;
const cashOutPattern = /cash.?out/i;

test.describe("Games", () => {
  test("should display games/sessions page", async ({ page }) => {
    await page.goto("/sessions");

    // Check for sessions-related content
    const heading = page.getByRole("heading", {
      name: sessionsHeadingPattern,
    });
    await expect(heading).toBeVisible();
  });

  test("game detail page should show game information", async ({ page }) => {
    // This test requires a game to exist - skip if no games
    await page.goto("/sessions");

    // Look for any game link
    const gameLink = page.locator("a[href^='/games/']").first();

    if (await gameLink.isVisible()) {
      await gameLink.click();

      // Should be on game detail page
      await expect(page).toHaveURL(gameDetailUrlPattern);

      // Check for game details
      const dateInfo = page.getByText(dateInfoPattern);
      await expect(dateInfo).toBeVisible();
    }
  });

  test("should show buy-in and cash-out options for active games", async ({
    page,
  }) => {
    // Navigate to an active session if one exists
    await page.goto("/sessions?status=ACTIVE");

    const gameLink = page.locator("a[href^='/games/']").first();

    if (await gameLink.isVisible()) {
      await gameLink.click();

      // Look for transaction buttons
      const buyInButton = page.getByRole("button", { name: buyInPattern });
      const cashOutButton = page.getByRole("button", { name: cashOutPattern });

      // At least one should be visible for active games
      const hasBuyIn = await buyInButton.isVisible();
      const hasCashOut = await cashOutButton.isVisible();

      expect(hasBuyIn || hasCashOut).toBeTruthy();
    }
  });
});
