import { createServer } from "node:http";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDatabase, ProgressionOutbox } from "@obsidian/progression";
import { isolatedTestDatabase } from "../../../tests/fixtures/progression.js";
import {
  bodyAt,
  center,
  clearSight,
  safePoint,
  type CombatRun,
  type WorldPoint,
} from "@obsidian/game-core";
import { readConfig } from "../src/config/env.js";
// The staging controller remains outside both production images and listeners.
const serverModule =
  process.env.M7_PRODUCTION === "1" ? "../dist/server.js" : "../src/server.js";
const { createGameServer } = (await import(
  serverModule
)) as typeof import("../src/server.js");

if (process.env.NODE_ENV !== "test" || !process.env.COMBAT_FIXTURE_KEY)
  throw new Error("The Playwright harness is available only in test runs.");

const env = readConfig();
const url = isolatedTestDatabase();
const db = url ? createDatabase(url) : undefined;
const progression = db
  ? {
      db,
      outbox: new ProgressionOutbox(
        db,
        await mkdtemp(join(tmpdir(), "obsidian-test-outbox-")),
      ),
    }
  : undefined;
const { server, directory } = createGameServer(true, {
  ...(progression ? { progression } : {}),
  secret: process.env.GUEST_SESSION_SECRET!,
  webOrigin: env.WEB_ORIGIN,
  recoverySeconds: env.PARTY_RECOVERY_SECONDS,
  dropLimit: env.PARTY_DROP_LIMIT,
});

const stages = [
  "boss-party",
  "entrance-fight",
  "guard",
  "approach",
  "bridge-entry",
  "bridge",
  "shrine",
  "arena-shrine",
  "gate",
  "boss",
  "mage",
  "guard-fight",
  "lava",
] as const;
type Stage = (typeof stages)[number];

function pointFor(
  run: CombatRun,
  stage: Stage,
  slot = 0,
): WorldPoint | undefined {
  if (stage === "guard") return { x: 1808, y: 626 };
  if (stage === "approach") return { x: 1112, y: 1358 };
  if (stage === "bridge-entry") return { x: 1968, y: 555 };
  if (stage === "bridge") return { x: 2049, y: 555 };
  if (stage === "shrine") return { x: 1239, y: 1426 };
  if (stage === "arena-shrine") return { x: 2123, y: 1674 };
  if (stage === "gate") return center(run.encounters.gate);
  if (stage === "lava") return { x: 2050, y: 512 };
  const target = [...run.monsters.values()].find(
    ({ kind }) =>
      kind ===
      (stage === "mage"
        ? "mage"
        : stage === "entrance-fight"
          ? "shadow"
          : stage === "guard-fight"
            ? "lava"
            : "overlord"),
  );
  if (!target) return undefined;
  const rangedParty =
    stage === "boss-party" || stage === "guard-fight" || stage === "mage";
  const options = rangedParty
    ? Array.from({ length: 24 }, (_, i) => {
        const angle =
          ((i + slot * 6 + Math.floor(run.time / 570)) * Math.PI) / 12;
        const radius = slot === 3 ? 55 : 150;
        return { x: radius * Math.cos(angle), y: radius * Math.sin(angle) };
      })
    : [
        { x: 42, y: 0 },
        { x: -43, y: 0 },
        { x: 0, y: 44 },
        { x: 0, y: -47 },
        { x: 37, y: 40 },
        { x: -42, y: -37 },
        { x: 83, y: 0 },
        { x: -83, y: 0 },
        { x: 0, y: 83 },
        { x: 0, y: -83 },
      ];
  const reachable = options
    .slice(slot)
    .concat(options.slice(0, slot))
    .map(({ x, y }) => ({ x: target.body.x + x, y: target.body.y + y }))
    .filter(
      (p) => safePoint(run.map, p) && clearSight(run.map, p, target.body),
    );
  if (stage !== "boss" && !rangedParty) return reachable[0];
  return (
    reachable.find((p) =>
      [...run.areas.values()].every((area) => {
        if (!area.hostile) return true;
        if (!area.width)
          return (
            Math.hypot(p.x - area.point.x, p.y - area.point.y) > area.radius + 9
          );
        const dx = p.x - area.origin.x;
        const dy = p.y - area.origin.y;
        const aligned = dx * Math.cos(area.angle) + dy * Math.sin(area.angle);
        const across = dx * Math.sin(area.angle) - dy * Math.cos(area.angle);
        return (
          aligned < 0 ||
          aligned > area.radius ||
          Math.abs(across) > area.width / 2 + 7
        );
      }),
    ) ?? reachable[0]
  );
}

// The production entry point never imports this server. Staging moves test
// actors into reach and leaves the real simulator responsible for all outcomes.
const controlledRooms = new WeakSet<object>();
const fixture = createServer((req, reply) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  if (
    req.method !== "POST" ||
    url.pathname !== "/stage" ||
    req.headers["x-combat-fixture-key"] !== process.env.COMBAT_FIXTURE_KEY
  ) {
    reply.writeHead(404).end();
    return;
  }
  const stage = stages.find((item) => item === url.searchParams.get("area"));
  const room = directory.rooms.get(url.searchParams.get("team") ?? "");
  const run = (room as unknown as { run?: CombatRun } | undefined)?.run;
  if (run?.expedition) {
    const world = run.expedition;
    const action = url.searchParams.get("area") ?? "";
    if (action === "inspect") {
      reply.writeHead(200, { "content-type": "application/json" }).end(
        JSON.stringify({
          view: world.view(),
          time: run.time,
          tick: room!.state.tick,
          timing: room!.timingSample(),
          phase: run.bossPhase,
          mobs: [...run.monsters.values()]
            .filter((m) => !m.lifetime)
            .map((m) => ({ hp: m.hp, id: m.id, encounter: m.encounter })),
          team: [...run.players.values()].map((p) => ({
            slot: p.slot,
            id: p.id,
            hp: p.hp,
            mp: p.mp,
            x: p.body.x,
            y: p.body.y,
          })),
        }),
      );
      return;
    }
    if (action === "advance") {
      const ticks = Number(url.searchParams.get("ticks"));
      if (!Number.isInteger(ticks) || ticks < 1 || ticks > 600) {
        reply.writeHead(400).end();
        return;
      }
      for (let i = 0; i < ticks && !run.ended; i++) run.step(1000 / 30);
      reply.writeHead(200).end();
      return;
    }
    if (run.ended) {
      reply.writeHead(409).end();
      return;
    }
    const marker = world.objects.find((z) => z.id === action);
    const target = [...run.monsters.values()].find((m) => m.id === action);
    if (marker || target) {
      if (
        marker &&
        (world.objects.some(
          (r) =>
            r.properties.secret &&
            (r.id === marker.id || r.id === marker.properties.room) &&
            !world.secrets.has(r.id),
        ) ||
          ((marker.properties.room === "shadow-throne" ||
            marker.id === "shadow-throne") &&
            !run.encounters.bossStarted))
      ) {
        reply.writeHead(409).end();
        return;
      }
      for (const p of run.players.values()) {
        const slot = url.searchParams.get("slot");
        if (
          p.life !== "ALIVE" ||
          p.protected ||
          p.forfeited ||
          (slot !== null && Number(slot) !== p.slot)
        )
          continue;
        let point;
        if (marker) {
          const c = center(marker);
          const dx = slot === null ? (p.slot % 2) * 16 : 0,
            dy = slot === null ? Math.floor(p.slot / 2) * 12 : 0;
          point = { x: c.x + dx, y: c.y + dy };
          if (
            marker.kind === "lava_hazard" ||
            marker.kind === "flame_vent" ||
            marker.kind === "arcane_trap"
          )
            point = c;
          else if (!safePoint(run.map, point)) {
            reply.writeHead(409).end();
            return;
          }
        } else if (target) {
          // Keep a clear firing lane while allowing the live AI to attack and telegraph normally.
          const choices = Array.from({ length: 32 }, (_, i) => {
            const a =
              ((i + p.slot * 5 + Math.floor(run.time / 380)) * Math.PI) / 16;
            return {
              x: target.body.x + Math.cos(a) * 183,
              y: target.body.y + Math.sin(a) * 183,
            };
          }).filter(
            (q) => safePoint(run.map, q) && clearSight(run.map, q, target.body),
          );
          point =
            choices.find((q) =>
              [...run.areas.values()].every(
                (a) =>
                  !a.hostile ||
                  Math.hypot(a.point.x - q.x, a.point.y - q.y) > a.radius + 12,
              ),
            ) ?? choices[0];
        }
        if (!point) {
          reply.writeHead(409).end();
          return;
        }
        Object.assign(p.body, bodyAt(point));
      }
      reply.writeHead(200).end();
      return;
    }
    reply.writeHead(409).end();
    return;
  }
  // In the reward scenario, browser scheduling must not advance an unattended
  // fight. Keep the room clock and real socket patches active for settlement.
  const control = url.searchParams.get("area");
  const simulator = room as unknown as { simulate(): void };
  if (room && run && control === "manual-clock" && !run.ended) {
    room.setSimulationInterval(() => {}, 1000 / 30);
    controlledRooms.add(room);
    reply.writeHead(200).end();
    return;
  }
  if (room && controlledRooms.has(room) && control === "step-clock") {
    const ticks = Number(url.searchParams.get("ticks"));
    if (!Number.isInteger(ticks) || ticks < 1 || ticks > 90) {
      reply.writeHead(400).end();
      return;
    }
    for (let i = 0; i < ticks; i++) simulator.simulate();
    reply.writeHead(200).end();
    return;
  }
  if (!run || !stage || run.result) {
    reply.writeHead(409).end();
    return;
  }
  const point = pointFor(run, stage!);
  if (!point) {
    reply.writeHead(409).end();
    return;
  }
  const slot = url.searchParams.get("slot");
  for (const player of run.players.values()) {
    if (slot !== null && String(player.slot) !== slot) continue;
    if (player.life !== "ALIVE" || player.protected || player.forfeited)
      continue;
    const spread =
      slot === null && stage !== "lava" ? (player.slot % 2) * 17 : 0;
    const next = {
      x: point.x + spread,
      y: point.y + (slot === null && player.slot >= 2 ? 15 : 0),
    };
    Object.assign(
      player.body,
      bodyAt(
        stage === "boss" ||
          stage === "boss-party" ||
          stage === "guard-fight" ||
          stage === "mage"
          ? (pointFor(run, stage, player.slot) ?? next)
          : next,
      ),
    );
  }
  if (room && controlledRooms.has(room)) simulator.simulate();
  reply.writeHead(200, { "content-type": "application/json" }).end(
    JSON.stringify(
      [...run.players.values()].map(({ slot, hp, body }) => ({
        slot,
        hp,
        x: body.x,
        y: body.y,
      })),
    ),
  );
});

fixture.listen(Number(process.env.COMBAT_FIXTURE_PORT), "127.0.0.1");
await server.listen(env.GAME_PORT, "127.0.0.1");
