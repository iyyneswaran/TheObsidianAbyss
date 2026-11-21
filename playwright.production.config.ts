import { defineConfig } from "@playwright/test";
import { isolatedTestDatabase } from "./tests/fixtures/progression.js";

const database = isolatedTestDatabase();
if (!database || !process.env.M5_SMOKE_USER || !process.env.M5_SMOKE_PASSWORD)
  throw new Error(
    "Run pnpm verify:progression to prepare the release verification account.",
  );
const webPort = Number(process.env.WEB_PORT);
const gamePort = Number(process.env.GAME_PORT);
const apiPort = Number(process.env.API_PORT);
const baseURL = "http://localhost:" + webPort;
const env = {
  DATABASE_URL: database,
  NODE_ENV: "production",
  WEB_ORIGIN: baseURL,
};
export default defineConfig({
  testDir: "./tests/production",
  workers: 1,
  use: {
    baseURL,
    trace: process.env.CI ? "retain-on-failure" : "off",
    screenshot: "only-on-failure",
    viewport: { width: 1380, height: 980 },
  },
  webServer: [
    {
      command:
        "pnpm --filter @obsidian/web exec vite preview --host 127.0.0.1 --strictPort --port " +
        webPort,
      url: baseURL,
      reuseExistingServer: false,
    },
    {
      command: "node apps/api/dist/index.js",
      env,
      url: "http://localhost:" + apiPort + "/health/database",
      reuseExistingServer: false,
    },
    {
      command: "node apps/game-server/dist/index.js",
      env,
      port: gamePort,
      reuseExistingServer: false,
    },
  ],
});
