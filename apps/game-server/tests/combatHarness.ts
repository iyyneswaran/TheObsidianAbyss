// Polyfill WebSocket for Node < 21 (Colyseus Room internals reference the global)
import ws from "ws";
if (typeof globalThis.WebSocket === "undefined") {
  // @ts-expect-error ws is compatible enough for Colyseus constants
  globalThis.WebSocket = ws;
}

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
import { createGameServer } from "../src/server.js";

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
  "entrance-fight",
  "guard",
  "approach",
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
  const options = [
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
  if (stage !== "boss") return reachable[0];
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
  if (!run || !stage || run.result) {
    reply.writeHead(409).end();
    return;
  }
  const point = pointFor(run, stage);
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
      bodyAt(stage === "boss" ? pointFor(run, stage, player.slot)! : next),
    );
  }
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
