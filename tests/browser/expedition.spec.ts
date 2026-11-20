import { expect, test, type Page } from "@playwright/test";
import { writeFile } from "node:fs/promises";
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
) {
  const url = new URL(
    "http://127.0.0.1:" + process.env.COMBAT_FIXTURE_PORT + "/stage",
  );
  const r = await t.leader.request.post(url.href, {
    params: { team: t.code, area, ...params },
    headers: { "x-combat-fixture-key": process.env.COMBAT_FIXTURE_KEY! },
  });
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
    if (state.phase) phases.add(state.phase);
    const enemy = state.mobs.find((m) => m.encounter === encounter);
    if (!enemy) return phases;
    await fixture(t, enemy.id);
    const living = t.pages.filter(
      (_, i) => state.team.find((s) => s.slot === i)?.hp,
    );
    expect(living.length).toBeGreaterThan(0);
    await Promise.all(
      living.map(async (p) => {
        const canvas = p.getByTestId("online-stage").locator("canvas");
        await canvas.click({ position: { x: 145, y: 130 }, force: true });
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
  const loaded = await leader.evaluate(() =>
    performance
      .getEntriesByType("resource")
      .filter((e) => e.name.includes("/assets/"))
      .map((e) => ({
        bytes: (e as PerformanceResourceTiming).transferSize,
        duration: e.duration,
      })),
  );
  const firstTick = (await inspect(t)).tick;
  const clockStarted = Date.now();
  const cdp = await leader.context().newCDPSession(leader);
  let bytes = 0,
    frames = 0;
  await cdp.send("Network.enable");
  cdp.on("Network.webSocketFrameReceived", (e) => {
    bytes +=
      e.response.opcode === 2
        ? Buffer.from(e.response.payloadData, "base64").length
        : Buffer.byteLength(e.response.payloadData);
    frames++;
  });
  await leader.bringToFront();
  await leader.keyboard.press("F3");
  await leader.getByTestId("online-stage").locator("canvas").hover();
  await leader.mouse.wheel(0, 120);
  const initial = await inspect(t);
  await leader.keyboard.down("d");
  await wait(260);
  await leader.keyboard.up("d");
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
          await capture(leader, "objective-tracker");
        }
        await leader.keyboard.press("m");
      }
    }
    const zone = (await inspect(t)).view.title;
    const reconnect = i === 0 && t.pages.length === 2;
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
      await page
        .getByRole("button", { name: "Reconnect", exact: true })
        .click();
      await expect(page.getByTestId("online-stage")).toHaveAttribute(
        "data-ready",
        "true",
      );
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
              if (i === 0) await verifyAccount(p, user, password, true, false);
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
          }
        }
      } finally {
        await close(t.contexts);
      }
    },
  );
