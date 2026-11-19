import { expect, test, type Page } from "@playwright/test";
import { playerFootprint } from "../../packages/game-core/src/movement.js";
import {
  dungeon,
  obstacleTiles,
  tileCenter,
  zone,
} from "../fixtures/dungeon.js";

const artifacts = "artifacts/milestone-3/";
const viewport = { width: 1380, height: 980 };
const debug = (page: Page) =>
  page.getByRole("region", { name: "Multiplayer debug" });
const actor = (page: Page, wizard: string) =>
  page.getByTestId("online-actor").filter({
    has: page
      .getByTestId("actor-wizard")
      .filter({ hasText: new RegExp("^" + wizard + "$") }),
  });
async function position(page: Page, wizard: string) {
  const [x, y] = (
    await actor(page, wizard).getByTestId("actor-position").innerText()
  )
    .split(",")
    .map(Number);
  return { x: x!, y: y! };
}
async function snapshot(page: Page, name: string) {
  await page.screenshot({ path: artifacts + name + ".png", fullPage: true });
}
async function showDebug(page: Page) {
  await page.bringToFront();
  await expect(page.getByTestId("online-stage")).toHaveAttribute(
    "data-ready",
    "true",
    { timeout: 15_000 },
  );
  await page.keyboard.press("F3");
  await expect(debug(page)).toBeVisible();
}

async function hold(page: Page, key: string, action: () => Promise<void>) {
  await page.keyboard.down(key);
  try {
    await action();
  } finally {
    await page.keyboard.up(key);
  }
}

async function travel(page: Page, axis: "x" | "y", target: number) {
  const key = axis === "x" ? ["a", "d"] : ["w", "s"];
  for (let attempt = 0; attempt < 6; attempt++) {
    const here = (await position(page, "fire"))[axis];
    const distance = Math.abs(target - here);
    if (distance < 10) return;
    const direction = target > here ? 1 : -1;
    await hold(page, key[direction > 0 ? 1 : 0]!, async () => {
      if (distance < 60) {
        const pulse = Math.min(
          240,
          Math.max(65, ((distance - 5) * 1000) / 144),
        );
        await page.evaluate(
          (delay) => new Promise((resolve) => setTimeout(resolve, delay)),
          pulse,
        );
      } else {
        await expect
          .poll(
            async () =>
              direction * (target - (await position(page, "fire"))[axis]),
            {
              timeout: distance * 11 + 4000,
              intervals: [40, 60],
              message: `Authoritative wizard should approach ${axis}=${target}`,
            },
          )
          .toBeLessThan(28);
      }
    });
    await expect
      .poll(async () => (await position(page, "fire"))[axis])
      .not.toBe(here);
    await expect(
      actor(page, "fire").getByTestId("actor-animation"),
    ).toContainText(".idle.");
  }
  expect(Math.abs(target - (await position(page, "fire"))[axis])).toBeLessThan(
    10,
  );
}

test("one wizard can cancel the warning, confirm entry, and deliberately leave", async ({
  page,
}) => {
  await page.setViewportSize(viewport);
  await page.goto("/characters");
  const fire = page.getByRole("radio", { name: "Fire Wizard" });
  await fire.focus();
  await fire.press("Space");
  await page.getByRole("button", { name: "Play Online" }).click();
  await expect(page).toHaveURL(/\/party$/);
  await expect(page.getByLabel("Your wizard")).toHaveValue("fire");
  await snapshot(page, "create-team");
  await page.getByRole("button", { name: "Create Team", exact: true }).click();
  await expect(page.getByTestId("party-count")).toHaveText("1 of 4 connected");
  await snapshot(page, "lobby-one-player");
  await page.getByRole("button", { name: "Start Dungeon" }).click();
  const warning = page.getByRole("dialog", { name: "Incomplete Team" });
  await expect(warning).toBeVisible();
  await snapshot(page, "incomplete-team-warning");
  await warning.getByRole("button", { name: "Cancel" }).click();
  await expect(warning).toBeHidden();
  await expect(page).toHaveURL(/\/party$/);
  await page.getByRole("button", { name: "Start Dungeon" }).click();
  await warning.getByRole("button", { name: "Enter Dungeon" }).click();
  await expect(page).toHaveURL(/\/dungeon\/online$/);
  const stage = page.getByTestId("online-stage").locator("canvas");
  await expect(stage).toHaveCount(1);
  const oldCanvas = await stage.elementHandle();
  await page.getByRole("button", { name: "Leave Session" }).click();
  const leave = page.getByRole("dialog", { name: "Leave the dungeon?" });
  await expect(leave).toBeVisible();
  await leave.getByRole("button", { name: "Cancel" }).click();
  await expect(page).toHaveURL(/\/dungeon\/online$/);
  await page.getByRole("button", { name: "Leave Session" }).click();
  await leave.getByRole("button", { name: "Leave Session" }).click();
  await expect(page).toHaveURL(/\/party$/);
  await expect
    .poll(() => oldCanvas.evaluate((node) => node.parentNode === null))
    .toBe(true);
  await expect(page.locator("canvas")).toHaveCount(0);
});

test("four independent browsers share wizards, authoritative movement, and identity-verified recovery", async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(120_000);
  if (!baseURL) throw new Error("Co-op tests require a configured web origin.");
  const contexts = await Promise.all(
    Array.from({ length: 4 }, () => browser.newContext({ baseURL, viewport })),
  );
  const pages = await Promise.all(contexts.map((context) => context.newPage()));
  const [a, b, c, d] = pages as [Page, Page, Page, Page];
  const errors: string[] = [];
  const observe = (page: Page) =>
    page.on("pageerror", (error) => errors.push(error.message));
  pages.forEach(observe);
  try {
    await a.goto("/party");
    await a.getByLabel("Your wizard").selectOption("fire");
    await a.getByRole("button", { name: "Create Team", exact: true }).click();
    const codeLabel = a.getByTestId("team-code");
    await expect(codeLabel).toHaveText(/^[A-Z0-9]{6}$/);
    const code = await codeLabel.innerText();

    for (const [page, wizard] of [
      [b, "ice"],
      [c, "healer"],
      [d, "defense"],
    ] as const) {
      await page.goto("/party");
      await page.getByLabel("Your wizard").selectOption(wizard);
      await page.getByLabel("Team code").fill(code);
      if (page === b) await snapshot(b, "join-team");
      await page.getByRole("button", { name: "Join Team" }).click();
      await expect(page.getByTestId("team-code")).toHaveText(code);
    }
    for (const page of pages)
      await expect(page.getByTestId("party-member")).toHaveCount(4);
    await expect(b.getByRole("button", { name: "Start Dungeon" })).toHaveCount(
      0,
    );
    await snapshot(a, "lobby-four-players");
    await a.getByRole("button", { name: "Start Dungeon" }).click();
    await expect(
      a.getByRole("dialog", { name: "Incomplete Team" }),
    ).toHaveCount(0);

    const wizardIds = ["fire", "ice", "healer", "defense"];
    const identities = new Set<string>();
    for (const [i, page] of pages.entries()) {
      await expect(page).toHaveURL(/\/dungeon\/online$/);
      await expect(page.getByTestId("online-code")).toHaveText(code);
      await expect(
        page.getByTestId("online-stage").locator("canvas"),
      ).toHaveCount(1, { timeout: 15_000 });
      await showDebug(page);
      await expect(page.getByTestId("online-actor")).toHaveCount(4);
      for (const wizard of wizardIds)
        await expect(actor(page, wizard)).toHaveCount(1);
      const localId = await page.getByTestId("debug-local-id").innerText();
      expect(
        await actor(page, wizardIds[i]!).getAttribute("data-player-id"),
      ).toBe(localId);
      identities.add(localId);
    }
    expect(identities.size).toBe(4);
    const roomId = await a.getByTestId("debug-room-id").innerText();
    for (const page of pages)
      await expect(page.getByTestId("debug-room-id")).toHaveText(roomId);
    const spawnPositions = await Promise.all(
      wizardIds.map((wizard) =>
        actor(a, wizard).getByTestId("actor-position").innerText(),
      ),
    );
    expect(new Set(spawnPositions).size).toBe(4);
    await a.bringToFront();
    await a.keyboard.press("F3");
    await expect(debug(a)).toBeHidden();
    await snapshot(a, "four-player-dungeon");
    await showDebug(a);

    // Clear the entrance with real controls before the movement and reconnect checks.
    const entranceEnemy = a.locator(
      '[data-testid="combat-enemy"][data-kind="shadow"]',
    );
    await expect(entranceEnemy).toHaveCount(1);
    const canvas = a.getByTestId("online-stage").locator("canvas");
    for (
      let volley = 0;
      volley < 12 && (await entranceEnemy.count());
      volley++
    ) {
      await canvas.click({ position: { x: 500, y: 300 } });
      await a.keyboard.press("q");
      await a.keyboard.press("e");
      await a.waitForTimeout(590);
    }
    await expect(entranceEnemy).toHaveCount(0);

    const fireStart = await position(a, "fire");
    const iceStart = await position(a, "ice");
    await hold(a, "s", async () => {
      await expect
        .poll(async () => (await position(a, "fire")).y)
        .toBeGreaterThan(fireStart.y + 24);
    });
    await expect(actor(a, "fire").getByTestId("actor-animation")).toContainText(
      ".idle.",
    );
    const movedFire = await position(a, "fire");
    for (const page of [b, c, d])
      await expect.poll(() => position(page, "fire")).toEqual(movedFire);
    expect(await position(a, "ice")).toEqual(iceStart);
    await b.bringToFront();
    await hold(b, "d", async () => {
      await expect
        .poll(async () => (await position(a, "ice")).x)
        .toBeGreaterThan(iceStart.x + 23);
    });
    await expect(actor(a, "ice").getByTestId("actor-animation")).toContainText(
      ".idle.",
    );
    const movedIce = await position(a, "ice");
    expect(await position(a, "fire")).toEqual(movedFire);
    await snapshot(a, "two-player-movement");

    await a.bringToFront();
    const spawnTile = dungeon.worldToTile(fireStart.x, fireStart.y);
    let wall = spawnTile.y;
    while (!dungeon.atTile(spawnTile.x, wall).solid) wall--;
    const northLimit =
      (wall + 1) * dungeon.tileHeight + playerFootprint.height / 2;
    await hold(a, "w", async () => {
      await expect
        .poll(async () => (await position(a, "fire")).y)
        .toBe(northLimit);
      await expect(
        actor(a, "fire").getByTestId("actor-animation"),
      ).toContainText(".idle.");
    });
    await travel(a, "y", fireStart.y);
    const pillar = obstacleTiles.find(({ x, y }) => x === 18 && y === 17)!;
    await travel(a, "x", tileCenter(pillar.x, pillar.y).x);
    await hold(a, "s", async () => {
      await expect
        .poll(async () => (await position(a, "fire")).y)
        .toBe(pillar.y * dungeon.tileHeight - playerFootprint.height / 2);
      await expect(
        actor(a, "fire").getByTestId("actor-animation"),
      ).toContainText(".idle.");
    });
    await travel(a, "x", tileCenter(pillar.x + 1, pillar.y).x);
    const guard1 = zone("entrance_to_guard_1");
    const guard2 = zone("entrance_to_guard_2");
    const guard3 = zone("entrance_to_guard_3");
    const bridge = zone("bridge");
    await travel(a, "y", guard1.y + 1.5 * dungeon.tileHeight);
    await travel(a, "x", guard2.x + 1.5 * dungeon.tileWidth);
    await travel(a, "y", guard2.y + dungeon.tileHeight);
    await travel(a, "x", guard3.x + 1.5 * dungeon.tileWidth);
    await travel(a, "y", bridge.y + bridge.height / 2);
    await travel(a, "x", bridge.x + bridge.width / 2);
    await expect(actor(a, "fire").getByTestId("actor-zones")).toContainText(
      "bridge",
    );
    await travel(a, "x", bridge.x + bridge.width + dungeon.tileWidth);
    expect((await position(a, "fire")).x).toBeGreaterThan(
      bridge.x + bridge.width,
    );

    await c.bringToFront();
    const healerStart = await position(a, "healer");
    await hold(c, "s", async () => {
      await expect
        .poll(async () => (await position(a, "healer")).y)
        .toBeGreaterThan(healerStart.y + 20);
    });
    await expect(
      actor(a, "healer").getByTestId("actor-animation"),
    ).toContainText(".idle.");
    const originalId = await actor(a, "healer").getAttribute("data-player-id");
    const retained = await position(a, "healer");
    await c.close();
    await expect(actor(a, "healer").getByTestId("actor-connection")).toHaveText(
      "DISCONNECTED_PROTECTED",
    );
    expect(await position(a, "healer")).toEqual(retained);
    await snapshot(a, "player-disconnected");

    const resumed = await contexts[2]!.newPage();
    observe(resumed);
    await resumed.goto("/party");
    await resumed.getByLabel("Team code").fill(code);
    await resumed
      .getByRole("button", { name: "Reconnect", exact: true })
      .click();
    await expect(resumed).toHaveURL(/\/dungeon\/online$/);
    await expect(
      resumed.getByTestId("online-stage").locator("canvas"),
    ).toHaveCount(1);
    await showDebug(resumed);
    await expect(resumed.getByTestId("debug-local-id")).toHaveText(originalId!);
    await expect(actor(a, "healer").getByTestId("actor-connection")).toHaveText(
      "CONNECTED",
    );
    expect(await position(resumed, "healer")).toEqual(retained);
    await snapshot(resumed, "player-reconnected");

    await d.reload();
    await expect(d.getByTestId("network-status")).toHaveText("Connected");
    await expect(d.getByTestId("online-stage").locator("canvas")).toHaveCount(
      1,
    );
    await showDebug(d);
    for (const page of [a, b, resumed, d]) {
      await expect(page.getByTestId("debug-room-id")).toHaveText(roomId);
      await expect(page.getByTestId("online-actor")).toHaveCount(4);
      expect(await position(page, "healer")).toEqual(retained);
      expect(await position(page, "ice")).toEqual(movedIce);
    }
    await snapshot(a, "multiplayer-debug");
    const patchRate = Number(await a.getByTestId("debug-rate").innerText());
    expect(patchRate).toBeGreaterThan(0);
    console.log(
      `Four-client capture observed ${patchRate} state updates in the preceding second.`,
    );
    expect(errors).toEqual([]);
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});
