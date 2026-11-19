import { randomUUID } from "node:crypto";
import { matchMaker, Room, ServerError, type Client } from "@colyseus/core";
import {
  CombatRun,
  playerTerrain,
  speedFactor,
  type DungeonMap,
  type PlayerTransform,
} from "@obsidian/game-core";
import type { WizardClassId } from "@obsidian/game-assets";
import {
  castSchema,
  classSelectionSchema,
  CoopPlayer,
  CoopState,
  movementSchema,
  interactSchema,
  needsIncompleteConfirmation,
  PARTY_SIZE,
  PATCH_HZ,
  startSchema,
} from "@obsidian/shared/coop";
import { publishCombat } from "../party/combat.js";
import { PartyError, type PartyDirectory } from "../party/directory.js";
import {
  acceptInput,
  emptyInput,
  simulatePlayer,
  stepMs,
  type InputState,
} from "../party/simulation.js";

const seatTimeout = 8;
const dropWindowMs = 60_000;

export interface CoopRoomOptions {
  directory: PartyDirectory;
  map: DungeonMap;
  spawns: PlayerTransform[];
  recoverySeconds: number;
  dropLimit: number;
}

interface Seat {
  guestId: string;
  playerId: string;
  wizard: WizardClassId;
  slot: number;
}

interface Member extends Seat {
  client: Client;
  input: InputState;
  drops: number[];
  disconnected?: { token: string; expires: number; retryAt: number };
}

export class CoopDungeonRoom extends Room<{ state: CoopState }> {
  override state = new CoopState();
  override maxClients = PARTY_SIZE;
  override maxMessagesPerSecond = 70;
  private options!: CoopRoomOptions;
  private pending = new Map<string, Seat>();
  private members = new Map<string, Member>();
  private run?: CombatRun;

  static override async onAuth() {
    throw new ServerError(4215, "Use private team entry.");
  }

  override async onCreate(options: CoopRoomOptions) {
    this.options = options;
    this.state.code = options.directory.register(this);
    await this.setPrivate(true);
    this.seatReservationTimeout = seatTimeout;
    this.patchRate = 1000 / PATCH_HZ;
    this.setSimulationInterval(() => this.simulate(), stepMs);

    this.onMessage("move", (client, message: unknown) => {
      const member = this.owner(client);
      if (!member || this.state.phase !== "ACTIVE") return;
      if (this.run?.players.get(member.playerId)?.life === "DEAD") return;
      const input = movementSchema.safeParse(message);
      if (input.success)
        acceptInput(member.input, input.data, performance.now());
    });
    this.onMessage("wizard", (client, message: unknown) => {
      const member = this.owner(client);
      const selection = classSelectionSchema.safeParse(message);
      if (!member || this.state.phase !== "LOBBY" || !selection.success)
        return this.reject(client, "Class selection is unavailable.");
      const player = this.state.players.get(member.playerId)!;
      player.wizard = selection.data.wizard;
    });
    this.onMessage("start", (client, message: unknown) =>
      this.start(client, message),
    );
    this.onMessage("cast", (client, message: unknown) => {
      const member = this.owner(client);
      if (!member || this.state.phase !== "ACTIVE" || !this.run) return;
      const request = castSchema.safeParse(message);
      const error = request.success
        ? this.run.cast(member.playerId, request.data)
        : "Invalid cast.";
      if (error) client.send("cast_rejected", { message: error });
    });
    this.onMessage("interact", (client, message: unknown) => {
      const member = this.owner(client);
      if (
        !member ||
        this.state.phase !== "ACTIVE" ||
        !interactSchema.safeParse(message).success
      )
        return;
      if (!this.run?.interact(member.playerId))
        client.send("cast_rejected", {
          message: "Clear the dungeon and approach the shadow gate.",
        });
    });
    this.onMessage("*", (client) =>
      this.reject(client, "Unsupported team command."),
    );
  }

  hasGuest(guestId: string) {
    return [...this.members.values(), ...this.pending.values()].some(
      (member) => member.guestId === guestId,
    );
  }

  async reserveGuest(guestId: string, wizard: WizardClassId) {
    if (this.state.phase !== "LOBBY")
      throw new PartyError(409, "The dungeon has already started.");
    if (this.hasGuest(guestId))
      throw new PartyError(409, "You already have a seat on this team.");
    const occupied = new Set(
      [...this.members.values(), ...this.pending.values()].map(
        ({ slot }) => slot,
      ),
    );
    const slot = Array.from({ length: PARTY_SIZE }, (_, i) => i).find(
      (i) => !occupied.has(i),
    );
    if (slot === undefined) throw new PartyError(409, "This team is full.");
    const sessionId = randomUUID();
    const seat = { guestId, playerId: randomUUID(), wizard, slot };
    this.pending.set(sessionId, seat);
    const expiration = this.clock.setTimeout(
      () => this.pending.delete(sessionId),
      seatTimeout * 1000,
    );
    try {
      const listing = await matchMaker.getRoomById(this.roomId);
      const reservation = await matchMaker.reserveSeatFor(
        listing,
        {},
        { sessionId },
      );
      return { ...reservation, playerId: seat.playerId, code: this.state.code };
    } catch {
      expiration.clear();
      this.pending.delete(sessionId);
      throw new PartyError(409, "A team seat is unavailable. Try again.");
    }
  }

  async reserveReconnect(guestId: string) {
    const entry = [...this.members.values()].find(
      (member) => member.guestId === guestId,
    );
    if (!entry)
      throw new PartyError(403, "This guest does not own a seat on this team.");
    if (!entry.disconnected)
      throw new PartyError(409, "This seat is still connected.");
    const { token, expires, retryAt } = entry.disconnected;
    if (Date.now() >= expires)
      throw new PartyError(410, "The reconnect window ended.");
    if (Date.now() < retryAt)
      throw new PartyError(
        429,
        "Reconnect is cooling down. Try again shortly.",
      );
    try {
      const reservation = await matchMaker.reconnect(this.roomId, {
        reconnectionToken: token,
      });
      return {
        ...reservation,
        reconnectionToken: token,
        playerId: entry.playerId,
        code: this.state.code,
      };
    } catch {
      throw new PartyError(409, "The original seat is unavailable.");
    }
  }

  permitsSocket(sessionId: string, guestId: string, token: string | null) {
    if (token === null)
      return (
        this.state.phase === "LOBBY" &&
        this.pending.get(sessionId)?.guestId === guestId
      );
    const member = this.members.get(sessionId);
    const reservation = member?.disconnected;
    const now = Date.now();
    return (
      member?.guestId === guestId &&
      reservation?.token === token &&
      reservation.expires > now &&
      reservation.retryAt <= now
    );
  }

  override onJoin(client: Client) {
    const seat = this.pending.get(client.sessionId);
    this.pending.delete(client.sessionId);
    if (!seat || this.state.phase !== "LOBBY")
      throw new ServerError(4216, "The lobby has closed.");
    this.members.set(client.sessionId, {
      ...seat,
      client,
      input: emptyInput(),
      drops: [],
    });
    const player = new CoopPlayer();
    player.name = `Guest ${seat.playerId.slice(0, 4).toUpperCase()}`;
    player.slot = seat.slot;
    player.wizard = seat.wizard;
    this.state.players.set(seat.playerId, player);
    if (!this.state.leaderId) this.state.leaderId = seat.playerId;
  }

  override onDrop(client: Client) {
    const member = this.owner(client);
    if (!member) return;
    const now = Date.now();
    member.drops = member.drops.filter((time) => now - time < dropWindowMs);
    member.drops.push(now);
    const limited = member.drops.length > this.options.dropLimit;
    if (limited)
      console.warn("Co-op reconnect cooldown", {
        roomId: this.roomId,
        slot: member.slot,
      });
    member.disconnected = {
      token: client.reconnectionToken,
      expires: now + this.options.recoverySeconds * 1000,
      retryAt: limited
        ? now + Math.min(5000, this.options.recoverySeconds * 500)
        : now,
    };
    member.input.input = undefined;
    const player = this.state.players.get(member.playerId)!;
    player.acknowledged = member.input.lastSequence;
    player.moving = false;
    player.connection = "DISCONNECTED_PROTECTED";
    this.run?.setProtected(member.playerId, true);
    this.allowReconnection(client, this.options.recoverySeconds);
  }

  override onReconnect(client: Client) {
    const member = this.members.get(client.sessionId);
    if (!member?.disconnected)
      throw new ServerError(4216, "The original seat is unavailable.");
    member.client = client;
    delete member.disconnected;
    this.state.players.get(member.playerId)!.connection = "CONNECTED";
    this.run?.setProtected(member.playerId, false);
    if (!this.state.leaderId && this.state.phase === "LOBBY")
      this.state.leaderId = member.playerId;
  }

  override onLeave(client: Client) {
    const member = this.members.get(client.sessionId);
    if (!member || member.client !== client) return;
    this.members.delete(client.sessionId);
    this.state.players.delete(member.playerId);
    this.run?.forfeit(member.playerId);
    if (this.state.leaderId === member.playerId) {
      const next = [...this.members.values()]
        .filter((entry) => !entry.disconnected)
        .sort((a, b) => a.slot - b.slot)[0];
      this.state.leaderId = next?.playerId ?? "";
    }
    if (!this.members.size && this.state.phase !== "LOBBY")
      this.state.phase = "ENDED";
  }

  override onDispose() {
    this.state.phase = "ENDED";
    this.options.directory.rooms.delete(this.state.code);
  }

  private owner(client: Client) {
    const record = this.members.get(client.sessionId);
    return record?.client === client && !record.disconnected
      ? record
      : undefined;
  }

  private reject(client: Client, message: string) {
    client.send("party_error", { message });
  }

  private start(client: Client, message: unknown) {
    const owner = this.owner(client);
    if (!owner || owner.playerId !== this.state.leaderId)
      return this.reject(client, "Only the team leader can start.");
    if (this.state.phase !== "LOBBY")
      return this.reject(client, "The dungeon has already started.");
    const request = startSchema.safeParse(message);
    const connected = [...this.members.values()].filter(
      (member) => !member.disconnected,
    ).length;
    if (
      !request.success ||
      (needsIncompleteConfirmation(connected) &&
        !request.data.confirmIncomplete)
    ) {
      return this.reject(client, "Confirm the incomplete team warning first.");
    }
    this.state.phase = "STARTING";
    this.run = new CombatRun(this.roomId, this.options.map);
    void this.lock().catch(() => this.disconnect());
    for (const member of this.members.values()) {
      const player = this.state.players.get(member.playerId)!;
      Object.assign(player, this.options.spawns[member.slot]);
      this.run.addPlayer(
        member.playerId,
        player.name,
        player.wizard,
        player.slot,
        player,
        Boolean(member.disconnected),
      );
    }
    publishCombat(this.state, this.run, () => {});
    this.clock.setTimeout(() => {
      if (this.state.phase === "STARTING") this.state.phase = "ACTIVE";
    }, 120);
  }

  private simulate() {
    const run = this.run;
    if (this.state.phase !== "ACTIVE" || !run) return;
    const now = performance.now();
    this.state.tick++;
    for (const member of this.members.values()) {
      const player = this.state.players.get(member.playerId)!;
      const combatant = run.players.get(member.playerId)!;
      if (member.disconnected || combatant.life !== "ALIVE" || run.ended)
        continue;
      const next = simulatePlayer(
        this.options.map,
        player,
        member.input,
        now,
        speedFactor(combatant),
      );
      Object.assign(player, next);
      player.hazardous = playerTerrain(this.options.map, next).hazardous;
      player.acknowledged = member.input.lastSequence;
    }
    run.step(stepMs);
    publishCombat(this.state, run, (event) => this.broadcast("combat", event));
    if (run.ended) {
      this.state.phase = "ENDED";
      this.clock.setTimeout(() => void this.disconnect(), 120_000);
    }
  }
}
