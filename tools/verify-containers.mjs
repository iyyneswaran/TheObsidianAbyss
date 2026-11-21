import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { chromium } from "@playwright/test";
const port = process.env.CONTAINER_TEST_PORT || "18087";
const origin = "http://127.0.0.1:" + port;
const env = {
  ...process.env,
  WEB_ORIGIN: origin,
  WEB_PORT: port,
  POSTGRES_PASSWORD: randomBytes(24).toString("hex"),
  GUEST_SESSION_SECRET: randomBytes(32).toString("hex"),
};
// A prebuilt smoke project can be reused while iterating on an individual image.
const cached = process.env.CONTAINER_TEST_IMAGES;
if (cached && !/^obsidian-smoke-[0-9a-f]{10}$/.test(cached))
  throw Error("Invalid smoke image namespace.");
const project = "obsidian-smoke-" + randomBytes(5).toString("hex");
function compose(...args) {
  const child = spawnSync(
    "docker",
    ["compose", "-p", project, "-f", "compose.production.yaml", ...args],
    { env, stdio: "inherit", windowsHide: true },
  );
  if (child.status !== 0) throw Error("Container command failed: " + args[0]);
}
try {
  if (cached)
    for (const service of ["migrate", "api", "game", "web"]) {
      const tag = spawnSync(
        "docker",
        ["tag", cached + "-" + service, project + "-" + service],
        { stdio: "inherit" },
      );
      if (tag.status !== 0) throw Error("Unable to reuse smoke image.");
    }
  compose(
    "up",
    cached ? "--no-build" : "--build",
    "--wait",
    "--wait-timeout",
    "240",
  );
  const response = await fetch(origin + "/api/health/database");
  if (!response.ok) throw Error("API readiness failed");
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(origin + "/party");
    await page.getByLabel("Your wizard").selectOption("defense");
    await page
      .getByRole("button", { name: "Create Team", exact: true })
      .click();
    await page.getByRole("button", { name: "Start Dungeon" }).click();
    await page.getByRole("button", { name: "Enter Dungeon" }).click();
    await page
      .locator("[data-testid=online-stage][data-ready=true]")
      .waitFor({ timeout: 40000 });
    await page.getByTestId("online-stage").locator("canvas").click();
    await page.keyboard.press("q");
    await page.waitForFunction(() => {
      const e = globalThis.document.querySelector('[data-testid="local-mp"]');
      return (
        e &&
        Number(e.getAttribute("data-value")) <
          Number(e.getAttribute("data-max"))
      );
    });
    console.log(
      "Container smoke passed: history route, database, signed guest, private room, WebSocket and authoritative cast.",
    );
  } finally {
    await browser.close();
  }
} finally {
  compose("down", "--volumes", "--remove-orphans", "--rmi", "local");
}
