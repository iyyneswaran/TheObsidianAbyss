import { randomBytes } from "node:crypto";
import { Client, type Room } from "@colyseus/sdk";
import { bodyAt, type CombatEvent, type CombatRun } from "@obsidian/game-core";
import {
  CoopState,
  type PartyRequest,
  type PartySeat,
} from "@obsidian/shared/coop";
import { expect, it } from "vitest";
import { createApi } from "../../api/src/app.js";
import { createGameServer } from "../src/server.js";

type Socket = Room<unknown, CoopState>;
const origin = "http://localhost:5173";
const wait = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

it("replicates real multiplayer casts and healing, rejects forged state, and preserves dead and protected seats", async () => {
  const secret = randomBytes(32).toString("hex");
  const api = createApi(origin, false, secret);
  const game = createGameServer(false, {
    secret,
    webOrigin: origin,
    recoverySeconds: 5,
    dropLimit: 2,
  });
  const sockets: Socket[] = [];
  try {
    const apiUrl = await api.listen({ port: 0, host: "127.0.0.1" });
    await game.server.listen(0, "127.0.0.1");
    const address = game.transport.server?.address();
    if (!address || typeof address === "string")
      throw new Error("Missing loopback server.");
    const gameUrl = "http://127.0.0.1:" + address.port;
    const createGuest = async () => {
      const response = await fetch(apiUrl + "/session/guest", {
        method: "POST",
        headers: { origin },
      });
      expect(response.status).toBe(204);
      return {
        origin,
        cookie: response.headers.get("set-cookie")!.split(";")[0]!,
      };
    };
    const connect = async (
      headers: Awaited<ReturnType<typeof createGuest>>,
      request: PartyRequest,
    ) => {
      const response = await fetch(gameUrl + "/party/connect", {
        method: "POST",
        headers: { ...headers, "content-type": "application/json" },
        body: JSON.stringify(request),
      });
      expect(response.status).toBe(200);
      const seat = (await response.json()) as PartySeat;
      const socket = await new Client(gameUrl.replace("http", "ws"), {
        headers,
      }).consumeSeatReservation<CoopState>(seat, CoopState);
      sockets.push(socket);
      const events: CombatEvent[] = [];
      socket.onMessage("combat", (event: CombatEvent) => events.push(event));
      const errors: string[] = [];
      socket.onMessage("party_error", ({ message }) => errors.push(message));
      socket.onMessage("cast_rejected", ({ message }) => errors.push(message));
      await expect
        .poll(() => socket.state.players.has(seat.playerId))
        .toBe(true);
      return { socket, seat, events, errors };
    };

    const cookies = await Promise.all(Array.from({ length: 5 }, createGuest));
    const fire = await connect(cookies[0]!, {
      action: "create",
      wizard: "fire",
    });
    const code = fire.seat.code;
    const ice = await connect(cookies[1]!, {
      action: "join",
      code,
      wizard: "ice",
    });
    const healer = await connect(cookies[2]!, {
      action: "join",
      code,
      wizard: "healer",
    });
    const tank = await connect(cookies[3]!, {
      action: "join",
      code,
      wizard: "defense",
    });
    const outsider = await connect(cookies[4]!, {
      action: "create",
      wizard: "wind",
    });
    await expect.poll(() => fire.socket.state.players.size).toBe(4);
    fire.socket.send("start", { confirmIncomplete: false });
    outsider.socket.send("start", { confirmIncomplete: true });
    for (const { socket } of [fire, ice, healer, tank, outsider])
      await expect.poll(() => socket.state.phase).toBe("ACTIVE");

    const run = (
      game.directory.rooms.get(code) as unknown as { run: CombatRun }
    ).run;
    const shadow = () =>
      [...fire.socket.state.combat.enemies.entries()].find(
        ([, enemy]) => enemy.kind === "shadow",
      );
    await expect.poll(() => Boolean(shadow())).toBe(true);
    const [enemyId, enemy] = shadow()!;
    const first = enemy.hp;
    fire.socket.send("cast", {
      slot: "BASIC",
      sequence: 1,
      x: enemy.x,
      y: enemy.y,
    });
    await expect
      .poll(() => ice.socket.state.combat.enemies.get(enemyId)?.hp)
      .toBeLessThan(first);
    const frostStart = ice.socket.state.players.get(ice.seat.playerId)!.mp;
    ice.socket.send("cast", {
      slot: "SKILL_1",
      sequence: 1,
      x: enemy.x,
      y: enemy.y,
    });
    await expect
      .poll(() => tank.socket.state.combat.enemies.get(enemyId)?.statuses)
      .toContain("Frozen");
    expect(ice.socket.state.players.get(ice.seat.playerId)!.mp).toBe(
      frostStart - 11,
    );
    expect(outsider.socket.state.combat.enemies.get(enemyId)).not.toBe(enemy);
    expect(
      outsider.events.every(({ source }) => source !== fire.seat.playerId),
    ).toBe(true);

    fire.socket.send("setEnemyHP", { id: enemyId, hp: 0 });
    fire.socket.send("setMana", { mp: 999 });
    fire.socket.send("setHP", { hp: 999 });
    fire.socket.send("killBoss", { phase: 3 });
    fire.socket.send("interact", {});
    for (const payload of [
      { slot: "SKILL_2", sequence: 2, x: enemy.x, y: enemy.y, damage: 900 },
      {
        slot: "SKILL_2",
        sequence: 2,
        x: enemy.x,
        y: enemy.y,
        playerId: ice.seat.playerId,
      },
      { slot: "FREEZE", sequence: 2, x: enemy.x, y: enemy.y },
      { slot: "SKILL_2", sequence: 2, x: 99999, y: Infinity },
      { slot: "SKILL_2", sequence: 1, x: enemy.x, y: enemy.y },
    ])
      fire.socket.send("cast", payload);
    await expect.poll(() => fire.errors.length).toBeGreaterThanOrEqual(10);
    expect(fire.socket.state.combat.phase).toBe(0);
    expect(fire.socket.state.combat.result).toBe("");
    expect(fire.socket.state.players.get(fire.seat.playerId)!.mp).toBe(105);
    expect(shadow()?.[1].hp).toBeGreaterThan(0);

    const fireActor = run.players.get(fire.seat.playerId)!;
    const healerActor = run.players.get(healer.seat.playerId)!;
    const tankActor = run.players.get(tank.seat.playerId)!;
    await expect
      .poll(() => fireActor.hp, { timeout: 10000 })
      .toBeLessThan(fireActor.maxHp);
    const injured = fireActor.hp;
    healer.socket.send("cast", {
      slot: "SKILL_2",
      sequence: 1,
      x: healerActor.body.x,
      y: healerActor.body.y,
    });
    await expect
      .poll(() => ice.socket.state.players.get(fire.seat.playerId)!.hp)
      .toBeGreaterThan(injured);
    await expect
      .poll(() =>
        healer.events.some(
          ({ kind, amount }) => kind === "heal" && Boolean(amount),
        ),
      )
      .toBe(true);
    expect(tankActor.hp).toBe(tankActor.maxHp);

    tank.socket.send("cast", {
      slot: "SKILL_1",
      sequence: 1,
      x: tankActor.body.x,
      y: tankActor.body.y,
    });
    await expect
      .poll(() => fire.socket.state.players.get(tank.seat.playerId)!.statuses)
      .toContain("Shielded");
    Object.assign(tankActor.body, bodyAt({ x: 2050, y: 512 }));
    tank.socket.reconnection.enabled = false;
    await tank.socket.leave(false);
    await expect
      .poll(() => fire.socket.state.players.get(tank.seat.playerId)!.connection)
      .toBe("DISCONNECTED_PROTECTED");
    const healthOnDrop = tankActor.hp;
    const manaOnDrop = tankActor.mp;
    const shieldOnDrop = tankActor.statuses.get("Shielded")?.remaining;
    const cooldownOnDrop = tankActor.cooldowns.SKILL_1;
    await wait(1250);
    expect(tankActor.hp).toBe(healthOnDrop);
    expect(tankActor.mp).toBe(manaOnDrop);
    expect(tankActor.statuses.get("Shielded")?.remaining).toBe(shieldOnDrop);
    expect(tankActor.cooldowns.SKILL_1).toBe(cooldownOnDrop);
    const resumed = await connect(cookies[3]!, { action: "reconnect", code });
    expect(resumed.seat.playerId).toBe(tank.seat.playerId);
    expect(resumed.socket.state.players.size).toBe(4);
    expect(resumed.socket.state.players.get(tank.seat.playerId)!.mp).toBe(
      manaOnDrop,
    );
    expect(resumed.socket.state.players.get(tank.seat.playerId)!.hp).toBe(
      healthOnDrop,
    );
    expect(tankActor.cooldowns.SKILL_1).toBeLessThanOrEqual(cooldownOnDrop);

    for (const actor of run.players.values())
      Object.assign(actor.body, bodyAt({ x: 2050, y: 512 }));
    // Advance only the legitimate hazard simulation instead of sleeping through 22 seconds of lava damage.
    for (let tick = 0; tick < 740; tick++) run.step(1000 / 30);
    await expect.poll(() => fire.socket.state.phase).toBe("ENDED");
    for (const { socket } of [fire, ice, healer, resumed]) {
      await expect.poll(() => socket.state.combat.result).toContain("DEFEAT");
      expect(
        [...socket.state.players.values()].every(({ life }) => life === "DEAD"),
      ).toBe(true);
    }
    expect(fire.events.filter(({ kind }) => kind === "outcome")).toHaveLength(
      1,
    );
    expect(outsider.socket.state.phase).toBe("ACTIVE");
  } finally {
    await Promise.allSettled(
      sockets
        .filter((socket) => socket.connection.isOpen)
        .map((socket) => socket.leave(true)),
    );
    await game.server.gracefullyShutdown(false);
    await api.close();
  }
}, 25_000);
