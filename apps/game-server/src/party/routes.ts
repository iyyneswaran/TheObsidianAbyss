import { createEndpoint, createRouter, matchMaker } from "@colyseus/core";
import { COOP_ROOM, partyRequestSchema } from "@obsidian/shared/coop";
import {
  createRequestLimit,
  isAllowedWebOrigin,
  type createGuestSessions,
} from "@obsidian/shared/guest";
import type { CoopDungeonRoom } from "../rooms/CoopDungeonRoom.js";
import { PartyError, type PartyDirectory } from "./directory.js";

type Guests = ReturnType<typeof createGuestSessions>;
const maxRooms = 64;
const maxBody = 1024;

async function readPartyBody(request: Request): Promise<unknown> {
  if (Number(request.headers.get("content-length")) > maxBody)
    throw new PartyError(413, "Team request is too large.");
  const reader = request.body?.getReader();
  if (!reader) return undefined;
  const data = new Uint8Array(maxBody);
  let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (length + value.length > maxBody) {
        void reader.cancel().catch(() => {});
        throw new PartyError(413, "Team request is too large.");
      }
      data.set(value, length);
      length += value.length;
    }
    return JSON.parse(
      new TextDecoder().decode(data.subarray(0, length)),
    ) as unknown;
  } catch (error) {
    if (error instanceof PartyError) throw error;
    throw new PartyError(400, "Invalid team request.");
  } finally {
    reader.releaseLock();
  }
}

export function partyRouter(
  directory: PartyDirectory,
  guests: Guests,
  webOrigin: string,
) {
  const allowGuest = createRequestLimit(16, 60_000, 4096);
  const allowTotal = createRequestLimit(360, 60_000, 1);

  return createRouter({
    partyConnect: createEndpoint(
      "/party/connect",
      { method: "POST", requireRequest: true, disableBody: true },
      async (ctx) => {
        const json = (body: unknown, status = 200) =>
          Response.json(body, {
            status,
            headers: { "Cache-Control": "no-store" },
          });
        const headers = ctx.request.headers;
        if (!isAllowedWebOrigin(headers.get("origin"), webOrigin))
          return json({ error: "This origin cannot enter teams." }, 403);
        const guest = guests.verify(headers.get("cookie"));
        if (!guest)
          return json({ error: "Start a valid guest session first." }, 401);
        if (!allowGuest(guest.guestId) || !allowTotal("party"))
          return json(
            { error: "Too many team requests. Try again shortly." },
            429,
          );
        const { guestId } = guest;
        if (directory.connecting.has(guestId))
          return json(
            { error: "A team connection is already in progress." },
            409,
          );
        directory.connecting.add(guestId);
        try {
          const request = partyRequestSchema.safeParse(
            await readPartyBody(ctx.request),
          );
          if (!request.success)
            throw new PartyError(400, "Invalid team code or wizard selection.");
          const data = request.data;
          if (data.action === "reconnect") {
            const room = directory.rooms.get(data.code);
            if (!room)
              throw new PartyError(
                404,
                "Team not found or the recovery window ended.",
              );
            return json(await room.reserveReconnect(guestId));
          }
          const existing = [...directory.rooms.values()].some((room) =>
            room.hasGuest(guestId),
          );
          if (existing)
            throw new PartyError(
              409,
              "You already have a team seat. Reconnect using its code.",
            );
          if (data.action === "create") {
            if (directory.rooms.size + directory.creating >= maxRooms)
              throw new PartyError(503, "The team server is at capacity.");
            directory.creating++;
            try {
              const listing = await matchMaker.createRoom(COOP_ROOM, {});
              const room = matchMaker.getLocalRoomById(
                listing.roomId,
              ) as CoopDungeonRoom;
              return json(await room.reserveGuest(guestId, data.wizard));
            } finally {
              directory.creating--;
            }
          }
          const room = directory.rooms.get(data.code);
          if (!room) throw new PartyError(404, "Team not found.");
          return json(await room.reserveGuest(guestId, data.wizard));
        } catch (error) {
          if (error instanceof PartyError)
            return json({ error: error.message }, error.status);
          console.error(
            "Private team request failed",
            error instanceof Error ? error.name : "unknown",
          );
          return json({ error: "The team is unavailable. Try again." }, 503);
        } finally {
          directory.connecting.delete(guestId);
        }
      },
    ),
  });
}
