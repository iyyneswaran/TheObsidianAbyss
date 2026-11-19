import { expect, test } from "@playwright/test";
import { verifyAccount } from "../fixtures/progressionJourney.js";

test("production services reload the earned wallet, quest claim, ownership, loadout and combat after restart", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await verifyAccount(
    page,
    process.env.M5_SMOKE_USER!,
    process.env.M5_SMOKE_PASSWORD!,
    false,
    false,
  );
  await expect(page.getByTestId("wallet-coins")).toHaveText("110");
  await expect(page.getByTestId("wallet-gems")).toHaveText("0");
  await expect(page.getByTestId("profile-xp")).toHaveText("200");
  await expect(
    page.getByTestId("run-history").filter({ hasText: "Victory" }),
  ).toHaveCount(2);
  await page.goto("/quests");
  await expect(
    page.getByTestId("quest-card").filter({ hasText: "End of the Eclipse" }),
  ).toContainText("Claimed");
  await page.goto("/vault");
  await expect(page.getByLabel("Skill 3 (R)")).toHaveValue("meteor");
  await expect(page.getByLabel("Ultimate (F)")).toHaveValue("inferno-core");
  await page.goto("/party");
  await page.getByLabel("Your wizard").selectOption("fire");
  await page.getByRole("button", { name: "Create Team", exact: true }).click();
  await page.getByRole("button", { name: "Start Dungeon" }).click();
  await page.getByRole("button", { name: "Enter Dungeon" }).click();
  await expect(page.getByTestId("online-stage")).toHaveAttribute(
    "data-ready",
    "true",
    { timeout: 25000 },
  );
  await expect(
    page.getByTestId("ability-slot").filter({ hasText: "Meteor" }),
  ).toBeVisible();
  await page.getByTestId("online-stage").locator("canvas").click();
  await page.keyboard.press("f");
  await expect(page.getByTestId("local-mp")).toHaveAttribute(
    "data-value",
    "62",
  );
  const game = "http://localhost:" + process.env.GAME_PORT;
  expect((await page.request.post(game + "/stage")).ok()).toBe(false);
  const api = "http://localhost:" + process.env.API_PORT;
  expect((await page.request.post(api + "/run/settle")).status()).toBe(404);
  expect(errors).toEqual([]);
});
