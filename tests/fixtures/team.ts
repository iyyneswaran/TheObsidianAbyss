import {
  expect,
  type Browser,
  type Page,
  type BrowserContext,
} from "@playwright/test";
const viewport = { width: 1380, height: 980 };
export async function getTeam(
  browser: Browser,
  baseURL: string,
  wizards: string[],
  prepare?: (page: Page, index: number) => Promise<void>,
  dungeon: "classic" | "expedition" = "classic",
) {
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
    if (prepare)
      for (const [index, page] of pages.entries()) await prepare(page, index);
    await leader.goto("/characters");
    const wizard = leader.getByRole("radio", {
      name: new RegExp("^" + wizards[0], "i"),
    });
    await wizard.focus();
    await wizard.press("Space");
    await leader.getByRole("button", { name: "Play Online" }).click();
    await leader.getByLabel("Dungeon route").selectOption(dungeon);
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
      await expect(page.getByTestId("local-hp")).toBeVisible();
      if (process.env.M7_PRODUCTION === "1") continue;
      await page.keyboard.press("F3");
      await expect(page.getByTestId("online-actor")).toHaveCount(
        wizards.length,
      );
      roomIds.add(await page.getByTestId("debug-room-id").innerText());
    }
    if (process.env.M7_PRODUCTION !== "1") expect(roomIds.size).toBe(1);
    return { leader, pages, contexts, code, errors };
  } catch (error) {
    await close(contexts);
    throw error;
  }
}

export async function close(contexts: BrowserContext[]) {
  await Promise.all(contexts.map((context) => context.close()));
}
