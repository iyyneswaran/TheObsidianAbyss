import { mkdir, writeFile } from "node:fs/promises";
import { connect, createServer, type Socket } from "node:net";
import { once } from "node:events";
import { expect, test } from "@playwright/test";
import { close, getTeam } from "../fixtures/team.js";

test("TCP latency, jitter and interruption preserve authoritative movement and identity", async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(180000);
  let leg = 0;
  let outage = false;
  let chunks = 0;
  let bytes = 0;
  const active = new Set<Socket>();
  function relay(source: Socket, destination: Socket, inbound: boolean) {
    const timers = new Set<ReturnType<typeof setTimeout>>();
    let due = 0;
    let index = 0;
    source.on("data", (message) => {
      if (inbound) {
        chunks++;
        bytes += message.length;
      }
      if (!leg) {
        destination.write(message);
        return;
      }
      const jitter = [0, 8, -8, 4, -4][index++ % 5]!;
      const now = performance.now();
      due = Math.max(due, now + leg + jitter);
      const timer = setTimeout(() => {
        timers.delete(timer);
        destination.write(message);
      }, due - now);
      timers.add(timer);
    });
    source.on("error", () => destination.destroy());
    source.on("close", () => {
      for (const timer of timers) clearTimeout(timer);
      active.delete(source);
      destination.destroy();
    });
  }
  const proxy = createServer((browserSocket) => {
    if (outage) {
      browserSocket.destroy();
      return;
    }
    const server = connect(Number(process.env.GAME_PORT), "127.0.0.1");
    active.add(browserSocket);
    active.add(server);
    relay(browserSocket, server, false);
    relay(server, browserSocket, true);
  });
  proxy.listen(Number(process.env.M8_PROXY_PORT), "127.0.0.1");
  await once(proxy, "listening");
  let team: Awaited<ReturnType<typeof getTeam>> | undefined;
  try {
    team = await getTeam(
      browser,
      baseURL!,
      ["defense", "lightning"],
      undefined,
      "expedition",
    );
    const { leader } = team;
    await leader.bringToFront();
    const canvas = leader.getByTestId("online-stage").locator("canvas");
    const localId = await leader.getByTestId("debug-local-id").innerText();
    const position = (page: typeof leader) =>
      page
        .locator(`[data-player-id="${localId}"]`)
        .getByTestId("actor-position")
        .textContent();
    const peer = team.pages[1]!;
    const samples = [];
    for (const rtt of [50, 100, 200, 300]) {
      const initial = await position(leader);
      let remoteMs = 0;
      let visibleMs = 0;
      const started = performance.now();
      leg = rtt / 2;
      const chunksAtStart = chunks;
      const bytesAtStart = bytes;
      await leader.keyboard.down(rtt === 50 || rtt === 200 ? "d" : "a");
      try {
        await Promise.all([
          expect
            .poll(async () => await position(peer))
            .not.toBe(initial)
            .then(() => {
              remoteMs = performance.now() - started;
            }),
          expect
            .poll(async () => await position(leader))
            .not.toBe(initial)
            .then(() => {
              visibleMs = performance.now() - started;
            }),
        ]);
      } finally {
        await leader.keyboard.up(rtt === 50 || rtt === 200 ? "d" : "a");
      }
      await expect
        .poll(() => canvas.getAttribute("data-patch-hz"))
        .not.toBe("0");
      samples.push({
        rtt,
        minJitterMs: -8,
        maxJitterMs: 8,
        remoteMs,
        visibleMs,
        chunks: chunks - chunksAtStart,
        bytes: bytes - bytesAtStart,
        patchHz: Number(await canvas.getAttribute("data-patch-hz")),
      });
      await new Promise((resolve) => setTimeout(resolve, leg + 350));
    }
    const priorMp = await leader
      .getByTestId("local-mp")
      .getAttribute("data-value");
    await canvas.click();
    await leader.keyboard.press("q");
    await expect(leader.getByTestId("local-mp")).not.toHaveAttribute(
      "data-value",
      priorMp!,
    );
    outage = true;
    for (const connection of active) connection.destroy();
    const view = new URL(
      "http://127.0.0.1:" + process.env.COMBAT_FIXTURE_PORT + "/stage",
    );
    view.searchParams.set("team", team.code);
    view.searchParams.set("area", "inspect");
    const tick = async () =>
      (
        await leader.request.post(view.href, {
          headers: { "x-combat-fixture-key": process.env.COMBAT_FIXTURE_KEY! },
        })
      ).json() as Promise<{
        team: { id: string; protected: boolean; hp: number; mp: number }[];
      }>;
    await expect
      .poll(
        async () =>
          (await tick()).team.filter((player) => player.protected).length,
      )
      .toBe(2);
    const before = (await tick()).team.find((player) => player.id === localId)!;
    const started = performance.now();
    outage = false;
    await expect
      .poll(
        async () =>
          (await tick()).team.filter((player) => player.protected).length,
        { timeout: 20000 },
      )
      .toBe(0);
    const after = (await tick()).team.find((player) => player.id === localId)!;
    expect(after.hp).toBe(before.hp);
    expect(after.mp).toBe(before.mp);
    await expect(leader.getByTestId("debug-local-id")).toHaveText(localId);
    await expect(leader.getByTestId("online-actor")).toHaveCount(2);
    await mkdir("artifacts/milestone-8", { recursive: true });
    await writeFile(
      "artifacts/milestone-8/network.json",
      JSON.stringify(
        {
          status: "PASS",
          engine: browser.version(),
          samples,
          reconnectMs: performance.now() - started,
        },
        null,
        2,
      ) + "\n",
    );
  } finally {
    if (team) await close(team.contexts);
    for (const connection of active) connection.destroy();
    proxy.close();
  }
});
