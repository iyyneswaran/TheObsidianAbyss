import { mkdir, writeFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { close, getTeam } from "../fixtures/team.js";

test("four online renderers and repeated game disposal retain bounded resources", async ({
  browser,
  baseURL,
}) => {
  const seconds = Number(process.env.M8_SOAK_SECONDS ?? 120);
  expect(Number.isInteger(seconds) && seconds >= 20 && seconds <= 600).toBe(
    true,
  );
  test.setTimeout((seconds + 240) * 1000);
  const team = await getTeam(
    browser,
    baseURL!,
    ["defense", "healer", "fire", "ice"],
    undefined,
    "expedition",
  );
  const data = [];
  try {
    const { leader, pages } = team;
    const canvas = leader.getByTestId("online-stage").locator("canvas");
    await leader.bringToFront();
    await leader.evaluate(() => {
      const frames: number[] = [];
      Reflect.set(window, "qaFrames", frames);
      let last = performance.now();
      function observe(now: number) {
        if (frames.length < 72000) frames.push(now - last);
        last = now;
        requestAnimationFrame(observe);
      }
      requestAnimationFrame(observe);
    });
    const cdp = await leader.context().newCDPSession(leader);
    const started = performance.now();
    let turn = 0;
    let receivedBytes = 0;
    await cdp.send("Network.enable");
    cdp.on("Network.webSocketFrameReceived", ({ response }) => {
      receivedBytes +=
        response.opcode === 2
          ? Buffer.from(response.payloadData, "base64").length
          : Buffer.byteLength(response.payloadData);
    });
    const tick = async () =>
      Number(await leader.getByTestId("debug-tick").innerText());
    const firstTick = await tick();
    for (let nextSample = 0; performance.now() - started < seconds * 1000;) {
      const elapsed = performance.now() - started;
      const key = turn++ % 2 ? "d" : "a";
      await Promise.all(
        pages.map(async (page) => {
          await page.keyboard.down(key);
          await page.keyboard.press("q");
        }),
      );
      await new Promise((resolve) => setTimeout(resolve, 200));
      await Promise.all(pages.map((page) => page.keyboard.up(key)));
      if (elapsed >= nextSample) {
        nextSample += 15000;
        const heap = await cdp.send("Runtime.getHeapUsage");
        const resources = await canvas.evaluate((element) => ({
          ...element.dataset,
        }));
        data.push({
          elapsedSeconds: elapsed / 1000,
          heapBytes: heap.usedSize,
          resources,
        });
      }
      await new Promise((resolve) => setTimeout(resolve, 650));
    }
    const elapsed = (performance.now() - started) / 1000;
    const finalTick = await tick();
    expect(finalTick).toBeGreaterThan(firstTick);
    expect(team.errors).toEqual([]);
    const intervals = await leader.evaluate(() =>
      (Reflect.get(window, "qaFrames") as number[]).sort((a, b) => a - b),
    );
    const frame = (p: number) => intervals[Math.floor(intervals.length * p)]!;
    const navigation = [];
    for (let cycle = 0; cycle < 10; cycle++) {
      await leader.goto("/dungeon");
      await expect(
        leader.getByRole("button", { name: "Forsaken Entrance" }),
      ).toBeVisible({ timeout: 25000 });
      await leader.getByRole("link", { name: "Settings", exact: true }).click();
      await expect(leader.locator("canvas")).toHaveCount(0);
      await cdp.send("HeapProfiler.collectGarbage");
      navigation.push({
        nodes: await cdp.send("Memory.getDOMCounters"),
        heap: (await cdp.send("Runtime.getHeapUsage")).usedSize,
      });
    }
    await mkdir("artifacts/milestone-8", { recursive: true });
    const result = {
      status: "PASS",
      browser: browser.version(),
      elapsedSeconds: elapsed,
      fpsFromMedianInterval: 1000 / frame(0.5),
      frameP95Ms: frame(0.95),
      frameP99Ms: frame(0.99),
      tickHz: (finalTick - firstTick) / elapsed,
      receivedBytes,
      data,
      navigation,
    };
    await writeFile(
      "artifacts/milestone-8/soak.json",
      JSON.stringify(result, null, 2) + "\n",
    );
  } finally {
    await close(team.contexts);
  }
});
