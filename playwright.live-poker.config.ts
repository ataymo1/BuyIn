import { defineConfig } from "@playwright/test";

export default defineConfig({
  fullyParallel: false,
  reporter: "list",
  testDir: "./tests",
  testMatch: [
    "live-poker-engine.spec.ts",
    "live-poker-resilience.spec.ts",
    "live-poker-safety.spec.ts",
  ],
  workers: 1,
});
