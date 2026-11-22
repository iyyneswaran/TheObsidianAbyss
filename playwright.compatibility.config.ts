import { defineConfig, type PlaywrightTestConfig } from "@playwright/test";
import base from "./playwright.config.js";

const browser = process.env.M8_BROWSER;
const projects: NonNullable<PlaywrightTestConfig["projects"]> = [
  { name: "chrome", use: { channel: "chrome" } },
  { name: "edge", testIgnore: /network\.spec\.ts/, use: { channel: "msedge" } },
  {
    name: "firefox",
    testIgnore: /network\.spec\.ts/,
    use: { browserName: "firefox" },
  },
  {
    name: "webkit",
    testIgnore: /network\.spec\.ts/,
    use: { browserName: "webkit" },
  },
];
const use = { ...base.use };
delete use.channel;
const network = process.env.M8_VERIFY === "network";
const soak = process.env.M8_VERIFY === "soak";
const servers = base.webServer;
if (network && Array.isArray(servers)) {
  servers[0]!.env = {
    ...servers[0]!.env,
    VITE_GAME_SERVER_URL: "ws://localhost:" + process.env.M8_PROXY_PORT,
  };
}
export default defineConfig(base, {
  testDir: "./tests/compatibility",
  outputDir: "test-results/milestone-8",
  use,
  testMatch: network
    ? "**/network.spec.ts"
    : soak
      ? "**/soak.spec.ts"
      : "**/release.spec.ts",
  projects: projects.filter(({ name }) =>
    network || soak ? name === "chrome" : !browser || name === browser,
  ),
});
