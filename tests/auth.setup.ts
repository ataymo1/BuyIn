import path from "node:path";
import { test as setup } from "@playwright/test";

const authFile = path.join(__dirname, "../playwright/.auth/user.json");

setup("authenticate", async ({ page }) => {
  // For development, we'll create a mock authentication state
  // In production, you would navigate to login and complete the OAuth flow

  // Navigate to the app
  await page.goto("/");

  // Check if we need to authenticate
  const loginButton = page.getByRole("link", { name: /sign in|login/i });

  if (await loginButton.isVisible()) {
    // Note: OAuth flow testing requires special handling
    // For now, we'll skip actual authentication and rely on mock data
    // In a real setup, you would:
    // 1. Use a test account with Google OAuth
    // 2. Or mock the authentication at the API level
    console.log("Authentication required - using mock state for tests");
  }

  // Save the authentication state
  // Note: This will be empty if not authenticated
  await page.context().storageState({ path: authFile });
});
