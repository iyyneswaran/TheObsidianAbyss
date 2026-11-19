import { Client } from "@colyseus/sdk";
import { TEST_ROOM } from "@obsidian/shared";
import { expect, it } from "vitest";
import { createGameServer } from "../src/server.js";

it("joins test_room and leaves it through the official SDK", async () => {
  const { server, transport } = createGameServer(false);

  try {
    await server.listen(0, "127.0.0.1");
    const address = transport.server?.address();
    if (!address || typeof address === "string")
      throw new Error("Expected a TCP address");

    const client = new Client(`ws://127.0.0.1:${address.port}`);
    const room = await client.joinOrCreate(TEST_ROOM);
    expect(room.name).toBe("test_room");
    expect(room.roomId).toBeTruthy();
    expect(room.sessionId).toBeTruthy();
    await room.leave();
    expect(room.connection.isOpen).toBe(false);
  } finally {
    await server.gracefullyShutdown(false);
  }
});
