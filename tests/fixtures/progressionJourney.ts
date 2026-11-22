import { expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { localPorts } from "../../packages/shared/src/index.js";

export async function progressionCapture(page: Page, name: string) {
  await page.screenshot({
    path: "artifacts/milestone-5/" + name + ".png",
    fullPage: true,
  });
}

async function post(page: Page, path: string, data: object) {
  const api = "http://localhost:" + (process.env.API_PORT ?? localPorts.api);
  return page.request.post(api + path, {
    data,
    headers: { origin: new URL(page.url()).origin },
  });
}

export async function verifyAccount(
  page: Page,
  username: string,
  password: string,
  register: boolean,
  evidence: boolean,
) {
  async function submit(mode: "login" | "register") {
    await page.goto("/" + mode);
    await page.getByLabel("Username").fill(username);
    await page.getByLabel("Password").fill(password);
    if (evidence && register)
      await progressionCapture(
        page,
        mode === "login" ? "login" : "registration",
      );
    await page
      .getByRole("button", {
        name: mode === "login" ? "Sign in" : "Register",
        exact: true,
      })
      .click();
    await expect(page.getByTestId("profile-name")).toHaveText(username, {
      timeout: 20000,
    });
  }
  await submit(register ? "register" : "login");
  if (register) {
    await expect(page.getByTestId("profile-level")).toHaveText("Level 1");
    await expect(page.getByTestId("profile-xp")).toHaveText("0");
    await expect(page.getByTestId("wallet-coins")).toHaveText("0");
    await expect(page.getByTestId("wallet-gems")).toHaveText("0");
    if (evidence) {
      await progressionCapture(page, "profile-initial");
      await page.getByRole("button", { name: "Sign out" }).click();
      await expect(page).toHaveURL(/\/login$/);
      await submit("login");
      await progressionCapture(page, "wallet-before-reward");
    }
  }
}

export async function verifyReward(
  page: Page,
  round: number,
  evidence: boolean,
) {
  await expect(page.getByTestId("settlement")).toHaveAttribute(
    "data-status",
    "SETTLED",
    { timeout: 20000 },
  );
  const runId = await page
    .getByTestId("run-result")
    .getAttribute("data-run-id");
  await page.getByRole("button", { name: "Return to Private Teams" }).click();
  await page.goto("/profile");
  await expect(page.getByTestId("profile-xp")).toHaveText(String(round * 100));
  await expect(page.getByTestId("wallet-coins")).toHaveText(String(round * 60));
  await expect(page.getByTestId("wallet-gems")).toHaveText(String(round * 3));
  await expect(page.locator('[data-run-id="' + runId + '"]')).toHaveText(
    /Victory.*60 coins.*3 gems.*100 XP/,
  );
  if (evidence)
    await progressionCapture(
      page,
      round === 1 ? "wallet-after-victory" : "profile-progressed",
    );
}

export async function visitMarket(page: Page) {
  await page.goto("/quests");
  const daily = page.getByRole("region", { name: "Daily quests" });
  const weekly = page.getByRole("region", { name: "Weekly quests" });
  await expect(daily.getByTestId("quest-card")).toHaveCount(5);
  await expect(weekly.getByTestId("quest-card")).toHaveCount(7);
  await expect(daily.getByTestId("class-quest")).toHaveCount(1);
  await expect(weekly.getByTestId("class-quest")).toHaveCount(3);
  await progressionCapture(page, "daily-quests");
  await weekly.screenshot({ path: "artifacts/milestone-5/weekly-quests.png" });
  await daily
    .getByTestId("quest-card")
    .filter({ has: page.getByTestId("class-quest") })
    .screenshot({ path: "artifacts/milestone-5/role-specific-quest.png" });
  const wins = weekly
    .getByTestId("quest-card")
    .filter({ hasText: "End of the Eclipse" });
  await expect(wins.getByTestId("quest-progress")).toHaveText("2 / 2");
  await progressionCapture(page, "quest-progress");
  await wins.getByRole("button", { name: "Claim", exact: true }).click();
  await progressionCapture(page, "quest-claim");
  await page.getByRole("button", { name: "Claim reward" }).click();
  await expect(wins).toContainText("Claimed");
  await expect(page.getByTestId("wallet-coins")).toHaveText("290");
  const replay = await post(page, "/quests/claim", {
    instanceId: await wins.getAttribute("data-quest-id"),
  });
  expect((await replay.json()).wallet).toEqual({ coins: 290, gems: 6 });
  await progressionCapture(page, "quest-claimed");
  await page.goto("/vault");
  await expect(page.getByTestId("vault-slot")).toHaveCount(5);
  await progressionCapture(page, "vault-default");
  await page.goto("/store");
  for (const [id, category, currency, price, file] of [
    ["meteor", "Skills", "coins", 180, "skill"],
    ["inferno-core", "Ultimates", "gems", 6, "ultimate"],
  ] as const) {
    await page.getByRole("button", { name: category, exact: true }).click();
    const card = page.locator('[data-item-id="' + id + '"]');
    await expect(card).toContainText(price + " " + currency);
    await progressionCapture(page, "store-" + category.toLowerCase());
    await card.getByRole("button", { name: "Purchase" }).click();
    await page.getByRole("button", { name: "Confirm purchase" }).click();
    await expect(card.getByRole("button", { name: "Owned" })).toBeDisabled();
    await expect(page.getByTestId("wallet-" + currency)).toHaveText(
      currency === "coins" ? "110" : "0",
    );
    expect(
      (
        await post(page, "/store/purchase", {
          itemId: id,
          requestKey: randomUUID(),
        })
      ).status(),
    ).toBe(409);
    await progressionCapture(page, file + "-purchase");
  }
  await page.goto("/vault");
  await page.getByLabel("Skill 3 (R)").selectOption("meteor");
  await page.getByLabel("Ultimate (F)").selectOption("inferno-core");
  await page.getByRole("button", { name: "Save loadout" }).click();
  await expect(page.getByRole("status")).toContainText("Loadout saved");
  await page.reload();
  await expect(page.getByLabel("Ultimate (F)")).toHaveValue("inferno-core");
  await progressionCapture(page, "vault-custom-loadout");
}

export async function verifyEquippedCombat(page: Page) {
  await expect(
    page.locator('[data-testid="ability-slot"][data-slot="SKILL_3"]'),
  ).toContainText("Meteor");
  await expect(
    page.locator('[data-testid="ability-slot"][data-slot="ULTIMATE"]'),
  ).toContainText("Inferno Core");
  expect(
    (
      await post(page, "/vault/equip", {
        wizard: "ice",
        skill3: "ice-spikes",
        ultimate: null,
      })
    ).status(),
  ).toBe(403);
  await page.reload();
  await expect(
    page.locator('[data-testid="ability-slot"][data-slot="SKILL_3"]'),
  ).toContainText("Meteor");
  await expect(page.getByTestId("online-stage")).toHaveAttribute(
    "data-ready",
    "true",
  );
  if (!(await page.getByTestId("combat-camera").count()))
    await page.keyboard.press("F3");
}
