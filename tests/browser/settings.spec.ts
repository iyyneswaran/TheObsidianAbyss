import { expect, test } from "@playwright/test";
import { writeFile } from "node:fs/promises";
const dir = "artifacts/milestone-7/";
test("trusted activation starts Web Audio, persists the mixer, detects conflicts and applies display settings", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const Native = window.AudioContext;
    const mixes: AnalyserNode[] = [];
    Reflect.set(window, "measuredMixes", mixes);
    window.AudioContext = new Proxy(Native, {
      construct(target, args) {
        const ctx = Reflect.construct(target, args) as AudioContext;
        const make = ctx.createGain.bind(ctx);
        let first = true;
        ctx.createGain = () => {
          const gain = make();
          if (first) {
            first = false;
            const analyser = ctx.createAnalyser();
            gain.connect(analyser);
            mixes.push(analyser);
          }
          return gain;
        };
        return ctx;
      },
    });
  });
  await page.goto("/settings");
  const count = () =>
    page.evaluate(
      () => (Reflect.get(window, "measuredMixes") as AnalyserNode[]).length,
    );
  expect(await count()).toBe(0);
  await page.getByRole("button", { name: "Preview sound" }).click();
  await expect.poll(count).toBe(1);
  const peak = () =>
    page.evaluate(() => {
      const meter = (
        Reflect.get(window, "measuredMixes") as AnalyserNode[]
      )[0]!;
      const data = new Float32Array(meter.fftSize);
      meter.getFloatTimeDomainData(data);
      return Math.max(...data.map(Math.abs));
    });
  await expect.poll(peak, { intervals: [10, 20] }).toBeGreaterThan(0.0001);
  await page.getByLabel("Mute all").check();
  await expect.poll(peak).toBe(0);
  await page.getByLabel("Music volume").focus();
  await page.keyboard.press("Home");
  for (let i = 0; i < 31; i++) await page.keyboard.press("ArrowRight");
  await page.getByLabel("High contrast").check();
  await page.getByLabel("Reduced motion").check();
  await page.screenshot({ path: dir + "settings-audio.png" });
  const rebind = page.getByRole("button", { name: "Rebind Minimap" });
  await rebind.click();
  await rebind.press("w");
  await expect(
    page.getByRole("status").filter({ hasText: "already assigned" }),
  ).toBeVisible();
  await rebind.press("n");
  await expect(rebind).toHaveText("N");
  await page.screenshot({ path: dir + "settings-controls.png" });
  await page.reload();
  await expect(rebind).toHaveText("N");
  await expect(page.getByLabel("Music volume")).toHaveValue("31");
  await expect(page.locator("html")).toHaveAttribute("data-motion", "reduced");
  await page.getByRole("button", { name: "Restore defaults" }).click();
  await expect(rebind).toHaveText("M");
});
test("routes, loading and repeated scene teardown remain usable by keyboard", async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 1200, height: 850 });
  await page.goto("/");
  await page.screenshot({ path: dir + "main-menu-polished.png" });
  await page.getByRole("link", { name: "Select Wizard" }).click();
  await page.getByRole("radio").first().press("Space");
  await page.screenshot({ path: dir + "character-selection-polished.png" });
  const devtools = await page.context().newCDPSession(page);
  const heap: number[] = [];
  const counters = [];
  for (let cycle = 0; cycle < 8; cycle++) {
    await page.getByRole("link", { name: "Home", exact: true }).click();
    if (!cycle)
      await page.route(
        "**/obsidian-dungeon.tmj",
        async (route) => {
          await new Promise((r) => setTimeout(r, 800));
          await route.continue();
        },
        { times: 1 },
      );
    await page.getByRole("link", { name: "Explore dungeon" }).click();
    if (!cycle) {
      await expect(page.getByLabel("Dungeon assets")).toBeVisible();
      await page.screenshot({ path: dir + "loading-screen.png" });
    }
    await expect(
      page.getByRole("button", { name: "Forsaken Entrance" }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Settings", exact: true }).click();
    await expect(page.locator("canvas")).toHaveCount(0);
    // Phaser disposes on its next frame; let crossfades and queued frames finish before GC.
    await page.evaluate(() => new Promise((r) => setTimeout(r, 450)));
    await devtools.send("HeapProfiler.collectGarbage");
    counters.push(await devtools.send("Memory.getDOMCounters"));
    heap.push((await devtools.send("Runtime.getHeapUsage")).usedSize);
  }
  await writeFile(
    dir + "navigation-memory.json",
    JSON.stringify(
      { cycles: heap.length, heapAfterGC: heap, counters },
      null,
      2,
    ) + "\n",
  );
});
test("account, inventory and quest panels present settled database content", async ({
  page,
}) => {
  test.skip(!process.env.TEST_DATABASE_URL, "Requires isolated database");
  for (const [path, name, ready] of [
    ["profile", "profile-polished", "wallet-coins"],
    ["store", "store-polished", "wallet-coins"],
    ["vault", "vault-polished", "wallet-coins"],
  ] as const) {
    await page.goto("/" + path);
    if (path === "vault")
      await expect(page.getByLabel("Skill 3 (R)")).toBeVisible();
    else await expect(page.getByTestId(ready)).toBeVisible();
    await page.screenshot({ path: dir + name + ".png" });
  }
  await page.goto("/quests");
  for (const group of ["Daily", "Weekly"]) {
    const panel = page.getByRole("region", { name: group + " quests" });
    await expect(panel).toBeVisible();
    await panel.screenshot({
      path: dir + group.toLowerCase() + "-quests-polished.png",
    });
  }
});
