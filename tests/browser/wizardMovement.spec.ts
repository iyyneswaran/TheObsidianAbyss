import { expect, test, type Page } from "@playwright/test";
import {
  playerFootprint,
  playerSpeed,
  resolvePlayerSpawn,
  type WorldPoint,
} from "../../packages/game-core/src/movement.js";
import {
  dungeon,
  obstacleTiles,
  tileCenter,
  zone,
} from "../fixtures/dungeon.js";

test.use({ viewport: { width: 1380, height: 980 } });
const output = "artifacts/milestone-2/";
const spawn = resolvePlayerSpawn(dungeon);
const { tileWidth, tileHeight } = dungeon;
const xRadius = playerFootprint.width / 2;
const yRadius = playerFootprint.height / 2;

async function selectWizard(page: Page, name: string) {
  const radio = page.getByRole("radio", { name });
  await radio.focus();
  await radio.press("Space");
  await page.getByRole("button", { name: "Enter Dungeon" }).click();
}

async function enter(page: Page, name = "Fire Wizard") {
  await page.goto("/characters");
  await selectWizard(page, name);
  await expect(page).toHaveURL(/\/dungeon\/play$/);
  await expect(page.getByTestId("active-wizard")).toHaveText(name, {
    timeout: 25000,
  });
}

const canvas = (page: Page) =>
  page.getByTestId("dungeon-stage").locator("canvas");
const field = (page: Page, name: string) => page.getByTestId(`player-${name}`);

async function position(page: Page): Promise<WorldPoint> {
  const [x, y] = (await field(page, "position").innerText())
    .split(",")
    .map(Number);
  if (x === undefined || y === undefined)
    throw new Error("Player position is unavailable.");
  return { x, y };
}

async function debug(page: Page, visible: boolean) {
  await page.keyboard.press("F3");
  const panel = page.getByRole("region", { name: "Dungeon debug" });
  if (visible) await expect(panel).toBeVisible();
  else await expect(panel).toBeHidden();
}

async function sceneShot(page: Page, name: string) {
  await canvas(page).screenshot({ path: output + name + ".png" });
}

async function held(page: Page, keys: string[], check: () => Promise<void>) {
  for (const key of keys) await page.keyboard.down(key);
  try {
    await check();
  } finally {
    for (const key of keys) await page.keyboard.up(key);
  }
}

const axisKeys = { x: ["a", "d"], y: ["w", "s"] } as const;

async function travel(page: Page, axis: keyof WorldPoint, target: number) {
  for (let attempt = 0; attempt < 16; attempt++) {
    const start = (await position(page))[axis];
    const distance = Math.abs(target - start);
    if (distance <= 9) return;
    const direction = Math.sign(target - start);

    await test.step(`Walk ${axis} from ${start} toward ${target}`, async () => {
      await held(page, [axisKeys[axis][direction > 0 ? 1 : 0]], async () => {
        if (distance < 32) {
          // Short key pulses approach the centerline without waiting through a 100 ms debug sample.
          const pulse = Math.min(
            75,
            Math.max(30, ((distance - 3) * 1000) / playerSpeed),
          );
          await new Promise((resolve) => setTimeout(resolve, pulse));
          return;
        }
        await expect
          .poll(
            async () => direction * (target - (await position(page))[axis]),
            {
              timeout: 2500 + distance * 10,
              intervals: [25, 40, 45],
              message: `Wizard should travel along ${axis} to ${target}`,
            },
          )
          .toBeLessThanOrEqual(13);
      });
      await expect
        .poll(async () => (await position(page))[axis])
        .not.toBe(start);
      await expect(field(page, "motion")).toHaveText("idle");
      await new Promise((resolve) => setTimeout(resolve, 120));
    });
  }
  expect(Math.abs(target - (await position(page))[axis])).toBeLessThanOrEqual(
    9,
  );
}

function pillar(x: number, y: number) {
  const result = obstacleTiles.find((tile) => tile.x === x && tile.y === y);
  if (!result)
    throw new Error(
      "The expected pillar is missing from the canonical obstacle layer.",
    );
  return {
    ...tileCenter(result.x, result.y),
    right: (result.x + 1) * tileWidth,
    top: result.y * tileHeight,
  };
}

test("plays each facing animation, follows the wizard, and stops when movement keys are released", async ({
  page,
}) => {
  const errors: string[] = [];
  const assetRequests: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("request", (request) => {
    if (/\/assets\/(characters|dungeon)\//.test(request.url()))
      assetRequests.push(request.url());
  });

  await enter(page);
  await expect(canvas(page)).toHaveCount(1);
  await sceneShot(page, "fire-entrance");
  await debug(page, true);
  expect(await position(page)).toMatchObject({ x: spawn.x, y: spawn.y });
  await expect(page.getByTestId("camera-center")).toHaveText(
    `${spawn.x}, ${spawn.y}`,
  );
  await expect(field(page, "class")).toHaveText("fire");
  await expect(field(page, "animation")).toHaveText("wizard.fire.idle.down");
  await expect(field(page, "zones")).toContainText("player_spawn");
  const initialRequests = assetRequests.length;
  expect(
    assetRequests.some((url) => url.endsWith("/characters/fire.png")),
  ).toBe(true);

  for (const [key, direction] of [
    ["s", "down"],
    ["w", "up"],
    ["a", "left"],
    ["d", "right"],
  ] as const) {
    const start = await position(page);
    const walk = `wizard.fire.walk.${direction}`;
    await held(page, [key], async () => {
      await expect(field(page, "animation")).toHaveText(walk);
      const frames = await page.evaluate(async (animation) => {
        const observed = new Set<string>();
        const deadline = performance.now() + 2000;
        while (observed.size < 3 && performance.now() < deadline) {
          await new Promise<void>((resolve) =>
            requestAnimationFrame(() => resolve()),
          );
          const active = document.querySelector(
            '[data-testid="player-animation"]',
          )?.textContent;
          const frame = document.querySelector(
            '[data-testid="player-frame"]',
          )?.textContent;
          if (active === animation && frame) observed.add(frame);
        }
        return observed.size;
      }, walk);
      expect(frames).toBe(3);
    });
    await expect(field(page, "animation")).toHaveText(
      `wizard.fire.idle.${direction}`,
    );
    await expect(field(page, "facing")).toHaveText(direction);
    const end = await position(page);
    if (direction === "up") expect(end.y).toBeLessThan(start.y);
    if (direction === "down") expect(end.y).toBeGreaterThan(start.y);
    if (direction === "left") expect(end.x).toBeLessThan(start.x);
    if (direction === "right") expect(end.x).toBeGreaterThan(start.x);
    await debug(page, false);
    await sceneShot(page, "facing-" + direction);
    await debug(page, true);
  }

  const start = await position(page);
  await held(page, ["ArrowRight", "ArrowDown"], async () => {
    await expect
      .poll(async () => {
        const { x, y } = await position(page);
        return Math.min(x - start.x, y - start.y);
      })
      .toBeGreaterThan(20);
    await expect(field(page, "animation")).toHaveText("wizard.fire.walk.down");
  });
  await expect(field(page, "motion")).toHaveText("idle");
  const stopped = await position(page);
  expect(Math.abs(stopped.x - start.x - (stopped.y - start.y))).toBeLessThan(8);

  await expect
    .poll(async () => {
      const [x, y] = (await page.getByTestId("camera-center").innerText())
        .split(",")
        .map(Number);
      return Math.hypot(x! - stopped.x, y! - stopped.y);
    })
    .toBeLessThan(2);
  expect(await position(page)).toEqual(stopped);

  await canvas(page).hover();
  await page.mouse.wheel(0, -120);
  await expect(page.getByTestId("camera-zoom")).toHaveText("2×");
  await page.mouse.wheel(0, 120);
  await expect(page.getByTestId("camera-zoom")).toHaveText("1×");
  await page.mouse.wheel(0, 120);
  await expect(page.getByTestId("camera-zoom")).toHaveText("0.5×");
  await page.mouse.wheel(0, 120);
  await expect(page.getByTestId("camera-zoom")).toHaveText("0.25×");
  await expect(page.getByTestId("camera-center")).toHaveText(
    `${dungeon.worldWidth / 2}, 720`,
  );
  expect(assetRequests).toHaveLength(initialRequests);
  expect(errors).toEqual([]);
});

test("blocks walls and pillars, traverses both corridors and the bridge, and reaches the shrine", async ({
  page,
}) => {
  test.setTimeout(150_000);
  await enter(page);
  await debug(page, true);

  const startTile = dungeon.worldToTile(spawn.x, spawn.y);
  let northWall = startTile.y;
  while (!dungeon.atTile(startTile.x, northWall).solid) northWall--;
  const entranceLimit = (northWall + 1) * tileHeight + yRadius;
  await held(page, ["w"], async () => {
    await expect.poll(async () => (await position(page)).y).toBe(entranceLimit);
    await expect(field(page, "motion")).toHaveText("idle");
  });
  await travel(page, "y", spawn.y);

  const first = pillar(18, 17);
  await travel(page, "x", first.x);
  await held(page, ["s"], async () => {
    await expect
      .poll(async () => (await position(page)).y)
      .toBe(first.top - yRadius);
    await expect(field(page, "motion")).toHaveText("idle");
  });

  async function walkBeside(p: ReturnType<typeof pillar>, screenshot: string) {
    await travel(page, "x", p.right + tileWidth / 2);
    await travel(page, "y", p.y - 3);
    await held(page, ["a"], async () => {
      await expect
        .poll(async () => (await position(page)).x)
        .toBe(p.right + xRadius);
      await expect(field(page, "motion")).toHaveText("idle");
      await new Promise((resolve) => setTimeout(resolve, 120));
    });
    const y = (await position(page)).y;
    await held(page, ["s"], async () => {
      await expect
        .poll(async () => (await position(page)).y)
        .toBeGreaterThan(y + 6);
      await expect(field(page, "animation")).toHaveText(
        "wizard.fire.walk.down",
      );
      await sceneShot(page, screenshot);
    });
  }

  await walkBeside(first, "pillar-entrance");
  const guard1 = zone("entrance_to_guard_1");
  const guard2 = zone("entrance_to_guard_2");
  const guard3 = zone("entrance_to_guard_3");
  const nearGuardY = guard1.y + tileHeight * 1.5;
  await travel(page, "y", nearGuardY);
  const second = pillar(25, 15);
  await travel(page, "x", second.x);
  await walkBeside(second, "pillar-guard-route");
  await travel(page, "y", nearGuardY);

  const firstBendX = guard2.x + tileWidth * 1.5;
  const secondBendX = guard3.x + tileWidth * 1.5;
  const bendY = guard2.y + tileHeight;
  const bridge = zone("bridge");
  const bridgeY = bridge.y + bridge.height / 2;
  const bridgeX = bridge.x + bridge.width / 2;
  await travel(page, "x", firstBendX);
  await travel(page, "y", bendY);
  await travel(page, "x", secondBendX);
  await travel(page, "y", bridgeY);
  await travel(page, "x", bridgeX);
  await expect(field(page, "room")).toHaveText("room_b");
  await expect(field(page, "zones")).toContainText("bridge");
  await expect(field(page, "hazard")).toHaveText("safe");
  await debug(page, false);
  await sceneShot(page, "crossing-bridge");
  await debug(page, true);

  await travel(page, "x", bridge.x + bridge.width + tileWidth);
  expect((await position(page)).x).toBeGreaterThan(bridge.x + bridge.width);
  await travel(page, "x", bridgeX);
  await travel(page, "y", bridge.y - tileHeight / 2);
  await expect(field(page, "hazard")).toHaveText("lava");
  await travel(page, "y", bridgeY);
  await expect(field(page, "hazard")).toHaveText("safe");

  await travel(page, "x", secondBendX);
  await travel(page, "y", bendY);
  await travel(page, "x", firstBendX);
  await travel(page, "y", nearGuardY);
  await travel(page, "x", tileCenter(22, 0).x);
  await expect(field(page, "room")).toHaveText("room_a");

  const south1 = zone("entrance_to_sanctuary_1");
  const south2 = zone("entrance_to_sanctuary_2");
  const south3 = zone("entrance_to_sanctuary_3");
  const shrine = zone("mana_restoration_zone");
  await travel(page, "y", south1.y - tileHeight / 2);
  await travel(page, "x", south1.x + south1.width / 2);
  await travel(page, "y", south2.y + tileHeight * 1.5);
  await travel(page, "x", south3.x + tileWidth * 2.5);
  await travel(page, "y", shrine.y + shrine.height / 2);
  await travel(page, "x", shrine.x + shrine.width / 2);
  await expect(field(page, "room")).toHaveText("room_c");
  await expect(field(page, "zones")).toContainText("mana_restoration_zone");
  await expect(field(page, "hazard")).toHaveText("safe");
  await page.screenshot({
    path: output + "movement-debug.png",
    fullPage: true,
  });
  await debug(page, false);
  await sceneShot(page, "azure-shrine");
});

test("loads a second class, resets held input on blur, and disposes each session", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/dungeon/play");
  await expect(page).toHaveURL(/\/characters$/);
  const cdp = await page.context().newCDPSession(page);
  const objectId = async (expression: string) => {
    const { result } = await cdp.send("Runtime.evaluate", { expression });
    if (!result.objectId)
      throw new Error(`No browser object for ${expression}`);
    return result.objectId;
  };
  const listenerCount = async (id: string, types: string[]) => {
    const { listeners } = await cdp.send("DOMDebugger.getEventListeners", {
      objectId: id,
    });
    return listeners.filter(({ type }) => types.includes(type)).length;
  };
  const browserWindow = await objectId("window");
  const browserDocument = await objectId("document");
  const keyboardListeners = () =>
    listenerCount(browserWindow, ["keydown", "keyup"]);
  const visibilityListeners = () =>
    listenerCount(browserDocument, ["visibilitychange"]);
  const baselineKeys = await keyboardListeners();
  const baselineVisibility = await visibilityListeners();

  await selectWizard(page, "Ice Wizard");
  await expect(page.getByTestId("active-wizard")).toHaveText("Ice Wizard");
  await sceneShot(page, "ice-entrance");
  await debug(page, true);
  await expect(field(page, "class")).toHaveText("ice");
  await expect(field(page, "animation")).toHaveText("wizard.ice.idle.down");

  await held(page, ["ArrowDown"], async () => {
    await expect(field(page, "animation")).toHaveText("wizard.ice.walk.down");
    // Dispatch the browser's focus-loss event while leaving the physical key held.
    await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    await expect(field(page, "motion")).toHaveText("idle");
    const stopped = await position(page);
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(field(page, "motion")).toHaveText("idle");
    expect(await position(page)).toEqual(stopped);
  });

  for (const name of ["Fire Wizard", "Ice Wizard"]) {
    expect(await keyboardListeners()).toBe(baselineKeys + 2);
    expect(await visibilityListeners()).toBe(baselineVisibility + 1);
    const canvasId = await objectId("document.querySelector('canvas')");
    expect(await listenerCount(canvasId, ["wheel"])).toBe(1);
    const old = await canvas(page).elementHandle();
    await page.getByRole("link", { name: "Change wizard" }).click();
    await expect
      .poll(() => old.evaluate((node) => node.parentNode === null))
      .toBe(true);
    await old.dispose();
    await expect(page.locator("canvas")).toHaveCount(0);
    expect(await keyboardListeners()).toBe(baselineKeys);
    expect(await visibilityListeners()).toBe(baselineVisibility);
    expect(await listenerCount(canvasId, ["wheel"])).toBe(0);
    await cdp.send("Runtime.releaseObject", { objectId: canvasId });
    await selectWizard(page, name);
    await expect(page.getByTestId("active-wizard")).toHaveText(name);
    await expect(page.locator("canvas")).toHaveCount(1);
    await debug(page, true);
    const classId = name.split(" ")[0]!.toLowerCase();
    await expect(field(page, "animation")).toHaveText(
      `wizard.${classId}.idle.down`,
    );
    expect(await position(page)).toMatchObject({ x: spawn.x, y: spawn.y });
    await held(page, ["ArrowDown"], async () => {
      await expect(field(page, "animation")).toHaveText(
        `wizard.${classId}.walk.down`,
      );
    });
    await expect(field(page, "motion")).toHaveText("idle");
  }
  await cdp.detach();
  expect(errors).toEqual([]);
});

test("reports a missing selected sprite and lets the user choose another class", async ({
  page,
}) => {
  await page.goto("/characters");
  await page.route("**/assets/characters/fire.png", (route) => route.abort());
  await selectWizard(page, "Fire Wizard");
  await expect(page.getByRole("alert")).toContainText(
    "The dungeon could not load",
  );
  await page.getByRole("link", { name: "Change wizard" }).click();
  await selectWizard(page, "Ice Wizard");
  await expect(page.getByTestId("active-wizard")).toHaveText("Ice Wizard");
  await expect(canvas(page)).toHaveCount(1);
});
