import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { monitorEventLoopDelay } from "node:perf_hooks";
import { setTimeout as wait } from "node:timers/promises";
import { Client, type Room } from "@colyseus/sdk";
import { createDatabase, ProgressionOutbox } from "@obsidian/progression";
import {
  CoopState,
  type PartyRequest,
  type PartySeat,
} from "@obsidian/shared/coop";
import { createGuestSessions } from "@obsidian/shared/guest";
import { createApi } from "../../api/src/app.js";
import { isolatedTestDatabase } from "../../../tests/fixtures/progression.js";
import { createGameServer } from "../src/server.js";

type Socket = Room<unknown, CoopState>;
const origin = "http://localhost:5180";
const secret = randomBytes(32).toString("hex");
const guests = createGuestSessions(secret);
const database = isolatedTestDatabase();
assert(database, "Load testing requires the isolated release database");
const duration = Number(process.env.M8_LOAD_SECONDS ?? 10);
assert(Number.isInteger(duration) && duration >= 5 && duration <= 600);
const outboxPath = await mkdtemp(join(tmpdir(), "obsidian-load-"));
const db = createDatabase(database);
const api = createApi(origin, false, secret, database);
const game = createGameServer(false, {
  secret,
  webOrigin: origin,
  recoverySeconds: 5,
  dropLimit: 3,
  progression: { db, outbox: new ProgressionOutbox(db, outboxPath) },
});
const sockets = new Set<Socket>();
const loop = monitorEventLoopDelay({ resolution: 10 });

async function until(check: () => boolean, label: string) {
  const deadline = performance.now() + 8000;
  while (!check()) {
    assert(performance.now() < deadline, label);
    await wait(25);
  }
}

try {
  const address = await api.listen({ port: 0, host: "127.0.0.1" });
  assert.equal((await fetch(address + "/health/database")).status, 200);
  const issuance = await fetch(address + "/session/guest", {
    method: "POST",
    headers: { origin },
  });
  assert.equal(issuance.status, 204);
  assert(issuance.headers.has("set-cookie"));
  await game.server.listen(0, "127.0.0.1");
  const listener = game.transport.server?.address();
  assert(
    listener && typeof listener === "object",
    "Game must listen on loopback",
  );
  const endpoint = `http://127.0.0.1:${listener.port}`;
  async function client(request: PartyRequest, existingCookie?: string) {
    // Provision synthetic guests for this isolated server. Public issuance
    // remains rate limited, and all room entry checks still run normally.
    const guest =
      existingCookie ?? guests.issue(undefined, false).split(";")[0]!;
    const headers = { origin, cookie: guest };
    const response = await fetch(endpoint + "/party/connect", {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify(request),
    });
    assert.equal(response.status, 200, "Private seat request failed");
    const seat = (await response.json()) as PartySeat;
    const room = await new Client(endpoint.replace("http:", "ws:"), {
      headers,
    }).consumeSeatReservation<CoopState>(seat, CoopState);
    sockets.add(room);
    room.onMessage("*", () => {});
    await until(
      () => room.state.players.has(seat.playerId),
      "Room did not replicate seat",
    );
    return { room, seat, guest };
  }

  const report = [];
  for (const [roomCount, size] of [
    [1, 1],
    [1, 4],
    [4, 4],
    [8, 4],
    [16, 4],
  ] as const) {
    const teams = [];
    // Admit a few rooms at once so the workload measures active simulation,
    // rather than exhausting the database pool during warmup.
    for (let first = 0; first < roomCount; first += 4) {
      const batch = await Promise.allSettled(
        Array.from({ length: Math.min(4, roomCount - first) }, async () => {
          const leader = await client({
            action: "create",
            wizard: "lightning",
            dungeon: "expedition",
          });
          const peers = [];
          for (let index = 1; index < size; index++)
            peers.push(
              await client({
                action: "join",
                wizard: "lightning",
                code: leader.seat.code,
              }),
            );
          return [leader, ...peers];
        }),
      );
      for (const result of batch) {
        if (result.status === "rejected") throw result.reason;
        teams.push(result.value);
      }
    }
    const clients = teams.flat();
    for (const [leader] of teams)
      leader!.room.send("start", { confirmIncomplete: true });
    await until(
      () => clients.every(({ room }) => room.state.phase === "ACTIVE"),
      "Rooms did not start",
    );
    for (const team of teams) {
      const ids = team.map(({ seat }) => seat.playerId);
      assert.equal(new Set(ids).size, size);
      for (const { room } of team)
        assert.deepEqual(
          [...room.state.players.keys()].sort(),
          [...ids].sort(),
        );
    }
    const probes = teams.map(([leader]) => leader!);
    const initialTicks = probes.map(({ room }) => room.state.tick);
    let patches = 0;
    let combat = 0;
    let maxProjectiles = 0;
    for (const { room } of probes) {
      room.onStateChange(() => {
        patches++;
        maxProjectiles = Math.max(
          maxProjectiles,
          room.state.combat.projectiles.size,
        );
      });
      room.onMessage("combat", () => combat++);
    }
    const started = performance.now();
    const cpu = process.cpuUsage();
    const initialRss = process.memoryUsage().rss;
    loop.reset();
    loop.enable();
    let sequence = 0;
    for (; performance.now() - started < duration * 1000;) {
      sequence++;
      for (const { room } of clients) {
        room.send("move", {
          sequence,
          horizontal: sequence % 20 < 10 ? 1 : -1,
          vertical: 0,
        });
        if (sequence % 9 === 2)
          room.send("cast", { sequence, slot: "BASIC", x: 900, y: 520 });
      }
      await wait(95);
    }
    const elapsed = (performance.now() - started) / 1000;
    loop.disable();
    const usage = process.cpuUsage(cpu);
    const tickRates = probes.map(
      ({ room }, index) => (room.state.tick - initialTicks[index]!) / elapsed,
    );
    assert(tickRates.every((rate) => rate > 0));
    const timing = [...game.directory.rooms.values()].map((room) =>
      room.timingSample(),
    );
    const stats = {
      roomCount,
      size,
      participants: clients.length,
      seconds: elapsed,
      minTickHz: Math.min(...tickRates),
      maxTickHz: Math.max(...tickRates),
      maxRoomStepP95Ms: Math.max(...timing.map((room) => room.stepMs.p95)),
      loopP95Ms: loop.percentile(95) / 1_000_000,
      loopP99Ms: loop.percentile(99) / 1_000_000,
      cpuCorePercent: (usage.user + usage.system) / (elapsed * 10000),
      initialRss,
      rss: process.memoryUsage().rss,
      observedPatchesPerSecondPerRoom: patches / elapsed / roomCount,
      combat,
      maxProjectiles,
    };
    assert(combat > 0, "Expected actual combat events under load");
    const first = clients[0]!;
    const player = first.room.state.players.get(first.seat.playerId)!;
    const hp = player.hp;
    const mp = player.mp;
    first.room.reconnection.enabled = false;
    await first.room.leave(false);
    sockets.delete(first.room);
    const reconnectStarted = performance.now();
    const restored = await client(
      { action: "reconnect", code: first.seat.code },
      first.guest,
    );
    assert.equal(restored.seat.playerId, first.seat.playerId);
    const restoredPlayer = restored.room.state.players.get(
      first.seat.playerId,
    )!;
    assert.equal(restoredPlayer.hp, hp);
    assert.equal(restoredPlayer.mp, mp);
    const reconnectMs = performance.now() - reconnectStarted;
    await restored.room.leave(true);
    sockets.delete(restored.room);
    await Promise.all(clients.slice(1).map(({ room }) => room.leave(true)));
    for (const { room } of clients) sockets.delete(room);
    await until(
      () => !game.directory.rooms.size,
      "Rooms were not disposed after leaving",
    );
    report.push({ ...stats, reconnectMs, disposed: true });
    console.log(JSON.stringify(report.at(-1)));
  }
  const output = resolve("../../artifacts/milestone-8");
  await mkdir(output, { recursive: true });
  await writeFile(
    join(output, "load.json"),
    JSON.stringify(
      { status: "PASS", platform: process.platform, workloads: report },
      null,
      2,
    ) + "\n",
  );
} finally {
  loop.disable();
  await Promise.allSettled([...sockets].map((room) => room.leave(true)));
  await game.server.gracefullyShutdown(false);
  await api.close();
  await rm(outboxPath, { recursive: true, force: true });
}
