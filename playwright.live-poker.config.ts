import { defineConfig } from "@playwright/test";

export default defineConfig({
  fullyParallel: false,
  reporter: "list",
  testDir: "./tests",
  testMatch: "live-poker-engine.spec.ts",
  workers: 1,
});
