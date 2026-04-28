import { expect, test } from "@playwright/test";

const googleSignInPattern = /google|sign in with google/i;
const loginUrlPattern = /login/;
const welcomeHeadingPattern = /welcome to buyin/i;

test.describe("Authentication", () => {
  test("should show login page", async ({ page }) => {
    await page.goto("/login");

    await expect(
      page.getByRole("heading", { name: welcomeHeadingPattern })
    ).toBeVisible();
  });

  test("login page should have Google sign-in option", async ({ page }) => {
    await page.goto("/login");

    // Look for Google sign-in button
    const googleButton = page.getByRole("button", {
      name: googleSignInPattern,
    });
    await expect(googleButton).toBeVisible();
  });

  test("should redirect to login when accessing protected routes", async ({
    page,
  }) => {
    test.skip(
      process.env.E2E_AUTH_BYPASS === "1",
      "E2E_AUTH_BYPASS intentionally lets protected-route tests render locally."
    );

    // Try to access a protected route
    await page.goto("/groups");

    // Should be redirected to login
    await expect(page).toHaveURL(loginUrlPattern);
  });
});
