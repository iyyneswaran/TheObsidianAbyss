import { defineTypes, MapSchema, Schema } from "@colyseus/schema";
import { z } from "zod";

export const castSchema = z.strictObject({
  slot: z.enum(["BASIC", "SKILL_1", "SKILL_2", "SKILL_3", "ULTIMATE"]),
  sequence: z.number().int().min(1).max(0xffffffff),
  x: z.number().finite().min(0).max(16384),
  y: z.number().finite().min(0).max(16384),
});
export const interactSchema = z.strictObject({
  revision: z.number().int().positive().optional(),
});

export class MonsterState extends Schema {
  declare kind: string;
  declare appearance: string;
  declare x: number;
  declare y: number;
  declare facing: string;
  declare moving: boolean;
  declare hp: number;
  declare maxHp: number;
  declare action: string;
  declare target: string;
  declare statuses: string;

  constructor() {
    super();
    this.kind = "";
    this.appearance = "";
    this.x = this.y = this.hp = this.maxHp = 0;
    this.facing = "down";
    this.moving = false;
    this.action = this.target = this.statuses = "";
  }
}
defineTypes(MonsterState, {
  kind: "string",
  appearance: "string",
  x: "float32",
  y: "float32",
  facing: "string",
  moving: "boolean",
  hp: "uint16",
  maxHp: "uint16",
  action: "string",
  target: "string",
  statuses: "string",
});

export class SpellState extends Schema {
  declare x: number;
  declare y: number;
  declare fromX: number;
  declare fromY: number;
  declare angle: number;
  declare radius: number;
  declare width: number;
  declare hostile: boolean;
  declare fx: string;

  constructor() {
    super();
    this.x =
      this.y =
      this.fromX =
      this.fromY =
      this.angle =
      this.radius =
      this.width =
        0;
    this.hostile = false;
    this.fx = "";
  }
}
defineTypes(SpellState, {
  x: "float32",
  y: "float32",
  fromX: "float32",
  fromY: "float32",
  angle: "float32",
  radius: "float32",
  width: "uint16",
  hostile: "boolean",
  fx: "string",
});

export class CombatState extends Schema {
  declare settlement: string;
  declare enemies: MapSchema<MonsterState>;
  declare projectiles: MapSchema<SpellState>;
  declare telegraphs: MapSchema<SpellState>;
  declare encounter: string;
  declare cleared: number;
  declare gateOpen: boolean;
  declare phase: number;
  declare result: string;
  declare elapsed: number;

  constructor() {
    super();
    this.enemies = new MapSchema<MonsterState>();
    this.projectiles = new MapSchema<SpellState>();
    this.telegraphs = new MapSchema<SpellState>();
    this.encounter = this.result = "";
    this.settlement = "";
    this.cleared = this.phase = this.elapsed = 0;
    this.gateOpen = false;
  }
}
defineTypes(CombatState, {
  settlement: "string",
  enemies: { map: MonsterState },
  projectiles: { map: SpellState },
  telegraphs: { map: SpellState },
  encounter: "string",
  cleared: "uint8",
  gateOpen: "boolean",
  phase: "uint8",
  result: "string",
  elapsed: "uint32",
});
