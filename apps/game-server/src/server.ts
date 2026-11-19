import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { TEST_ROOM } from "@obsidian/shared";
import { TestRoom } from "./rooms/TestRoom.js";

export function createGameServer(gracefullyShutdown = true) {
  const transport = new WebSocketTransport();
  const server = new Server({ transport, gracefullyShutdown, greet: false });
  server.define(TEST_ROOM, TestRoom);
  return { server, transport };
}
