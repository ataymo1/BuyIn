import { expect, test } from "@playwright/test";

const transactionSectionPattern = /transactions|history/i;
const buyInPattern = /buy.?in/i;
const amountPattern = /amount/i;
const submitTransactionPattern = /add|submit|confirm/i;
const transactionErrorPattern = /required|invalid|amount/i;
const newGameHref = "/games/new";

test.describe("Transactions", () => {
  test("should be able to view transaction history", async ({ page }) => {
    // Transactions are typically viewed within a game context
    await page.goto("/sessions");

    // Look for any completed session to view transactions
    await page.goto("/sessions?status=COMPLETED");

    const gameLink = page
      .locator(`a[href^="/games/"]:not([href="${newGameHref}"])`)
      .first();

    if (await gameLink.isVisible()) {
      await gameLink.click();

      // Should see transactions section
      const transactionsSection = page.getByText(transactionSectionPattern);
      await expect(transactionsSection).toBeVisible();
    }
  });

  test("buy-in form should have amount field", async ({ page }) => {
    await page.goto("/sessions?status=ACTIVE");

    const gameLink = page
      .locator(`a[href^="/games/"]:not([href="${newGameHref}"])`)
      .first();

    if (await gameLink.isVisible()) {
      await gameLink.click();

      const buyInButton = page.getByRole("button", { name: buyInPattern });

      if (await buyInButton.isVisible()) {
        await buyInButton.click();

        // Check for amount input in the form/dialog
        const amountInput = page.getByLabel(amountPattern);
        await expect(amountInput).toBeVisible();
      }
    }
  });

  test("should validate transaction amount", async ({ page }) => {
    await page.goto("/sessions?status=ACTIVE");

    const gameLink = page
      .locator(`a[href^="/games/"]:not([href="${newGameHref}"])`)
      .first();

    if (await gameLink.isVisible()) {
      await gameLink.click();

      const buyInButton = page.getByRole("button", { name: buyInPattern });

      if (await buyInButton.isVisible()) {
        await buyInButton.click();

        // Try to submit without amount
        const submitButton = page.getByRole("button", {
          name: submitTransactionPattern,
        });
        await submitButton.click();

        // Should show validation error
        const error = page.getByText(transactionErrorPattern);
        await expect(error).toBeVisible();
      }
    }
  });
});
