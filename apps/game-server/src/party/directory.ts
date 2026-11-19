import { randomInt } from "node:crypto";
import { TEAM_ALPHABET, TEAM_CODE_LENGTH } from "@obsidian/shared/coop";
import type { CoopDungeonRoom } from "../rooms/CoopDungeonRoom.js";

export class PartyError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export function generateTeamCode(
  taken: (code: string) => boolean,
  choose = randomInt,
) {
  for (let attempt = 0; attempt < 32; attempt++) {
    const code = Array.from(
      { length: TEAM_CODE_LENGTH },
      () => TEAM_ALPHABET[choose(TEAM_ALPHABET.length)],
    ).join("");
    if (!taken(code)) return code;
  }
  throw new PartyError(503, "A team code could not be allocated. Try again.");
}

export class PartyDirectory {
  readonly rooms = new Map<string, CoopDungeonRoom>();
  readonly connecting = new Set<string>();
  creating = 0;

  register(room: CoopDungeonRoom) {
    const code = generateTeamCode((candidate) => this.rooms.has(candidate));
    this.rooms.set(code, room);
    return code;
  }
}
