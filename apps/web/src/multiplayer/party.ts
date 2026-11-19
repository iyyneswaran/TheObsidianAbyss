import { Client, type Room } from "@colyseus/sdk";
import { localPorts } from "@obsidian/shared";
import {
  CoopState,
  INPUT_HZ,
  type PartyPhase,
  type PartyRequest,
  type PartySeat,
  type PlayerConnection,
} from "@obsidian/shared/coop";
import type { WizardClassId } from "@obsidian/game-assets";
import type { AbilitySlot, CombatEvent, RunResult } from "@obsidian/game-core";

type Connection =
  "idle" | "connecting" | "connected" | "recovering" | "disconnected";
type Member = {
  id: string;
  name: string;
  wizard: WizardClassId;
  slot: number;
  connection: PlayerConnection;
  life: "ALIVE" | "DEAD";
  hp: number;
  maxHp: number;
};
export interface PartySnapshot {
  connection: Connection;
  code: string;
  roomId: string;
  playerId: string;
  leaderId: string;
  phase: PartyPhase | "";
  members: Member[];
  error: string;
  castError: string;
  result: RunResult | null;
  settlement: string;
  encounter: string;
  cleared: number;
  gateOpen: boolean;
  boss: { hp: number; maxHp: number; phase: number; warnings: number } | null;
  local: {
    mp: number;
    maxMp: number;
    statuses: string;
    equipment: { skill3: string | null; ultimate: string | null };
    cooldowns: Partial<Record<AbilitySlot, number>>;
  } | null;
}

const blank: PartySnapshot = {
  connection: "idle",
  code: "",
  roomId: "",
  playerId: "",
  leaderId: "",
  phase: "",
  members: [],
  error: "",
  castError: "",
  result: null,
  settlement: "",
  encounter: "",
  cleared: 0,
  gateOpen: false,
  boss: null,
  local: null,
};
const key = "obsidian.party.code";
const endpoint =
  import.meta.env.VITE_GAME_SERVER_URL || `ws://localhost:${localPorts.game}`;
const gameHttp = new URL(endpoint);
gameHttp.protocol =
  gameHttp.protocol === "wss:" || gameHttp.protocol === "https:"
    ? "https:"
    : "http:";
const api =
  import.meta.env.VITE_API_URL || `http://localhost:${localPorts.api}`;

type CoopRoom = Room<unknown, CoopState>;

async function checkedRequest(url: URL, body?: unknown) {
  const response = await fetch(url, {
    method: "POST",
    credentials: "include",
    signal: AbortSignal.timeout(8000),
    ...(body === undefined
      ? {}
      : {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
  });
  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => null);
    throw new PartyRequestError(
      response.status,
      typeof payload === "object" &&
        payload !== null &&
        "error" in payload &&
        typeof payload.error === "string"
        ? payload.error
        : "The team service is unavailable.",
    );
  }
  return response;
}

class PartyRequestError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function requestSeat(request: PartyRequest, isCurrent: () => boolean) {
  const url = new URL("/party/connect", gameHttp);
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await checkedRequest(url, request);
      return (await response.json()) as PartySeat;
    } catch (error) {
      if (
        request.action !== "reconnect" ||
        !(error instanceof PartyRequestError) ||
        error.status !== 409 ||
        attempt >= 3 ||
        !isCurrent()
      )
        throw error;
      // On a reload, the previous socket may still be completing its close handshake.
      await new Promise((resolve) => setTimeout(resolve, 200 * (attempt + 1)));
    }
  }
}

class PartyConnection {
  private current: CoopRoom | undefined;
  private snapshot = blank;
  private listeners = new Set<() => void>();
  private generation = 0;
  private sequence = 0;
  private nextInputAt = 0;
  private direction = "";
  private rosterKey = "";
  private patchTimes: number[] = [];
  private castSequence = 0;
  private eventQueue: CombatEvent[] = [];
  spectatorId = "";

  readonly subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  readonly getSnapshot = () => this.snapshot;

  get world() {
    return this.current?.state;
  }

  get combatEvents(): readonly CombatEvent[] {
    return this.eventQueue;
  }

  get updateRate() {
    const now = performance.now();
    return this.patchTimes.filter((time) => now - time <= 1000).length;
  }

  get rememberedCode() {
    return sessionStorage.getItem(key) ?? "";
  }

  restore() {
    const code = this.rememberedCode;
    if (code && this.snapshot.connection === "idle")
      void this.connect({ action: "reconnect", code });
  }

  async connect(request: PartyRequest) {
    if (
      ["connecting", "connected", "recovering"].includes(
        this.snapshot.connection,
      )
    )
      return;
    const generation = ++this.generation;
    this.update({ connection: "connecting", error: "" });
    try {
      await checkedRequest(new URL("/session/guest", api));
      const reservation = await requestSeat(
        request,
        () => generation === this.generation,
      );
      if (generation !== this.generation) return;
      const room = await new Client(endpoint).consumeSeatReservation<CoopState>(
        reservation,
        CoopState,
      );
      if (generation !== this.generation) {
        await room.leave(false);
        return;
      }
      this.current = room;
      sessionStorage.setItem(key, reservation.code);
      this.rosterKey = "";
      this.patchTimes = [];
      this.nextInputAt = 0;
      this.direction = "";
      this.sequence = 0;
      this.castSequence = 0;
      this.eventQueue = [];
      this.spectatorId = "";
      const active = () =>
        this.current === room && this.generation === generation;
      room.reconnection.minUptime = 0;
      room.reconnection.maxEnqueuedMessages = 0;
      this.update({
        code: reservation.code,
        roomId: room.roomId,
        playerId: reservation.playerId,
        connection: "connected",
      });
      room.onStateChange((state) => {
        if (!active()) return;
        const now = performance.now();
        this.patchTimes = this.patchTimes.filter((time) => now - time <= 1000);
        this.patchTimes.push(now);
        this.publishRoster(state);
      });
      room.onDrop(() => {
        if (active()) this.update({ connection: "recovering" });
      });
      room.onReconnect(() => {
        if (!active()) return;
        this.nextInputAt = 0;
        this.direction = "";
        this.update({ connection: "connected", error: "" });
        this.publishRoster(room.state);
      });
      room.onLeave(() => {
        if (active())
          this.update({
            connection: "disconnected",
            error: "Connection lost. Reconnect to restore your wizard.",
          });
      });
      room.onMessage("party_error", (message: { message: string }) => {
        if (active()) this.update({ error: message.message });
      });
      room.onMessage("cast_rejected", ({ message }: { message: string }) => {
        if (active()) this.update({ castError: message });
      });
      room.onMessage("combat", (event: CombatEvent) => {
        if (!active()) return;
        if (this.eventQueue.length >= 96) this.eventQueue.shift();
        this.eventQueue.push(event);
        if (
          event.kind === "cast" &&
          event.source === this.snapshot.playerId &&
          this.snapshot.castError
        )
          this.update({ castError: "" });
      });
      this.publishRoster(room.state);
    } catch (error) {
      if (this.generation !== generation) return;
      this.update({
        connection: "disconnected",
        error:
          error instanceof PartyRequestError
            ? error.message
            : "Could not reach the team server. Try again.",
      });
    }
  }

  command(type: "start", payload: { confirmIncomplete: boolean }): void;
  command(type: "wizard", payload: { wizard: WizardClassId }): void;
  command(type: string, payload: unknown) {
    if (
      this.snapshot.connection !== "connected" ||
      !this.current?.connection.isOpen
    )
      return;
    if (this.snapshot.error) this.update({ error: "" });
    this.current.send(type, payload);
  }

  sendMovement(horizontal: number, vertical: number, now: number) {
    if (
      this.snapshot.phase !== "ACTIVE" ||
      this.snapshot.connection !== "connected" ||
      !this.current?.connection.isOpen
    )
      return;
    const local = this.world?.players.get(this.snapshot.playerId);
    if (local?.connection !== "CONNECTED" || local.life !== "ALIVE") return;
    const direction = `${horizontal},${vertical}`;
    if (
      direction === this.direction &&
      ((!horizontal && !vertical) || now < this.nextInputAt)
    )
      return;
    this.direction = direction;
    this.nextInputAt = now + 1000 / INPUT_HZ;
    this.sequence = Math.max(this.sequence, local.acknowledged) + 1;
    this.current.send("move", {
      sequence: this.sequence,
      horizontal,
      vertical,
    });
  }

  cast(slot: AbilitySlot, x: number, y: number) {
    const local = this.world?.players.get(this.snapshot.playerId);
    if (
      local?.life !== "ALIVE" ||
      this.snapshot.phase !== "ACTIVE" ||
      this.snapshot.connection !== "connected" ||
      !this.current?.connection.isOpen
    )
      return;
    this.castSequence = Math.max(this.castSequence, local.castAck) + 1;
    this.current.send("cast", { slot, x, y, sequence: this.castSequence });
  }

  interact() {
    if (
      this.snapshot.phase === "ACTIVE" &&
      this.snapshot.connection === "connected" &&
      this.current?.connection.isOpen
    )
      this.current.send("interact", {});
  }

  async leave(consented: boolean) {
    const room = this.current;
    this.generation++;
    this.current = undefined;
    this.rosterKey = "";
    this.eventQueue = [];
    this.spectatorId = "";
    if (consented) sessionStorage.removeItem(key);
    this.snapshot = blank;
    this.listeners.forEach((listener) => listener());
    if (!room) return;
    room.reconnection.enabled = false;
    // Colyseus 0.17 may already have queued a retry when navigation abandons the connection.
    room.connection.reconnect = () => {};
    if (room.connection.isOpen) await room.leave(consented).catch(() => {});
    else room.connection.close();
  }

  private publishRoster(state: CoopState) {
    if (!state?.players) return;
    const members: Member[] = [];
    state.players.forEach(
      ({ name, wizard, slot, connection, hp, maxHp, life }, id) =>
        members.push({ id, name, wizard, slot, connection, hp, maxHp, life }),
    );
    members.sort((a, b) => a.slot - b.slot);
    const local = state.players.get(this.snapshot.playerId);
    const combat = state.combat;
    const boss =
      combat?.phase &&
      [...combat.enemies.values()].find(({ kind }) => kind === "overlord");
    const summary = {
      phase: state.phase,
      leaderId: state.leaderId,
      members,
      encounter: combat?.encounter ?? "",
      cleared: combat?.cleared ?? 0,
      gateOpen: combat?.gateOpen ?? false,
      settlement: combat?.settlement ?? "",
      boss: boss
        ? {
            hp: boss.hp,
            maxHp: boss.maxHp,
            phase: combat.phase,
            warnings: [...combat.telegraphs.values()].filter(
              ({ hostile }) => hostile,
            ).length,
          }
        : null,
      local: local
        ? {
            mp: local.mp,
            maxMp: local.maxMp,
            statuses: local.statuses,
            equipment: {
              skill3: local.skill3 || null,
              ultimate: local.ultimate || null,
            },
            cooldowns: Object.fromEntries(local.cooldowns.entries()),
          }
        : null,
    };
    const serialized = JSON.stringify(summary) + (combat?.result ?? "");
    if (serialized === this.rosterKey) return;
    this.rosterKey = serialized;
    this.update({
      ...summary,
      result: combat?.result ? (JSON.parse(combat.result) as RunResult) : null,
    });
  }

  private update(fields: Partial<PartySnapshot>) {
    this.snapshot = { ...this.snapshot, ...fields };
    this.listeners.forEach((listener) => listener());
  }
}

export const party = new PartyConnection();
