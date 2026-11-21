import { expect, test, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import type { ExpeditionView } from "../../packages/game-core/src/expedition.js";
import { getTeam, close } from "../fixtures/team.js";
import { verifyAccount } from "../fixtures/progressionJourney.js";

const dir = "artifacts/milestone-6/";
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
type Team = Awaited<ReturnType<typeof getTeam>>;
type State = {
  view: ExpeditionView;
  time: number;
  tick: number;
  timing: {
    count: number;
    stepMs: { median: number; p95: number };
    callbackLagMs: { median: number; p95: number };
  };
  phase: number;
  mobs: { id: string; encounter: string; hp: number }[];
  team: {
    id: string;
    slot: number;
    hp: number;
    mp: number;
    x: number;
    y: number;
  }[];
};
async function fixture(
  t: Team,
  area: string,
  params: Record<string, string> = {},
  allowVanishedTarget = false,
) {
  const url = new URL(
    "http://127.0.0.1:" + process.env.COMBAT_FIXTURE_PORT + "/stage",
  );
  const r = await t.leader.request.post(url.href, {
    params: { team: t.code, area, ...params },
    headers: { "x-combat-fixture-key": process.env.COMBAT_FIXTURE_KEY! },
  });
  if (!allowVanishedTarget || r.status() !== 409)
    expect(r.status(), area).toBe(200);
  return r;
}
async function inspect(t: Team): Promise<State> {
  return (await fixture(t, "inspect")).json();
}
async function advance(t: Team, ticks = 18) {
  await fixture(t, "advance", { ticks: String(ticks) });
}
async function mark(t: Team, id: string, slot?: number) {
  await fixture(t, id, slot === undefined ? {} : { slot: String(slot) });
  await wait(160);
}
async function use(t: Team, id: string) {
  await mark(t, id, 0);
  const r = (await inspect(t)).view.revision;
  await t.leader.bringToFront();
  await t.leader.keyboard.press("g");
  await expect
    .poll(async () => (await inspect(t)).view.revision, { message: id })
    .toBeGreaterThan(r);
}
async function capture(p: Page, name: string) {
  const stage = p.getByTestId("online-stage");
  await stage.scrollIntoViewIfNeeded();
  await wait(380);
  await stage.screenshot({ path: dir + name + ".png" });
}
async function fight(t: Team, encounter: string) {
  const phases = new Set<number>();
  for (let k = 0; k < 115; k++) {
    const state = await inspect(t);
    if (
      state.phase &&
      !phases.has(state.phase) &&
      t.pages.length === 4 &&
      !process.env.M7_PRODUCTION
    ) {
      const canvas = t.leader.getByTestId("online-stage").locator("canvas");
      const metrics = await canvas.evaluate((el) => ({ ...el.dataset }));
      await mkdir("artifacts/milestone-7", { recursive: true });
      await writeFile(
        "artifacts/milestone-7/boss-phase-" + state.phase + "-metrics.json",
        JSON.stringify({ metrics, timing: state.timing }, null, 2) + "\n",
      );
    }
    if (state.phase) phases.add(state.phase);
    const enemy = state.mobs.find((m) => m.encounter === encounter);
    if (!enemy) return phases;
    const staged = await fixture(t, enemy.id, {}, true);
    if (staged.status() === 409) {
      // A queued hit can remove this particular monster between inspection and staging.
      const latest = await inspect(t);
      expect(
        latest.mobs.some((m) => m.id === enemy.id),
        enemy.id + " still present after a staging conflict",
      ).toBe(false);
      continue;
    }
    const living = t.pages.filter(
      (_, i) => state.team.find((s) => s.slot === i)?.hp,
    );
    expect(living.length).toBeGreaterThan(0);
    await Promise.all(
      living.map(async (p) => {
        const canvas = p.getByTestId("online-stage").locator("canvas");
        await canvas.click({ position: { x: 145, y: 130 }, force: true });
        // Break a summoned pack surrounding the boss using the real area spells.
        if (encounter === "boss" && k > 24) {
          await p.keyboard.press("r");
          await p.keyboard.press("f");
        }
      }),
    );
    await wait(80);
    await advance(t, 16);
  }
  throw Error(
    "Encounter stalled " +
      encounter +
      " " +
      JSON.stringify((await inspect(t)).mobs),
  );
}
const route = [
  ["ruined-gateway", "fallen-barracks", "hall-of-ashes"],
  [
    "burning-corridor",
    "molten-guard-chamber",
    "furnace-vault",
    "bridge-of-embers",
  ],
  [
    "crypt-entrance",
    "chamber-of-echoes",
    "hall-of-the-restless",
    "the-sealed-tomb",
  ],
  [
    "corrupted-passage",
    "hall-of-broken-seals",
    "sanctuary-of-the-azure-flame",
    "shadow-gate-chamber",
  ],
  ["obsidian-antechamber", "court-of-lost-souls"],
];
const photos = [
  ["forsaken-entrance", "fallen-barracks", "hall-of-ashes"],
  [
    "molten-passages",
    "molten-guard-chamber",
    "furnace-vault",
    "bridge-of-embers",
  ],
  ["forgotten-crypt", "chamber-of-echoes", "", "sealed-tomb"],
  ["corrupted-sanctum", "", "azure-sanctuary", "shadow-gate"],
  ["obsidian-antechamber", ""],
];
const gates = [
  "forsaken-entrance_gate",
  "molten-passages_gate",
  "forgotten-crypt_gate",
  "corrupted-sanctum_gate",
  "shadow_gate",
];
const board = (p: Page) =>
  p.getByRole("complementary", { name: "Expedition map" });
async function journey(t: Team, full: boolean) {
  const { leader } = t;
  const samples = [];
  const benchmark =
    full &&
    process.env.M7_PRODUCTION !== "1" &&
    (process.env.M7_BENCH || "after");
  if (benchmark) {
    await leader.evaluate(() => {
      const gaps: number[] = [];
      Reflect.set(window, "benchmarkFrames", gaps);
      let previous = performance.now();
      function sample(now: number) {
        if (gaps.length < 60000) gaps.push(now - previous);
        previous = now;
        requestAnimationFrame(sample);
      }
      requestAnimationFrame(sample);
    });
  }
  const loaded = await leader.evaluate(() =>
    performance
      .getEntriesByType("resource")
      .filter((e) => e.name.includes("/assets/"))
      .map((e) => ({
        bytes: (e as PerformanceResourceTiming).transferSize,
        duration: e.duration,
      })),
  );
  if (t.pages.length === 1 && !process.env.M7_PRODUCTION) {
    const start = await inspect(t),
      begin = performance.now();
    const frames = await leader.evaluate(
      () =>
        new Promise<number[]>((resolve) => {
          const intervals: number[] = [];
          let previous = performance.now();
          const end = previous + 4000;
          function sample(time: number) {
            intervals.push(time - previous);
            previous = time;
            if (time >= end) resolve(intervals.sort((a, b) => a - b));
            else requestAnimationFrame(sample);
          }
          requestAnimationFrame(sample);
        }),
    );
    const end = await inspect(t);
    await writeFile(
      "artifacts/milestone-7/one-player-idle.json",
      JSON.stringify(
        {
          frames: frames.length,
          medianMs: frames[Math.floor(frames.length / 2)],
          p95Ms: frames[Math.floor(frames.length * 0.95)],
          tickHz:
            ((end.tick - start.tick) * 1000) / (performance.now() - begin),
          timing: end.timing,
        },
        null,
        2,
      ) + "\n",
    );
  }
  const firstTick = (await inspect(t)).tick;
  const clockStarted = Date.now();
  const cdp = await leader.context().newCDPSession(leader);
  const messageSizes: number[] = [],
    patchTimes: number[] = [];
  let outbound = 0;
  cdp.on("Network.webSocketFrameSent", () => outbound++);
  let bytes = 0,
    frames = 0;
  await cdp.send("Network.enable");
  cdp.on("Network.webSocketFrameReceived", (e) => {
    const size =
      e.response.opcode === 2
        ? Buffer.from(e.response.payloadData, "base64").length
        : Buffer.byteLength(e.response.payloadData);
    bytes += size;
    messageSizes.push(size);
    patchTimes.push(e.timestamp);
    frames++;
  });
  await leader.bringToFront();
  await leader.keyboard.press("F3");
  await leader.getByTestId("online-stage").locator("canvas").hover();
  await leader.mouse.wheel(0, 120);
  const initial = await inspect(t);
  await leader.keyboard.down("d");
  try {
    await expect
      .poll(async () => (await inspect(t)).team[0]!.x)
      .toBeGreaterThan(initial.team[0]!.x);
  } finally {
    await leader.keyboard.up("d");
  }
  expect((await inspect(t)).team[0]!.x).toBeGreaterThan(initial.team[0]!.x);
  await mark(t, gates[0]!, 0);
  await leader.keyboard.press("g");
  await expect(leader.getByTestId("cast-feedback")).toContainText(
    "remaining objectives",
  );
  for (const [i, rooms] of route.entries()) {
    for (const [j, room] of rooms.entries()) {
      await mark(t, room);
      const view = await inspect(t);
      await expect(board(leader)).toContainText(view.view.title);
      if (full && photos[i]![j]) await capture(leader, photos[i]![j]!);
      if (i === 0 && j === 0 && full)
        await capture(leader, "four-player-exploration");
      if (i === 1 && j === 1) {
        await mark(t, room + "_bridge", 0);
        const hp = (await inspect(t)).team[0]!.hp;
        await leader.keyboard.down("a");
        await wait(220);
        await leader.keyboard.up("a");
        await mark(t, room + "_lava", 0);
        await advance(t, 30);
        expect((await inspect(t)).team[0]!.hp).toBeLessThan(hp);
      }
      if (i === 3 && j === 2) {
        await leader.keyboard.press("r");
        await wait(140);
        const mp = (await inspect(t)).team[0]!.mp;
        await mark(t, room + "_shrine", 0);
        await advance(t, 60);
        expect((await inspect(t)).team[0]!.mp).toBeGreaterThan(mp);
      } else {
        if (full && room === "furnace-vault")
          await capture(leader, "elite-encounter");
        await fight(t, room + "_battle");
      }
      if (
        room === "fallen-barracks" ||
        room === "furnace-vault" ||
        room === "the-sealed-tomb" ||
        room === "hall-of-broken-seals"
      )
        await use(t, room + "_seal");
      if (room === "hall-of-broken-seals") await use(t, "eastern_seal");
      if ((i === 2 || i === 3) && j === 2) {
        const zone = (await inspect(t)).view.zone;
        await use(t, zone + "_hidden");
        await advance(t, 1);
        if (full && i === 2) await capture(leader, "secret-chamber");
        await use(t, zone + "_return");
      }
      if (i === 0 && j === 1) {
        await leader.keyboard.press("m");
        await expect(board(leader).getByRole("button")).toHaveAttribute(
          "aria-expanded",
          "true",
        );
        if (full) {
          await capture(leader, "minimap");
          await board(leader).screenshot({
            path: "artifacts/milestone-7/minimap-polished.png",
          });
          await capture(leader, "objective-tracker");
        }
        await leader.keyboard.press("m");
      }
    }
    const zone = (await inspect(t)).view.title;
    const reconnect =
      i === 0 &&
      (t.pages.length === 2 ||
        (t.pages.length === 4 && process.env.M7_PRODUCTION === "1"));
    const original = (await inspect(t)).team.find((p) => p.slot === 1);
    if (reconnect) {
      await t.pages[1]!.close();
      await expect(
        leader.getByTestId("party-member").filter({ hasText: /disconnected/i }),
      ).toHaveCount(1);
    }
    const started = Date.now();
    await use(t, gates[i]!);
    if (reconnect) {
      const page = await t.contexts[1]!.newPage();
      t.pages[1] = page;
      await page.goto("/party");
      await page.getByLabel("Team code").fill(t.code);
      const recoveryStarted = Date.now();
      await page
        .getByRole("button", { name: "Reconnect", exact: true })
        .click();
      await expect(page.getByTestId("online-stage")).toHaveAttribute(
        "data-ready",
        "true",
      );
      const readyMs = Date.now() - recoveryStarted;
      if (process.env.M7_PRODUCTION === "1") {
        await mkdir("artifacts/milestone-7", { recursive: true });
        await writeFile(
          "artifacts/milestone-7/reconnect.json",
          JSON.stringify({ seats: t.pages.length, readyMs }, null, 2) + "\n",
        );
      }
      const restored = (await inspect(t)).team.find((p) => p.slot === 1)!;
      expect(restored.id).toBe(original!.id);
      expect(restored.hp).toBe(original!.hp);
      expect(restored.x).toBeGreaterThan(2900);
      await mark(t, "burning-corridor_lava", 1);
      await advance(t, 570);
      await expect(page.getByTestId("spectator-mode")).toBeVisible();
      const before = (await inspect(t)).view.revision;
      await page.keyboard.press("g");
      await wait(120);
      expect((await inspect(t)).view.revision).toBe(before);
    }
    for (const page of t.pages)
      await expect(board(page)).toContainText((await inspect(t)).view.title);
    const transitionMs = Date.now() - started;
    const metrics = await leader
      .getByTestId("online-stage")
      .locator("canvas")
      .evaluate((e) => ({ ...e.dataset }));
    const heap = await cdp.send("Runtime.getHeapUsage");
    samples.push({
      timing: (await inspect(t)).timing,
      preloadResources: loaded.length,
      preloadBytes: loaded.reduce((n, e) => n + e.bytes, 0),
      longestAssetMs: Math.max(...loaded.map((e) => e.duration)),
      tickHz:
        (((await inspect(t)).tick - firstTick) * 1000) /
        (Date.now() - clockStarted),
      zone,
      transitionMs,
      metrics,
      heap: heap.usedSize,
      receivedBytes: bytes,
      network: {
        outbound,
        meanBytes: bytes / Math.max(1, frames),
        p95Bytes: [...messageSizes].sort((a, b) => a - b)[
          Math.floor(0.95 * frames)
        ],
        framesPerSecond:
          frames /
          Math.max(0.001, (patchTimes.at(-1) ?? 0) - (patchTimes[0] ?? 0)),
      },
      receivedFrames: frames,
    });
    if (full && i === 0) await capture(leader, "zone-transition");
  }
  if (full) await capture(leader, "shadow-throne");
  const phases = await fight(t, "boss");
  expect([...phases]).toEqual([1, 2, 3]);
  for (const p of t.pages)
    await expect(p.getByTestId("run-result")).toContainText(/Victory/i);
  if (full) {
    await leader
      .getByTestId("run-result")
      .screenshot({ path: dir + "victory-after-full-run.png" });
    await writeFile(
      dir + "performance.json",
      JSON.stringify(samples, null, 2) + "\n",
    );
  }
  if (benchmark) {
    const frame = await leader.evaluate(() => {
      const gaps = (Reflect.get(window, "benchmarkFrames") as number[]).sort(
        (a, b) => a - b,
      );
      return {
        count: gaps.length,
        medianMs: gaps[Math.floor(gaps.length * 0.5)],
        p95Ms: gaps[Math.floor(gaps.length * 0.95)],
      };
    });
    await mkdir("artifacts/milestone-7", { recursive: true });
    await writeFile(
      "artifacts/milestone-7/performance-" + benchmark + ".json",
      JSON.stringify({ frame, samples }, null, 2) + "\n",
    );
  }
  expect(t.errors).toEqual([]);
}
for (const seats of [1, 2, 4])
  test(
    "expedition reaches a real victory with " + seats + " browser seats",
    async ({ browser, baseURL }) => {
      test.setTimeout(780000);
      const db = Boolean(process.env.TEST_DATABASE_URL);
      const user = "exp_" + randomUUID().slice(0, 8),
        password = randomUUID();
      const t = await getTeam(
        browser,
        baseURL!,
        Array<string>(seats).fill("lightning"),
        db
          ? async (p, i) => {
              if (i === 0 || process.env.M7_PRODUCTION === "1")
                await verifyAccount(p, user + "_" + i, password, true, false);
              if (process.env.M7_SILENT === "1") {
                await p.goto("/settings");
                await p.getByLabel("Enable audio").uncheck();
              }
            }
          : undefined,
        "expedition",
      );
      try {
        await journey(t, seats === 4);
        if (db) {
          for (const p of t.pages) {
            await expect(p.getByTestId("run-result")).toContainText(
              /settled|saved/i,
              { timeout: 15000 },
            );
            await p
              .getByRole("button", { name: "Return to Private Teams" })
              .click();
            await p.goto("/profile");
            await expect(p.getByTestId("wallet-coins")).toHaveText(
              String(240 / seats),
            );
            await expect(p.getByTestId("wallet-gems")).toHaveText("3");
            await p.reload();
            await expect(p.getByTestId("profile-xp")).toHaveText("100");
            await p.goto("/quests");
            await expect(
              p
                .getByTestId("quest-card")
                .filter({ hasText: "Dungeon Explorer" })
                .getByTestId("quest-progress"),
            ).toHaveText("1 / 1");
            if (process.env.M7_PRODUCTION === "1") {
              await p.getByRole("link", { name: "Home", exact: true }).click();
              await expect(p.locator("canvas")).toHaveCount(0);
              await expect(
                p.getByRole("heading", { name: "The Obsidian Abyss" }),
              ).toBeVisible();
            }
          }
        }
      } finally {
        await close(t.contexts);
      }
    },
  );
