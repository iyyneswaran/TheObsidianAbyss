import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { close, getTeam } from "../fixtures/team.js";
import { verifyAccount } from "../fixtures/progressionJourney.js";

const evidence = "artifacts/milestone-8/";

test("accounts, independent co-op sockets, rendering, bindings, combat, audio and route cleanup", async ({
  browser,
  baseURL,
}, info) => {
  test.setTimeout(180000);
  const password = randomUUID();
  const name = "qa_" + randomUUID().slice(0, 8);
  await mkdir(evidence, { recursive: true });
  const team = await getTeam(
    browser,
    baseURL!,
    info.project.name === "webkit" ? ["defense"] : ["defense", "lightning"],
    async (page, index) => {
      const account = `${name}_${index}`;
      await verifyAccount(page, account, password, true, false);
      await page.getByRole("button", { name: "Sign out" }).click();
      await verifyAccount(page, account, password, false, false);
      await page.goto("/settings");
      await page.getByLabel("Enable audio").check();
      await page.getByRole("button", { name: "Preview sound" }).click();
      const minimap = page.getByRole("button", { name: "Rebind Minimap" });
      await minimap.click();
      await minimap.press("n");
      await expect(minimap).toHaveText("N");
    },
    "expedition",
  );
  try {
    const { leader } = team;
    const peer = team.pages[1];
    await leader.bringToFront();
    const canvas = leader.getByTestId("online-stage").locator("canvas");
    await expect(canvas).toHaveAttribute("width", "640");
    await expect(leader.getByTestId("local-mp")).toHaveAttribute(
      "data-value",
      /^\d+$/,
    );
    const before = Number(
      await leader.getByTestId("local-mp").getAttribute("data-value"),
    );
    await canvas.click();
    await leader.keyboard.press("KeyQ");
    await expect
      .poll(
        async () =>
          Number(
            await leader.getByTestId("local-mp").getAttribute("data-value"),
          ),
        { timeout: 15000 },
      )
      .toBeLessThan(before);
    await expect(leader.getByTestId("combat-fx")).toHaveAttribute(
      "data-rendered",
      /scifi\/force-field/,
    );
    const initial = Number(await canvas.getAttribute("data-input-sequence"));
    await leader.keyboard.down("KeyD");
    try {
      await expect
        .poll(
          async () => Number(await canvas.getAttribute("data-input-sequence")),
          { timeout: 15000 },
        )
        .toBeGreaterThan(initial);
    } finally {
      await leader.keyboard.up("KeyD");
    }
    await leader.keyboard.press("n");
    await expect(
      leader
        .getByRole("complementary", { name: "Expedition map" })
        .getByRole("button"),
    ).toHaveAttribute("aria-expanded", "true");
    await leader.screenshot({
      path: evidence + "compatibility-" + info.project.name + ".png",
    });
    const recovering = peer ?? leader;
    await recovering.close();
    if (peer) {
      await expect(
        leader.getByTestId("party-member").filter({ hasText: /disconnected/i }),
      ).toHaveCount(1);
    }
    const recovered = await team.contexts[peer ? 1 : 0]!.newPage();
    await recovered.goto("/party");
    await recovered.getByLabel("Team code").fill(team.code);
    await recovered
      .getByRole("button", { name: "Reconnect", exact: true })
      .click();
    await expect(recovered.getByTestId("online-stage")).toHaveAttribute(
      "data-ready",
      "true",
      { timeout: 60000 },
    );
    for (const route of ["/store", "/vault", "/quests"])
      await expect((await recovered.goto(route))?.ok()).toBe(true);
    await expect(recovered.locator("canvas")).toHaveCount(0);
    expect(team.errors).toEqual([]);
    await writeFile(
      evidence + "compatibility-" + info.project.name + ".json",
      JSON.stringify(
        {
          browser: info.project.name,
          version: browser.version(),
          platform: process.platform,
          seats: team.pages.length,
          status: "PASS",
        },
        null,
        2,
      ) + "\n",
    );
  } finally {
    await close(team.contexts);
  }
});
