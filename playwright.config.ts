import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { defineConfig } from "@playwright/test";
import { localPorts } from "./packages/shared/src/index.js";

const envFile = new URL(".env", import.meta.url);
if (existsSync(envFile)) loadEnvFile(envFile);

const webPort = process.env.WEB_PORT ?? localPorts.web;
const gamePort = process.env.GAME_PORT ?? localPorts.game;
const apiPort = process.env.API_PORT ?? localPorts.api;
process.env.COMBAT_FIXTURE_PORT ??= String(Number(apiPort) + 1000);
process.env.COMBAT_FIXTURE_KEY ??= randomBytes(32).toString("hex");
const webUrl = `http://localhost:${webPort}`;
const apiUrl = `http://localhost:${apiPort}`;
const coopEnv = {
  GUEST_SESSION_SECRET: randomBytes(32).toString("hex"),
  WEB_ORIGIN: webUrl,
};
const channel = process.env.PLAYWRIGHT_CHANNEL;

export default defineConfig({
  testDir: "./tests/browser",
  // Each co-op scenario already runs up to four independent WebGL contexts.
  workers: 1,
  use: { baseURL: webUrl, ...(channel ? { channel } : {}) },
  webServer: [
    {
      command: "pnpm --filter @obsidian/web dev",
      env: {
        VITE_API_URL: apiUrl,
        VITE_GAME_SERVER_URL: `ws://localhost:${gamePort}`,
      },
      url: webUrl,
      reuseExistingServer: false,
    },
    {
      command:
        "pnpm --filter @obsidian/game-server exec tsx --conditions=development tests/combatHarness.ts",
      port: Number(gamePort),
      env: {
        ...coopEnv,
        NODE_ENV: "test",
        COMBAT_FIXTURE_PORT: process.env.COMBAT_FIXTURE_PORT,
        COMBAT_FIXTURE_KEY: process.env.COMBAT_FIXTURE_KEY,
      },
      reuseExistingServer: false,
    },
    {
      command:
        "pnpm --filter @obsidian/api exec tsx --conditions=development src/index.ts",
      url: `${apiUrl}/health`,
      env: coopEnv,
      reuseExistingServer: false,
    },
  ],
});
