import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { defineConfig } from "@playwright/test";
import { localPorts } from "./packages/shared/src/index.js";

const envFile = new URL(".env", import.meta.url);
if (existsSync(envFile)) loadEnvFile(envFile);

const webPort = process.env.WEB_PORT ?? localPorts.web;
const gamePort = process.env.GAME_PORT ?? localPorts.game;
const webUrl = `http://localhost:${webPort}`;
const channel = process.env.PLAYWRIGHT_CHANNEL;

export default defineConfig({
  testDir: "./tests/browser",
  use: { baseURL: webUrl, ...(channel ? { channel } : {}) },
  webServer: [
    {
      command: "pnpm --filter @obsidian/web dev",
      url: webUrl,
      reuseExistingServer: false,
    },
    {
      command:
        "pnpm --filter @obsidian/game-server exec tsx --conditions=development src/index.ts",
      port: Number(gamePort),
      reuseExistingServer: false,
    },
  ],
});
