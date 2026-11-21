import { readFileSync } from "node:fs";
import type { IncomingMessage } from "node:http";
import { matchMaker, Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { readDungeonMap, type TiledDungeonMap } from "@obsidian/game-core";
import { resolveProfile } from "@obsidian/progression";
import { TEST_ROOM } from "@obsidian/shared";
import { COOP_ROOM } from "@obsidian/shared/coop";
import {
  createGuestSessions,
  isAllowedWebOrigin,
} from "@obsidian/shared/guest";
import { PartyDirectory } from "./party/directory.js";
import { partyRouter } from "./party/routes.js";
import type { GameProgression } from "./party/progression.js";
import { partySpawns } from "./party/simulation.js";
import { CoopDungeonRoom } from "./rooms/CoopDungeonRoom.js";
import { TestRoom } from "./rooms/TestRoom.js";

export interface CoopConfig {
  secret: string;
  webOrigin: string;
  recoverySeconds: number;
  dropLimit: number;
  progression?: GameProgression;
}

export function loadCanonicalMap(combat: boolean | "expedition" = false) {
  const file = new URL(
    combat === "expedition"
      ? "../../web/public/assets/dungeon/expedition.tmj"
      : combat
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
    verifyClient(
      { req }: { req: IncomingMessage },
      done: (allowed: boolean) => void,
    ) {
      // Use the same URL shape and room-id parsing as WebSocketTransport 0.17.
      const url = new URL(`ws://server/${req.url}`);
      const roomId = url.pathname.match(
        /\/[a-zA-Z0-9_-]+\/([a-zA-Z0-9_-]+)$/,
      )?.[1];
      const room = roomId ? matchMaker.getLocalRoomById(roomId) : undefined;
      if (!(room instanceof CoopDungeonRoom)) return done(true);
      const identity = guests?.verify(req.headers.cookie);
      const sessionId = url.searchParams.get("sessionId") ?? "";
      const allowed = Boolean(
        coop &&
        isAllowedWebOrigin(req.headers.origin, coop.webOrigin) &&
        identity &&
        room.permitsSocket(
          sessionId,
          identity.guestId,
          url.searchParams.get("reconnectionToken"),
        ),
      );
      if (!allowed || !coop?.progression || !identity) return done(allowed);
      const cookie = req.headers.cookie;
      const guestId = /(?:^|;\s*)obsidian_account=/.test(cookie ?? "")
        ? undefined
        : identity.guestId;
      void resolveProfile(coop.progression.db, cookie, guestId)
        .then((profile) =>
          done(
            Boolean(profile && room.socketProfile(sessionId) === profile.id),
          ),
        )
        .catch(() => done(false));
    },
  });
  const server = new Server({ transport, gracefullyShutdown, greet: false });
  if (coop?.progression) {
    const { db, outbox } = coop.progression;
    server.onShutdown(async () => {
      if (process.env.NODE_ENV === "production")
        console.info(
          JSON.stringify({ event: "service.stopping", service: "game" }),
        );
      await outbox.close();
      await db.$disconnect();
    });
  }
  server.define(TEST_ROOM, TestRoom);
  if (coop && guests) {
    const map = loadCanonicalMap(true);
    server.router = partyRouter(
      directory,
      guests,
      coop.webOrigin,
      coop.progression,
    );
    server.define(COOP_ROOM, CoopDungeonRoom, {
      directory,
      map,
      expeditionMap: loadCanonicalMap("expedition"),
      spawns: partySpawns(map),
      recoverySeconds: coop.recoverySeconds,
      dropLimit: coop.dropLimit,
      ...(coop.progression ? { progression: coop.progression } : {}),
    });
  }
  return { server, transport, directory };
}
