import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
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
  const shell = await fetch(origin + "/party");
  if (
    !shell.ok ||
    shell.headers.get("x-content-type-options") !== "nosniff" ||
    shell.headers.get("x-frame-options") !== "DENY" ||
    !shell.headers
      .get("content-security-policy")
      ?.includes("form-action 'self'") ||
    (await fetch(new URL("/.env", origin))).status !== 404
  )
    throw Error("Production proxy headers or dotfile routing failed.");
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
    if (process.env.M8_CONTAINER_EVIDENCE === "1") {
      const imageIds = {};
      for (const service of ["migrate", "api", "game", "web"]) {
        const image = spawnSync(
          "docker",
          ["image", "inspect", "--format", "{{.Id}}", project + "-" + service],
          { encoding: "utf8", windowsHide: true },
        );
        if (
          image.status !== 0 ||
          !/^sha256:[a-f0-9]{64}$/.test(image.stdout.trim())
        )
          throw Error(
            "Could not verify the built image identifier for " + service,
          );
        imageIds[service] = image.stdout.trim();
      }
      const folder = "artifacts/milestone-8";
      await mkdir(folder, { recursive: true });
      await writeFile(
        folder + "/containers.json",
        JSON.stringify(
          {
            status: "PASS",
            at: new Date().toISOString(),
            browser: browser.version(),
            postgresImage: env.POSTGRES_IMAGE ?? "postgres:17-alpine",
            imageIds,
            checks: [
              "history route",
              "database readiness",
              "guest identity",
              "private room",
              "WebSocket upgrade",
              "authoritative cast",
            ],
          },
          null,
          2,
        ) + "\n",
      );
    }
  } finally {
    await browser.close();
  }
} finally {
  compose("down", "--volumes", "--remove-orphans", "--rmi", "local");
}
