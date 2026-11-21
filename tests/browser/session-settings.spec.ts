import { expect, test } from "@playwright/test";
test("session mixer preserves the room, remapped cast reaches the server and denied audio stays playable", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "AudioContext", {
      value: class {
        constructor() {
          throw Error("Audio unavailable");
        }
      },
    });
  });
  await page.goto("/party");
  await page.getByLabel("Your wizard").selectOption("defense");
  await page.getByRole("button", { name: "Create Team", exact: true }).click();
  const code = await page.getByTestId("team-code").innerText();
  await page.getByRole("button", { name: "Start Dungeon" }).click();
  await page.getByRole("button", { name: "Enter Dungeon" }).click();
  await expect(page.getByTestId("online-stage")).toHaveAttribute(
    "data-ready",
    "true",
    { timeout: 25000 },
  );
  const settings = page.getByRole("link", { name: "Settings" });
  await settings.click();
  const dialog = page.getByRole("dialog", { name: "Session settings" });
  const bind = dialog.getByRole("button", { name: "Rebind Skill 1" });
  await bind.click();
  await bind.press("h");
  await dialog.getByRole("button", { name: "Return to game" }).click();
  await expect(settings).toBeFocused();
  await expect(page.getByTestId("online-code")).toHaveText(code);
  await expect(
    page.getByTestId("ability-slot").filter({ hasText: "H" }).first(),
  ).toBeVisible();
  const mp = page.getByTestId("local-mp");
  const before = Number(await mp.getAttribute("data-value"));
  await page
    .getByTestId("online-stage")
    .locator("canvas")
    .click({ position: { x: 125, y: 105 } });
  await page.keyboard.press("h");
  await expect
    .poll(async () => Number(await mp.getAttribute("data-value")))
    .toBeLessThan(before);
});
