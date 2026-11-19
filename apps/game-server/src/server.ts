import { readFileSync } from "node:fs";
import type { IncomingMessage } from "node:http";
import { matchMaker, Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { readDungeonMap, type TiledDungeonMap } from "@obsidian/game-core";
import { TEST_ROOM } from "@obsidian/shared";
import { COOP_ROOM } from "@obsidian/shared/coop";
import {
  createGuestSessions,
  isAllowedWebOrigin,
} from "@obsidian/shared/guest";
import { PartyDirectory } from "./party/directory.js";
import { partyRouter } from "./party/routes.js";
import { partySpawns } from "./party/simulation.js";
import { CoopDungeonRoom } from "./rooms/CoopDungeonRoom.js";
import { TestRoom } from "./rooms/TestRoom.js";

export interface CoopConfig {
  secret: string;
  webOrigin: string;
  recoverySeconds: number;
  dropLimit: number;
}

export function loadCanonicalMap(combat = false) {
  const file = new URL(
    combat
      ? "../../web/public/assets/dungeon/obsidian-combat.tmj"
      : "../../web/public/assets/dungeon/obsidian-dungeon.tmj",
    import.meta.url,
  );
  return readDungeonMap(
    JSON.parse(readFileSync(file, "utf8")) as TiledDungeonMap,
  );
}

export function createGameServer(gracefullyShutdown = true, coop?: CoopConfig) {
  const directory = new PartyDirectory();
  const guests = coop ? createGuestSessions(coop.secret) : undefined;
  const transport = new WebSocketTransport({
    maxPayload: 8192,
    verifyClient({ req }: { req: IncomingMessage }) {
      // Use the same URL shape and room-id parsing as WebSocketTransport 0.17.
      const url = new URL(`ws://server/${req.url}`);
      const roomId = url.pathname.match(
        /\/[a-zA-Z0-9_-]+\/([a-zA-Z0-9_-]+)$/,
      )?.[1];
      const room = roomId ? matchMaker.getLocalRoomById(roomId) : undefined;
      if (!(room instanceof CoopDungeonRoom)) return true;
      const identity = guests?.verify(req.headers.cookie);
      return Boolean(
        coop &&
        isAllowedWebOrigin(req.headers.origin, coop.webOrigin) &&
        identity &&
        room.permitsSocket(
          url.searchParams.get("sessionId") ?? "",
          identity.guestId,
          url.searchParams.get("reconnectionToken"),
        ),
      );
    },
  });
  const server = new Server({ transport, gracefullyShutdown, greet: false });
  server.define(TEST_ROOM, TestRoom);
  if (coop && guests) {
    const map = loadCanonicalMap(true);
    server.router = partyRouter(directory, guests, coop.webOrigin);
    server.define(COOP_ROOM, CoopDungeonRoom, {
      directory,
      map,
      spawns: partySpawns(map),
      recoverySeconds: coop.recoverySeconds,
      dropLimit: coop.dropLimit,
    });
  }
  return { server, transport, directory };
}
