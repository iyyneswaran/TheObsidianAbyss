import { randomBytes } from "node:crypto";
import { Client, type Room } from "@colyseus/sdk";
import {
  CoopState,
  type PartyRequest,
  type PartySeat,
} from "@obsidian/shared/coop";
import { expect, it } from "vitest";
import { createApi } from "../../api/src/app.js";
import { createGameServer } from "../src/server.js";

const origin = "http://localhost:5173";
type CoopRoom = Room<unknown, CoopState>;
const pause = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

it("runs two isolated teams, enforces authority, and restores an owned seat on a real Colyseus socket", async () => {
  const secret = randomBytes(32).toString("hex");
  const api = createApi(origin, false, secret);
  const { server, transport, directory } = createGameServer(false, {
    secret,
    webOrigin: origin,
    recoverySeconds: 2,
    dropLimit: 2,
  });
  const sockets: CoopRoom[] = [];

  async function guest() {
    const reply = await api.inject({
      method: "POST",
      url: "/session/guest",
      headers: { origin },
    });
    expect(reply.statusCode).toBe(204);
    return {
      origin,
      cookie: String(reply.headers["set-cookie"]).split(";")[0]!,
    };
  }

  try {
    await server.listen(0, "127.0.0.1");
    const address = transport.server?.address();
    if (!address || typeof address === "string")
      throw new Error("Expected a loopback server.");
    const http = `http://127.0.0.1:${address.port}`;
    const ws = `ws://127.0.0.1:${address.port}`;
    const request = (
      headers: Record<string, string>,
      body: PartyRequest | Record<string, unknown>,
    ) =>
      fetch(http + "/party/connect", {
        method: "POST",
        headers: { ...headers, "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    async function join(headers: Record<string, string>, body: PartyRequest) {
      const response = await request(headers, body);
      if (!response.ok)
        throw new Error(
          `Team request failed ${response.status}: ${await response.text()}`,
        );
      const reservation = (await response.json()) as PartySeat;
      const room = await new Client(ws, {
        headers,
      }).consumeSeatReservation<CoopState>(reservation, CoopState);
      sockets.push(room);
      room.onMessage("party_error", () => {});
      await expect
        .poll(() => room.state.players.has(reservation.playerId))
        .toBe(true);
      return { room, reservation };
    }

    const [a, b, c, d, stranger] = await Promise.all([
      guest(),
      guest(),
      guest(),
      guest(),
      guest(),
    ]);
    expect(
      new Set([a, b, c, d, stranger].map(({ cookie }) => cookie)).size,
    ).toBe(5);
    expect(
      (await request({ origin }, { action: "create", wizard: "fire" })).status,
    ).toBe(401);
    expect(
      (
        await request(
          { ...a, origin: "https://untrusted.example" },
          { action: "create", wizard: "fire" },
        )
      ).status,
    ).toBe(403);
    expect(
      (await request(a, { action: "join", wizard: "fire", code: "bad!" }))
        .status,
    ).toBe(400);
    expect((await request(a, { padding: "a".repeat(1100) })).status).toBe(413);
    expect(
      (await request(a, { action: "join", wizard: "fire", code: "ZZZZZZ" }))
        .status,
    ).toBe(404);

    const leader = await join(a, { action: "create", wizard: "fire" });
    const { code, playerId } = leader.reservation;
    const { room } = leader;
    expect(room.state.leaderId).toBe(playerId);
    expect(room.state.phase).toBe("LOBBY");
    expect(
      (await request(a, { action: "join", wizard: "fire", code })).status,
    ).toBe(409);
    const ice = await join(b, { action: "join", wizard: "ice", code });
    const healer = await join(c, { action: "join", wizard: "healer", code });
    const defense = await join(d, { action: "join", wizard: "defense", code });
    await expect.poll(() => room.state.players.size).toBe(4);
    expect(
      (await request(stranger, { action: "join", wizard: "wind", code }))
        .status,
    ).toBe(409);

    ice.room.send("wizard", { wizard: "fire" });
    await expect
      .poll(() => room.state.players.get(ice.reservation.playerId)?.wizard)
      .toBe("fire");
    const startError = new Promise<string>((resolve) =>
      ice.room.onMessage("party_error", (message) => resolve(message.message)),
    );
    ice.room.send("start", { confirmIncomplete: true });
    await expect(startError).resolves.toContain("leader");
    expect(room.state.phase).toBe("LOBBY");

    const other = await join(stranger, {
      action: "create",
      wizard: "wind",
      dungeon: "expedition",
    });
    expect(other.reservation.code).not.toBe(code);
    other.room.send("start", { confirmIncomplete: false });
    await pause(180);
    expect(other.room.state.phase).toBe("LOBBY");
    other.room.send("start", { confirmIncomplete: true });
    await expect.poll(() => other.room.state.phase).toBe("ACTIVE");

    room.send("start", { confirmIncomplete: false });
    await expect
      .poll(() =>
        [room, ice.room, healer.room, defense.room].every(
          (client) => client.state.phase === "ACTIVE",
        ),
      )
      .toBe(true);
    const late = await guest();
    expect(
      (await request(late, { action: "join", wizard: "earth", code })).status,
    ).toBe(409);
    expect((await request(late, { action: "reconnect", code })).status).toBe(
      403,
    );
    expect((await request(a, { action: "reconnect", code })).status).toBe(409);
    expect(
      (await request(a, { action: "reconnect", code: other.reservation.code }))
        .status,
    ).toBe(403);

    await expect
      .poll(() => other.room.state.exploration)
      .toContain("ruined-gateway");
    const chart = JSON.parse(other.room.state.exploration);
    other.room.send("interact", {
      revision: chart.revision,
      destination: "shadow-throne",
    });
    other.room.send("interact", { revision: chart.revision - 1 });
    await pause(125);
    expect(JSON.parse(other.room.state.exploration)).toMatchObject({
      zone: "forsaken-entrance",
      revision: chart.revision,
      secrets: 0,
      open: false,
    });
    expect(room.state.exploration).toBe("");
    const player = () => room.state.players.get(playerId)!;
    const start = { x: player().x, y: player().y };
    const privatePeer = other.room.state.players.get(
      other.reservation.playerId,
    )!;
    const privateX = privatePeer.x;
    room.send("move", {
      sequence: 991,
      horizontal: 0,
      vertical: 1,
      x: 2200,
      playerId: ice.reservation.playerId,
    });
    room.send("move", { sequence: 992, horizontal: -8, vertical: 1 });
    room.send("setPosition", { x: 2200, y: 2000 });
    await pause(180);
    expect(player()).toMatchObject({ ...start, acknowledged: 0 });
    room.send("move", { sequence: 2, horizontal: 1, vertical: 1 });
    room.send("move", { sequence: 1, horizontal: -1, vertical: 0 });
    await expect
      .poll(() => ice.room.state.players.get(playerId)?.acknowledged)
      .toBe(2);
    room.send("move", { sequence: 3, horizontal: 0, vertical: 0 });
    await expect.poll(() => player().moving).toBe(false);
    expect(player().x - start.x).toBeGreaterThan(0);
    expect(player().x - start.x).toBeCloseTo(player().y - start.y, 3);
    expect(privatePeer.x).toBe(privateX);
    expect(other.room.state.players.has(playerId)).toBe(false);
    const ackBeforeFlood = player().acknowledged;
    const beforeFlood = { x: player().x, y: player().y };
    for (let i = 0; i < 42; i++)
      room.send("move", {
        sequence: ackBeforeFlood + 1 + i,
        horizontal: 0,
        vertical: 0,
      });
    await expect
      .poll(() => player().acknowledged)
      .toBeGreaterThan(ackBeforeFlood);
    expect(player().acknowledged).toBeLessThan(ackBeforeFlood + 42);
    expect(player()).toMatchObject(beforeFlood);

    const disconnectedId = healer.reservation.playerId;
    const retained = () => room.state.players.get(disconnectedId)!;
    const previous = {
      x: retained().x,
      y: retained().y,
      wizard: retained().wizard,
    };
    healer.room.reconnection.enabled = false;
    const oldTicket = healer.room.reconnectionToken;
    await healer.room.leave(false);
    await expect
      .poll(() => retained().connection)
      .toBe("DISCONNECTED_PROTECTED");
    expect(room.state.players.size).toBe(4);
    room.send("move", {
      sequence: 4,
      horizontal: 1,
      vertical: 0,
      playerId: disconnectedId,
    });
    expect((await request(late, { action: "reconnect", code })).status).toBe(
      403,
    );
    const reserved = await request(c, { action: "reconnect", code });
    expect(reserved.status).toBe(200);
    const ownedTicket = (await reserved.json()) as PartySeat;
    await expect(
      new Client(ws, { headers: late }).consumeSeatReservation(
        ownedTicket,
        CoopState,
      ),
    ).rejects.toBeDefined();
    expect(retained().connection).toBe("DISCONNECTED_PROTECTED");
    const restored = await join(c, { action: "reconnect", code });
    expect(restored.reservation.playerId).toBe(disconnectedId);
    expect(restored.room.roomId).toBe(room.roomId);
    expect(restored.room.reconnectionToken).not.toBe(oldTicket);
    await expect.poll(() => retained().connection).toBe("CONNECTED");
    expect(retained()).toMatchObject(previous);
    expect(room.state.players.size).toBe(4);
    expect((await request(c, { action: "reconnect", code })).status).toBe(409);
    await expect(
      new Client(ws, { headers: c }).reconnect(oldTicket, CoopState),
    ).rejects.toBeDefined();

    restored.room.reconnection.minUptime = 0;
    const reconnected = new Promise<void>((resolve) =>
      restored.room.onReconnect(() => resolve()),
    );
    restored.room.connection.close(4010);
    await expect(reconnected).resolves.toBeUndefined();
    await expect.poll(() => retained().connection).toBe("CONNECTED");
    expect(room.state.players.size).toBe(4);

    await restored.room.leave(true);
    await expect.poll(() => room.state.players.size).toBe(3);
    expect((await request(c, { action: "reconnect", code })).status).toBe(403);

    const lobby = await join(c, { action: "create", wizard: "earth" });
    const lobbyCode = lobby.reservation.code;
    const next = await join(late, {
      action: "join",
      code: lobbyCode,
      wizard: "earth",
    });
    await lobby.room.leave(true);
    await expect
      .poll(() => next.room.state.leaderId)
      .toBe(next.reservation.playerId);
    await expect.poll(() => next.room.state.players.size).toBe(1);
    const last = await join(c, {
      action: "join",
      code: lobbyCode,
      wizard: "ice",
    });
    await expect.poll(() => next.room.state.players.size).toBe(2);
    next.room.send("start", { confirmIncomplete: false });
    await pause(180);
    expect(next.room.state.phase).toBe("LOBBY");
    next.room.send("start", { confirmIncomplete: true });
    await expect.poll(() => last.room.state.phase).toBe("ACTIVE");
    await last.room.leave(true);
    next.room.reconnection.enabled = false;
    await next.room.leave(false);
    await expect
      .poll(() => directory.rooms.has(lobbyCode), { timeout: 5500 })
      .toBe(false);

    const three = await join(c, { action: "create", wizard: "ice" });
    await join(late, {
      action: "join",
      code: three.reservation.code,
      wizard: "earth",
    });
    await join(await guest(), {
      action: "join",
      code: three.reservation.code,
      wizard: "fire",
    });
    await expect.poll(() => three.room.state.players.size).toBe(3);
    three.room.send("start", { confirmIncomplete: false });
    await pause(180);
    expect(three.room.state.phase).toBe("LOBBY");
    three.room.send("start", { confirmIncomplete: true });
    await expect.poll(() => three.room.state.phase).toBe("ACTIVE");
  } finally {
    await Promise.allSettled(
      sockets
        .filter((room) => room.connection.isOpen)
        .map((room) => room.leave(true)),
    );
    await server.gracefullyShutdown(false);
    await api.close();
  }
}, 18_000);
