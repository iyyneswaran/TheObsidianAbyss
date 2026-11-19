import { defineTypes, MapSchema, Schema } from "@colyseus/schema";
import { wizards, type WizardClassId } from "@obsidian/game-assets";
import { z } from "zod";
import { CombatState } from "./combat.js";

export * from "./combat.js";

export const COOP_ROOM = "coop_dungeon";
export const PARTY_SIZE = 4;
export const TEAM_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const TEAM_CODE_LENGTH = 6;
export const SIMULATION_HZ = 30;
export const PATCH_HZ = 15;
export const INPUT_HZ = 20;
export const INPUT_LEASE_MS = 300;

export const teamCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(new RegExp(`^[${TEAM_ALPHABET}]{${TEAM_CODE_LENGTH}}$`));
export const wizardClassSchema = z.enum(
  Object.keys(wizards) as [WizardClassId, ...WizardClassId[]],
);
export const partyRequestSchema = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("create"), wizard: wizardClassSchema }),
  z.strictObject({
    action: z.literal("join"),
    code: teamCodeSchema,
    wizard: wizardClassSchema,
  }),
  z.strictObject({ action: z.literal("reconnect"), code: teamCodeSchema }),
]);
export type PartyRequest = z.infer<typeof partyRequestSchema>;

export const startSchema = z.strictObject({ confirmIncomplete: z.boolean() });
export const classSelectionSchema = z.strictObject({
  wizard: wizardClassSchema,
});
const directionSchema = z.union([z.literal(-1), z.literal(0), z.literal(1)]);
export const movementSchema = z.strictObject({
  sequence: z.number().int().min(1).max(0xffffffff),
  horizontal: directionSchema,
  vertical: directionSchema,
});
export type MoveInput = z.infer<typeof movementSchema>;

export type PartyPhase = "LOBBY" | "STARTING" | "ACTIVE" | "ENDED";
export type PlayerConnection = "CONNECTED" | "DISCONNECTED_PROTECTED" | "LEFT";
export type PlayerLife = "ALIVE" | "DEAD";
export type Facing = "up" | "down" | "left" | "right";

export class CoopPlayer extends Schema {
  declare name: string;
  declare wizard: WizardClassId;
  declare slot: number;
  declare connection: PlayerConnection;
  declare life: PlayerLife;
  declare x: number;
  declare y: number;
  declare facing: Facing;
  declare moving: boolean;
  declare hazardous: boolean;
  declare acknowledged: number;
  declare hp: number;
  declare maxHp: number;
  declare mp: number;
  declare maxMp: number;
  declare statuses: string;
  declare castAck: number;
  declare cooldowns: MapSchema<number>;

  constructor() {
    super();
    this.name = "";
    this.wizard = "fire";
    this.slot = 0;
    this.connection = "CONNECTED";
    this.life = "ALIVE";
    this.x = 0;
    this.y = 0;
    this.facing = "down";
    this.moving = false;
    this.hazardous = false;
    this.acknowledged = 0;
    this.hp = this.maxHp = this.mp = this.maxMp = this.castAck = 0;
    this.statuses = "";
    this.cooldowns = new MapSchema<number>();
  }
}

defineTypes(CoopPlayer, {
  name: "string",
  wizard: "string",
  slot: "uint8",
  connection: "string",
  life: "string",
  x: "float32",
  y: "float32",
  facing: "string",
  moving: "boolean",
  hazardous: "boolean",
  acknowledged: "uint32",
  hp: "uint16",
  maxHp: "uint16",
  mp: "uint16",
  maxMp: "uint16",
  statuses: "string",
  castAck: "uint32",
  cooldowns: { map: "uint16" },
});

export class CoopState extends Schema {
  declare code: string;
  declare leaderId: string;
  declare phase: PartyPhase;
  declare tick: number;
  declare players: MapSchema<CoopPlayer>;
  declare combat: CombatState;

  constructor() {
    super();
    this.code = "";
    this.leaderId = "";
    this.phase = "LOBBY";
    this.tick = 0;
    this.players = new MapSchema<CoopPlayer>();
    this.combat = new CombatState();
  }
}

defineTypes(CoopState, {
  code: "string",
  leaderId: "string",
  phase: "string",
  tick: "uint32",
  players: { map: CoopPlayer },
  combat: CombatState,
});

export function needsIncompleteConfirmation(connectedCount: number) {
  return connectedCount < PARTY_SIZE;
}

export interface PartySeat {
  name: string;
  roomId: string;
  sessionId: string;
  processId?: string;
  publicAddress?: string;
  reconnectionToken?: string;
  playerId: string;
  code: string;
}
