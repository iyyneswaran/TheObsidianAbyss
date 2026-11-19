import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test";

const artifacts = "artifacts/milestone-4/";
const viewport = { width: 1380, height: 980 };
test.use({ actionTimeout: 12_000 });
const canvas = (page: Page) =>
  page.getByTestId("online-stage").locator("canvas");
const mob = (page: Page, kind: string) =>
  page.locator(`[data-testid="combat-enemy"][data-kind="${kind}"]`).first();
const hp = (page: Page) => page.getByTestId("local-hp");
const mp = (page: Page) => page.getByTestId("local-mp");
const number = async (locator: ReturnType<Page["locator"]>, attr: string) =>
  Number(await locator.getAttribute("data-" + attr, { timeout: 4500 }));
const wait = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

async function capture(page: Page, file: string) {
  await page.screenshot({ path: artifacts + file + ".png", fullPage: true });
}

async function getTeam(browser: Browser, baseURL: string, wizards: string[]) {
  const contexts = await Promise.all(
    wizards.map(() => browser.newContext({ baseURL, viewport })),
  );
  const pages = await Promise.all(contexts.map((context) => context.newPage()));
  const leader = pages[0]!;
  const errors: string[] = [];
  pages.forEach((page) =>
    page.on("pageerror", (error) => errors.push(error.message)),
  );
  try {
    await leader.goto("/characters");
    const wizard = leader.getByRole("radio", {
      name: new RegExp("^" + wizards[0], "i"),
    });
    await wizard.focus();
    await wizard.press("Space");
    await leader.getByRole("button", { name: "Play Online" }).click();
    await leader
      .getByRole("button", { name: "Create Team", exact: true })
      .click();
    await expect(leader.getByTestId("team-code")).toHaveText(/^[A-Z0-9]{6}$/);
    const code = await leader.getByTestId("team-code").innerText();
    for (let i = 1; i < pages.length; i++) {
      const page = pages[i]!;
      await page.goto("/party");
      await page.getByLabel("Your wizard").selectOption(wizards[i]!);
      await page.getByLabel("Team code").fill(code);
      await page.getByRole("button", { name: "Join Team" }).click();
      await expect(page.getByTestId("team-code")).toHaveText(code);
    }
    await expect(leader.getByTestId("party-member")).toHaveCount(
      wizards.length,
    );
    await leader.getByRole("button", { name: "Start Dungeon" }).click();
    if (wizards.length < 4)
      await leader.getByRole("button", { name: "Enter Dungeon" }).click();
    const roomIds = new Set<string>();
    for (const page of pages) {
      await expect(page).toHaveURL(/\/dungeon\/online$/);
      await page.bringToFront();
      await expect(page.getByTestId("online-stage")).toHaveAttribute(
        "data-ready",
        "true",
        { timeout: 25000 },
      );
      await expect(hp(page)).toBeVisible();
      await page.keyboard.press("F3");
      await expect(page.getByTestId("online-actor")).toHaveCount(
        wizards.length,
      );
      roomIds.add(await page.getByTestId("debug-room-id").innerText());
    }
    expect(roomIds.size).toBe(1);
    return { leader, pages, contexts, code, errors };
  } catch (error) {
    await close(contexts);
    throw error;
  }
}

async function close(contexts: BrowserContext[]) {
  await Promise.all(contexts.map((context) => context.close()));
}

async function stage(page: Page, code: string, area: string, slot?: number) {
  const target = new URL(
    "http://127.0.0.1:" + process.env.COMBAT_FIXTURE_PORT + "/stage",
  );
  target.searchParams.set("team", code);
  target.searchParams.set("area", area);
  if (slot !== undefined) target.searchParams.set("slot", String(slot));
  const response = await page.request.post(target.href, {
    headers: { "x-combat-fixture-key": process.env.COMBAT_FIXTURE_KEY! },
  });
  if (
    response.status() === 409 &&
    ["boss", "mage", "guard-fight"].includes(area)
  )
    return [];
  expect(response.status()).toBe(200);
  const players = (await response.json()) as {
    slot: number;
    hp: number;
    x: number;
    y: number;
  }[];
  if (slot !== undefined)
    expect(
      players.find((player) => player.slot === slot)?.hp,
      `Player ${slot} must still be alive at ${area}. ${JSON.stringify(players)}`,
    ).toBeGreaterThan(0);
  await wait(260);
  return players;
}

async function aim(page: Page, target: ReturnType<Page["locator"]>) {
  await page.bringToFront();
  await canvas(page).scrollIntoViewIfNeeded();
  const bounds = (await canvas(page).boundingBox())!;
  const camera = page.getByTestId("combat-camera");
  const [point, cx, cy, zoom] = await Promise.all([
    target.evaluateAll(
      ([element]) =>
        element && {
          x: Number(element.getAttribute("data-x")),
          y: Number(element.getAttribute("data-y")),
        },
    ),
    number(camera, "x"),
    number(camera, "y"),
    number(camera, "zoom"),
  ]);
  if (!point) return false;
  const { x, y } = point;
  const scale = (bounds.width / 640) * zoom;
  await page.mouse.move(
    bounds.x + bounds.width / 2 + (x - cx) * scale,
    bounds.y + bounds.height / 2 + (y - cy) * scale,
  );
  return true;
}

async function fire(page: Page, count = 1) {
  await page.bringToFront();
  const map = canvas(page);
  for (let i = 0; i < count; i++) {
    await map.click({ position: { x: 500, y: 300 } });
    if (i < count - 1) await wait(585);
  }
}

async function killRegular(
  page: Page,
  kind: string,
  code: string,
  region: string,
) {
  await stage(page, code, region, 0);
  const enemy = mob(page, kind);
  await expect(
    enemy,
    "Encounter should activate after staging " + region,
  ).toHaveCount(1);
  await aim(page, enemy);
  await page.keyboard.press("e");
  await fire(page, 2);
  for (let attempt = 0; attempt < 10 && (await enemy.count()); attempt++) {
    const engagement = kind === "mage" ? "mage" : "guard-fight";
    if (
      !(await stage(page, code, engagement, 0)).length ||
      !(await aim(page, enemy))
    )
      break;
    await page.keyboard.press("q");
    await page.keyboard.press("e");
    await fire(page, 2);
  }
  await expect(enemy).toHaveCount(0);
}

test("four real browsers fight together, cross lava and shrine, and win all three boss phases", async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(180000);
  const { pages, contexts, code, errors } = await getTeam(browser, baseURL!, [
    "fire",
    "ice",
    "healer",
    "defense",
  ]);
  const [a, b, c, d] = pages as [Page, Page, Page, Page];
  try {
    const shadow = mob(a, "shadow");
    await expect(shadow).toHaveCount(1);
    await expect(shadow).toHaveAttribute("data-appearance", "ghost-wisp");
    await capture(a, "monster-encounter");
    await fire(a);
    await expect.poll(() => number(shadow, "hp")).toBeLessThan(103);
    await expect(a.getByTestId("combat-fx")).toHaveAttribute(
      "data-rendered",
      /fire\/fireball/,
    );
    expect(await number(mp(a), "value")).toBe(105);
    await capture(a, "fire-combat");
    const remoteShadow = mob(b, "shadow");
    await aim(b, remoteShadow);
    await b.keyboard.press("q");
    await expect
      .poll(() => remoteShadow.getAttribute("data-status"))
      .toContain("Frozen");
    const frozen = await number(remoteShadow, "y");
    await wait(210);
    expect(await number(remoteShadow, "y")).toBe(frozen);
    await capture(b, "ice-freeze");
    await d.bringToFront();
    await d.keyboard.press("q");
    await expect(d.getByTestId("local-status")).toContainText("Shielded");
    await d.keyboard.press("q");
    await expect(d.getByTestId("cast-feedback")).toContainText("cooling down");
    await capture(d, "defense-shield");
    await expect
      .poll(() => number(hp(a), "value"), { timeout: 10000 })
      .toBeLessThan(125);
    const beforeHealing = await number(hp(a), "value");
    await c.bringToFront();
    await c.keyboard.press("e");
    await expect
      .poll(() => number(hp(a), "value"))
      .toBeGreaterThan(beforeHealing);
    await capture(c, "healer-healing");
    await capture(a, "four-player-combat");
    await aim(a, shadow);
    await fire(a, 8);
    await expect(shadow).toHaveCount(0);

    await killRegular(a, "lava", code, "guard");
    await killRegular(a, "mage", code, "approach");
    await stage(a, code, "bridge", 0);
    await a.bringToFront();
    await a.keyboard.down("d");
    await wait(535);
    await a.keyboard.up("d");
    const row = a.getByTestId("online-actor").filter({ hasText: "fire" });
    await expect(row.getByTestId("actor-zones")).toContainText("bridge");
    await stage(a, code, "bridge", 0);
    const safeHp = await number(hp(a), "value");
    await a.keyboard.down("w");
    await wait(280);
    await a.keyboard.up("w");
    await expect(row).toContainText("Lava");
    await expect.poll(() => number(hp(a), "value")).toBeLessThan(safeHp);
    await capture(a, "lava-damage");
    const preShrine = await number(mp(a), "value");
    await stage(a, code, "shrine", 0);
    await a.keyboard.down("s");
    await wait(420);
    await a.keyboard.up("s");
    await expect(row.getByTestId("actor-zones")).toContainText(
      "mana_restoration_zone",
    );
    await expect.poll(() => number(mp(a), "value")).toBeGreaterThan(preShrine);
    await capture(a, "mana-restoration");
    await a.keyboard.press("g");
    await expect(a.getByTestId("cast-feedback")).toContainText("approach");
    await stage(a, code, "gate");
    await c.bringToFront();
    await c.keyboard.press("e");
    await a.bringToFront();
    await a.keyboard.press("g");
    const hud = a.getByTestId("boss-hud");
    for (const page of pages)
      await expect(page.getByTestId("boss-hud")).toHaveAttribute(
        "data-phase",
        "1",
      );
    await expect(hud).toContainText("The Watcher");
    await capture(a, "boss-phase-1");

    for (const phase of [2, 3, 4]) {
      for (let round = 0; round < 22; round++) {
        const visiblePhase = Number(
          await hud
            .getAttribute("data-phase", { timeout: 400 })
            .catch(() => "4"),
        );
        if (visiblePhase >= phase) break;
        const team = await stage(a, code, "boss");
        if (!team.length) break;
        for (const [index, keys] of [
          [3, ["q", "f", "r"]],
          [2, ["e", "f", "q"]],
          [1, ["q", "r", "f"]],
          [0, ["e", "f"]],
        ] as const) {
          const page = pages[index]!;
          const target = mob(page, "overlord");
          if (!team.some((player) => player.slot === index && player.hp > 0))
            continue;
          if (!(await aim(page, target))) break;
          for (const key of keys) await page.keyboard.press(key);
          await fire(page);
        }
      }
      if (phase < 4) {
        for (const page of pages)
          await expect(page.getByTestId("boss-hud")).toHaveAttribute(
            "data-phase",
            String(phase),
          );
        await capture(a, "boss-phase-" + phase);
        if (phase === 2) {
          for (const appearance of [
            "shadow-guard",
            "soul-drainer",
            "flying-skull",
            "shadow-bat",
          ]) {
            await expect(
              a.locator(
                `[data-testid="combat-enemy"][data-appearance="${appearance}"]`,
              ),
            ).toHaveCount(1);
          }
          await capture(a, "shadow-army");
        }
        await stage(a, code, "arena-shrine");
        const initialMana = await number(mp(a), "value");
        await c.bringToFront();
        await c.keyboard.press("e");
        await c.keyboard.press("f");
        await expect
          .poll(() => number(mp(a), "value"))
          .toBeGreaterThanOrEqual(Math.min(105, initialMana + 28));
      }
    }
    for (const page of pages) {
      await expect(page.getByTestId("run-result")).toHaveAttribute(
        "data-outcome",
        "VICTORY",
      );
      await expect(page.getByTestId("result-participant")).toHaveCount(4);
      await expect(page.getByTestId("run-result")).not.toContainText(
        /coins|gems/i,
      );
    }
    await capture(a, "victory-screen");
    expect(errors).toEqual([]);
  } finally {
    await close(contexts);
  }
});

test("three-player teams retain fixed starting stats and reject a locked gate", async ({
  browser,
  baseURL,
}) => {
  const { leader, pages, contexts, code } = await getTeam(browser, baseURL!, [
    "fire",
    "ice",
    "defense",
  ]);
  try {
    expect(await number(hp(leader), "max")).toBe(125);
    expect(await number(hp(pages[1]!), "max")).toBe(123);
    expect(await number(hp(pages[2]!), "max")).toBe(170);
    expect(await number(mob(leader, "shadow"), "max")).toBe(103);
    await stage(leader, code, "gate", 0);
    await leader.bringToFront();
    await leader.keyboard.press("g");
    await expect(leader.getByTestId("cast-feedback")).toContainText(
      "Clear the dungeon",
    );
    await expect(leader.getByTestId("boss-hud")).toHaveCount(0);
  } finally {
    await close(contexts);
  }
});

test("two browsers observe permanent death, reload into spectating, and receive the same defeat", async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(90000);
  const { leader, pages, contexts, code } = await getTeam(browser, baseURL!, [
    "lightning",
    "earth",
  ]);
  const earth = pages[1]!;
  try {
    await fire(leader);
    await expect(leader.getByTestId("combat-fx")).toHaveAttribute(
      "data-rendered",
      /lightning\/zap-hit/,
    );
    await capture(leader, "lightning-attack");
    await fire(earth);
    await expect(earth.getByTestId("combat-fx")).toHaveAttribute(
      "data-rendered",
      /nature\/boulder/,
    );
    await capture(earth, "earth-attack");
    await stage(leader, code, "lava", 0);
    await expect(leader.getByTestId("spectator-mode")).toBeVisible({
      timeout: 25000,
    });
    await expect(hp(leader)).toHaveAttribute("data-value", "0");
    await capture(leader, "player-death");
    await leader.getByRole("button", { name: /^Watch Guest/ }).click();
    await leader.reload();
    await expect(leader.getByTestId("spectator-mode")).toBeVisible();
    await expect(
      leader.getByRole("button", { name: /^Watch Guest/ }),
    ).toBeVisible();
    await leader.bringToFront();
    await expect(leader.getByTestId("online-stage")).toHaveAttribute(
      "data-ready",
      "true",
      { timeout: 25000 },
    );
    await leader.keyboard.press("F3");
    const survivor = leader.getByTestId("online-actor").filter({
      has: leader.getByTestId("actor-wizard").filter({ hasText: /^earth$/ }),
    });
    const [x, y] = (await survivor.getByTestId("actor-position").innerText())
      .split(",")
      .map(Number);
    const spectatorCamera = leader.getByTestId("combat-camera");
    await expect
      .poll(async () =>
        Math.hypot(
          (await number(spectatorCamera, "x")) - x!,
          (await number(spectatorCamera, "y")) - y!,
        ),
      )
      .toBeLessThan(12);
    await capture(leader, "spectator-mode");
    await stage(earth, code, "lava", 1);
    for (const page of pages)
      await expect(page.getByTestId("run-result")).toHaveAttribute(
        "data-outcome",
        "DEFEAT",
        { timeout: 25000 },
      );
    await capture(leader, "defeat-screen");
    await leader
      .getByRole("button", { name: "Return to Private Teams" })
      .click();
    await expect(leader.locator("canvas")).toHaveCount(0);
  } finally {
    await close(contexts);
  }
});

test("a solo wind wizard casts, consumes mana, and keeps combat state after reload", async ({
  browser,
  baseURL,
}) => {
  const { leader, contexts } = await getTeam(browser, baseURL!, ["wind"]);
  try {
    await fire(leader);
    await expect(leader.getByTestId("combat-fx")).toHaveAttribute(
      "data-rendered",
      /nature\/leaf-storm/,
    );
    await capture(leader, "wind-attack");
    await aim(leader, mob(leader, "shadow"));
    await leader.keyboard.press("q");
    await expect(mp(leader)).toHaveAttribute("data-value", "98");
    await leader.reload();
    await expect(mp(leader)).toHaveAttribute("data-value", "98");
    await expect(canvas(leader)).toHaveCount(1);
  } finally {
    await close(contexts);
  }
});
