import { expect, test } from "@playwright/test";

test.describe("Transactions", () => {
  test("should be able to view transaction history", async ({ page }) => {
    // Transactions are typically viewed within a game context
    await page.goto("/sessions");

    // Look for any completed session to view transactions
    await page.goto("/sessions?status=COMPLETED");

    const gameLink = page.locator("a[href^='/games/']").first();

    if (await gameLink.isVisible()) {
      await gameLink.click();

      // Should see transactions section
      const transactionsSection = page.getByText(/transactions|history/i);
      await expect(transactionsSection).toBeVisible();
    }
  });

  test("buy-in form should have amount field", async ({ page }) => {
    await page.goto("/sessions?status=ACTIVE");

    const gameLink = page.locator("a[href^='/games/']").first();

    if (await gameLink.isVisible()) {
      await gameLink.click();

      const buyInButton = page.getByRole("button", { name: /buy.?in/i });

      if (await buyInButton.isVisible()) {
        await buyInButton.click();

        // Check for amount input in the form/dialog
        const amountInput = page.getByLabel(/amount/i);
        await expect(amountInput).toBeVisible();
      }
    }
  });

  test("should validate transaction amount", async ({ page }) => {
    await page.goto("/sessions?status=ACTIVE");

    const gameLink = page.locator("a[href^='/games/']").first();

    if (await gameLink.isVisible()) {
      await gameLink.click();

      const buyInButton = page.getByRole("button", { name: /buy.?in/i });

      if (await buyInButton.isVisible()) {
        await buyInButton.click();

        // Try to submit without amount
        const submitButton = page.getByRole("button", {
          name: /add|submit|confirm/i,
        });
        await submitButton.click();

        // Should show validation error
        const error = page.getByText(/required|invalid|amount/i);
        await expect(error).toBeVisible();
      }
    }
  });
});
