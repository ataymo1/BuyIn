import { expect, test } from "@playwright/test";

const loginLinkPattern = /sign in|login|get started/i;
const googleSignInPattern = /google|sign in with google/i;
const loginUrlPattern = /login/;

test.describe("Authentication", () => {
  test("should show login page for unauthenticated users", async ({ page }) => {
    await page.goto("/");

    // Check for login-related elements
    const loginButton = page.getByRole("link", {
      name: loginLinkPattern,
    });
    await expect(loginButton).toBeVisible();
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
    // Try to access a protected route
    await page.goto("/groups");

    // Should be redirected to login
    await expect(page).toHaveURL(loginUrlPattern);
  });
});
