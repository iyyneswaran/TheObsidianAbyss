import type { DungeonMap, DungeonZone } from "../dungeon.js";
import {
  movePlayer,
  normalizeMovement,
  playerSpeed,
  playerTerrain,
  type PlayerTransform,
  type WorldPoint,
} from "../movement.js";
import {
  combatBalance,
  type Ability,
  type AbilitySlot,
  type CombatClass,
  type EnemyKind,
  type EnemyAppearance,
  type Status,
} from "./balance.js";
import type { Equipment } from "./alternates.js";

export type Life = "ALIVE" | "DEAD";
export type Outcome = "VICTORY" | "DEFEAT";
export type AI =
  "IDLE" | "PATROL" | "CHASE" | "FLANK" | "ATTACK" | "RECOVER" | "DEAD";
export interface TimedStatus {
  remaining: number;
  power: number;
  next: number;
  source: string;
}
export interface Fighter {
  id: string;
  body: PlayerTransform;
  hp: number;
  maxHp: number;
  life: Life;
  statuses: Map<Status, TimedStatus>;
}
export interface CombatPlayer extends Fighter {
  wizard: CombatClass;
  name: string;
  slot: number;
  mp: number;
  maxMp: number;
  cooldowns: Record<AbilitySlot, number>;
  protected: boolean;
  forfeited: boolean;
  lavaIn: number;
  sequence: number;
  rateElapsed: number;
  rateCount: number;
  damage: number;
  healing: number;
  mitigation: number;
  kills: number;
  equipment: Equipment;
  abilities: Readonly<Record<AbilitySlot, Ability>>;
}
export interface Enemy extends Fighter {
  elite?: string;
  kind: EnemyKind;
  appearance: EnemyAppearance;
  home: WorldPoint;
  encounter: string;
  ai: AI;
  target: string;
  attackIn: number;
  repathIn: number;
  waypoint?: WorldPoint;
  patrol: number;
  lifetime: number;
  summons: number;
  contributions: Map<string, number>;
}
export interface CastInput {
  slot: AbilitySlot;
  sequence: number;
  x: number;
  y: number;
}
export interface CombatEvent {
  id: number;
  kind:
    | "cast"
    | "projectile"
    | "impact"
    | "damage"
    | "heal"
    | "status"
    | "remove"
    | "death"
    | "phase"
    | "teleport"
    | "warning"
    | "outcome"
    | "mana";
  x: number;
  y: number;
  source?: string;
  target?: string;
  fx?: string;
  amount?: number;
  angle?: number;
  duration?: number;
}
export interface RunParticipant {
  id: string;
  name: string;
  wizard: CombatClass;
  status: "Survived" | "Dead" | "Forfeited";
  damage: number;
  healing: number;
  mitigation: number;
  kills: number;
  slot: number;
  protectedAtEnd: boolean;
}
export interface RunResult {
  id: string;
  outcome: Outcome;
  participants: RunParticipant[];
  monsters: number;
  bossDefeated: boolean;
  durationMs: number;
  qualifies: boolean;
}

export type ProgressMetric =
  | "damage"
  | "heal"
  | "mitigate"
  | "kill"
  | "mana"
  | "burn"
  | "freeze"
  | "chain"
  | "slow"
  | "push"
  | "run"
  | "discovery"
  | "victory";
export interface CombatProgress {
  source?: string;
  playerId: string;
  wizard: CombatClass;
  metric: ProgressMetric;
  amount: number;
}

export const distance = (a: WorldPoint, b: WorldPoint) =>
  Math.hypot(b.x - a.x, b.y - a.y);
export const directionTo = (a: WorldPoint, b: WorldPoint) =>
  normalizeMovement({ x: b.x - a.x, y: b.y - a.y });
export const center = (zone: DungeonZone) => ({
  x: zone.x + zone.width / 2,
  y: zone.y + zone.height / 2,
});
export const eligible = (actor: CombatPlayer) =>
  actor.life === "ALIVE" && !actor.protected && !actor.forfeited;
export const immobile = (actor: Fighter) =>
  actor.statuses.has("Frozen") || actor.statuses.has("Stunned");
export const speedFactor = (actor: Fighter) =>
  immobile(actor)
    ? 0
    : actor.statuses.has("Slowed")
      ? combatBalance.slowMultiplier
      : 1;
export const bodyAt = (point: WorldPoint): PlayerTransform => ({
  ...point,
  facing: "down",
  moving: false,
});

/** Traverse every crossed tile, rejecting the two side tiles of an exact corner crossing. */
export function clearSight(map: DungeonMap, a: WorldPoint, b: WorldPoint) {
  const first = map.worldToTile(a.x, a.y);
  const last = map.worldToTile(b.x, b.y);
  let { x, y } = first;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const sx = Math.sign(dx);
  const sy = Math.sign(dy);
  const tx = dx ? map.tileWidth / Math.abs(dx) : Infinity;
  const ty = dy ? map.tileHeight / Math.abs(dy) : Infinity;
  let nextX = dx ? ((x + Number(dx > 0)) * map.tileWidth - a.x) / dx : Infinity;
  let nextY = dy
    ? ((y + Number(dy > 0)) * map.tileHeight - a.y) / dy
    : Infinity;
  const blocked = (col: number, row: number) => {
    const tile = map.atTile(col, row);
    return tile.blocksSight || tile.solid;
  };
  while (true) {
    if (blocked(x, y)) return false;
    if (x === last.x && y === last.y) return true;
    if (Math.abs(nextX - nextY) < 1e-9 && x !== last.x && y !== last.y) {
      if (blocked(x + sx, y) || blocked(x, y + sy)) return false;
      x += sx;
      y += sy;
      nextX += tx;
      nextY += ty;
    } else if (y === last.y || (x !== last.x && nextX < nextY)) {
      x += sx;
      nextX += tx;
    } else {
      y += sy;
      nextY += ty;
    }
  }
}

export function stepActor(
  map: DungeonMap,
  actor: Fighter,
  direction: WorldPoint,
  pixels: number,
  safe = false,
) {
  const next = movePlayer(
    map,
    actor.body,
    direction,
    (pixels * 1000) / playerSpeed,
  );
  if (!safe || !playerTerrain(map, next).hazardous)
    Object.assign(actor.body, next);
  else actor.body.moving = false;
}

export function closest<T extends Fighter>(
  actors: Iterable<T>,
  point: WorldPoint,
  valid: (actor: T) => boolean,
) {
  let result: T | undefined;
  let best = Infinity;
  for (const actor of actors) {
    const d = distance(point, actor.body);
    if (d < best && valid(actor)) {
      result = actor;
      best = d;
    }
  }
  return result;
}

export function safePoint(map: DungeonMap, point: WorldPoint) {
  const terrain = playerTerrain(map, point);
  return !terrain.solid && !terrain.hazardous;
}
