import type { DungeonMap, DungeonZone } from "../dungeon.js";
import { playerFacing, type WorldPoint } from "../movement.js";
import {
  combatBalance,
  enemies,
  enemyAppearances,
  guardAppearances,
  type EnemyAppearance,
  type EnemyKind,
} from "./balance.js";
import {
  bodyAt,
  center,
  clearSight,
  closest,
  directionTo,
  distance,
  eligible,
  immobile,
  safePoint,
  speedFactor,
  stepActor,
  type CombatPlayer,
  type Enemy,
} from "./rules.js";

export interface HostileAttack {
  source: string;
  at: WorldPoint;
  from: WorldPoint;
  range: number;
  width?: number;
  damage: number;
  delay: number;
  fx: string;
  push?: number;
  speed?: number;
  drain?: number;
}

interface Battlefield {
  expedition?: { zone: DungeonZone; secrets: ReadonlySet<string> };
  map: DungeonMap;
  players: Map<string, CombatPlayer>;
  monsters: Map<string, Enemy>;
  ended: boolean;
  bossPhase: number;
  summon(
    kind: EnemyKind,
    point: WorldPoint,
    encounter: string,
    lifetime?: number,
    appearance?: EnemyAppearance,
  ): Enemy | undefined;
  warn(attack: HostileAttack): void;
  teleport(enemy: Enemy, point: WorldPoint): void;
}

interface Encounter {
  zone: DungeonZone;
  actors: DungeonZone[];
  spawned: number;
  state: "waiting" | "fighting" | "clear";
}

function navigation(
  map: DungeonMap,
  source: WorldPoint,
  target: WorldPoint,
): WorldPoint | undefined {
  const start = map.worldToTile(source.x, source.y);
  const end = map.worldToTile(target.x, target.y);
  const key = (x: number, y: number) => y * map.width + x;
  const visited = new Set([key(start.x, start.y)]);
  const open: { x: number; y: number; first?: WorldPoint }[] = [start];
  let best: WorldPoint | undefined;
  let bestDistance = Infinity;
  for (let i = 0; i < open.length && i < 420; i++) {
    const current = open[i]!;
    const remaining = Math.abs(current.x - end.x) + Math.abs(current.y - end.y);
    if (current.first && remaining < bestDistance) {
      bestDistance = remaining;
      best = current.first;
      if (remaining === 0) break;
    }
    for (const [dx, dy] of [
      [1, 0],
      [0, 1],
      [-1, 0],
      [0, -1],
    ] as const) {
      const x = current.x + dx;
      const y = current.y + dy;
      const id = key(x, y);
      if (visited.has(id) || !map.atTile(x, y).walkable) continue;
      visited.add(id);
      const point = {
        x: (x + 0.5) * map.tileWidth,
        y: (y + 0.5) * map.tileHeight,
      };
      open.push({ x, y, first: current.first ?? point });
    }
  }
  return best;
}

const inZone = (zone: DungeonZone, p: WorldPoint) =>
  p.x >= zone.x &&
  p.y >= zone.y &&
  p.x < zone.x + zone.width &&
  p.y < zone.y + zone.height;
const teleportSpots = (map: DungeonMap) =>
  map.zones
    .filter((zone) => zone.kind === "boss_anchor")
    .map(center)
    .filter((point) => safePoint(map, point));

export class Encounters {
  readonly regions: Encounter[];
  readonly anchors: WorldPoint[];
  readonly gate: DungeonZone;
  readonly arenaEntry: WorldPoint[];
  readonly bossSpawn: WorldPoint;
  bossStarted = false;
  private pattern = 0;
  private patternPhase = 0;

  constructor(private readonly field: Battlefield) {
    const { map } = field;
    this.regions = map.zones
      .filter(({ kind }) => kind === "combat_region")
      .map((zone) => ({
        zone,
        actors: map.zones.filter(
          (actor) =>
            actor.kind === "combat_spawn" &&
            actor.properties.encounter === zone.id,
        ),
        spawned: 0,
        state: "waiting",
      }));
    const gate = map.zones.find((zone) => zone.kind === "boss_gate");
    const boss = map.zones.find((zone) => zone.kind === "boss_spawn");
    const arenaEntry = map.zones
      .filter((zone) => zone.kind === "arena_entry")
      .map(center);
    if (!gate || !boss || arenaEntry.length !== 4 || !this.regions.length)
      throw new Error("Missing online combat map metadata.");
    this.gate = gate;
    this.bossSpawn = center(boss);
    this.arenaEntry = arenaEntry;
    this.anchors = teleportSpots(map);
    if (
      this.anchors.length < 4 ||
      ![...arenaEntry, this.bossSpawn, center(gate)].every((point) =>
        safePoint(map, point),
      )
    )
      throw new Error("Unsafe combat map entry points.");
    for (const { actors } of this.regions)
      if (
        !actors.length ||
        actors.some(
          (actor) =>
            !safePoint(map, center(actor)) ||
            !Object.hasOwn(enemies, String(actor.properties.enemy)),
        )
      )
        throw new Error("Invalid encounter spawn metadata.");
  }

  get cleared() {
    return this.regions.filter(
      (r) => !r.zone.properties.optional && r.state === "clear",
    ).length;
  }
  get gateOpen() {
    return this.regions.every(
      (r) => r.zone.properties.optional || r.state === "clear",
    );
  }
  get current() {
    if (this.bossStarted) return "Shadow Overlord";
    return (
      this.regions
        .find(
          ({ state, zone }) =>
            state === "fighting" &&
            (!this.field.expedition ||
              zone.properties.zone === this.field.expedition.zone.id),
        )
        ?.zone.properties.title?.toString() ?? "Dungeon approach"
    );
  }

  enter(player: CombatPlayer) {
    if (
      !this.gateOpen ||
      this.bossStarted ||
      !eligible(player) ||
      immobile(player) ||
      distance(player.body, center(this.gate)) > 54 ||
      !clearSight(this.field.map, player.body, center(this.gate))
    )
      return false;
    if (!this.field.summon("overlord", this.bossSpawn, "boss")) return false;
    this.bossStarted = true;
    for (const member of this.field.players.values()) {
      if (eligible(member)) this.arrive(member);
    }
    return true;
  }

  arrive(player: CombatPlayer) {
    Object.assign(player.body, bodyAt(this.arenaEntry[player.slot]!));
  }

  step(ms: number) {
    const { players, monsters } = this.field;
    for (const region of this.regions) {
      const section = this.field.expedition?.zone.id;
      if (section && region.zone.properties.zone !== section) continue;
      if (
        region.state === "waiting" &&
        [...players.values()].some(
          (p) => eligible(p) && inZone(region.zone, p.body),
        )
      ) {
        region.state = "fighting";
      }
      if (
        region.state === "fighting" &&
        region.spawned < region.actors.length
      ) {
        for (const actor of region.actors.slice(region.spawned)) {
          let point = center(actor);
          if (region.zone.properties.zone) {
            const free = (p: WorldPoint) =>
              safePoint(this.field.map, p) &&
              ![...players.values(), ...monsters.values()].some(
                (a) => a.life === "ALIVE" && distance(a.body, p) < 26,
              ) &&
              !this.field.map
                .zonesAt(p.x, p.y)
                .some((z) => z.kind === "mana_restoration_zone");
            const found = [
              [0, 0],
              [32, 0],
              [-32, 0],
              [0, 32],
              [0, -32],
              [64, 0],
              [-64, 0],
              [0, 64],
              [0, -64],
            ]
              .map(([dx, dy]) => ({ x: point.x + dx!, y: point.y + dy! }))
              .find(free);
            if (!found) break;
            point = found;
          }
          const appearance = enemyAppearances.find(
            (a) => a === actor.properties.appearance,
          );
          const mob = this.field.summon(
            actor.properties.enemy as EnemyKind,
            point,
            region.zone.id,
            0,
            appearance,
          );
          if (!mob) break;
          if (actor.properties.elite) {
            mob.elite = String(actor.properties.elite);
            mob.hp = mob.maxHp = mob.kind === "lava" ? 264 : 216;
          }
          region.spawned++;
        }
      }
      if (
        region.state === "fighting" &&
        region.spawned === region.actors.length &&
        ![...monsters.values()].some(
          (mob) =>
            mob.encounter === region.zone.id &&
            !mob.lifetime &&
            mob.life === "ALIVE",
        )
      )
        region.state = "clear";
    }
    for (const mob of [...monsters.values()]) {
      if (mob.life !== "ALIVE" || this.field.ended) continue;
      if (mob.lifetime) {
        mob.lifetime -= ms;
        if (mob.lifetime <= 0) {
          monsters.delete(mob.id);
          continue;
        }
      }
      this.update(mob, ms);
    }
  }

  private update(mob: Enemy, ms: number) {
    const { field } = this;
    const { map, players } = field;
    const base = enemies[mob.kind];
    const spec = mob.elite
      ? {
          ...base,
          damage: base.damage + 5,
          windupMs: base.windupMs + 180,
          recoveryMs: base.recoveryMs - 300,
        }
      : base;
    const canSee = (p: CombatPlayer) =>
      eligible(p) &&
      distance(p.body, mob.body) <= spec.detection &&
      (mob.kind === "overlord" || clearSight(map, mob.body, p.body));
    const old = players.get(mob.target);
    const taunter = closest(
      players.values(),
      mob.body,
      (p) =>
        canSee(p) &&
        distance(p.body, mob.body) <= (p.statuses.get("Taunting")?.power ?? 0),
    );
    const nearest = closest(players.values(), mob.body, canSee);
    const target =
      taunter ??
      nearest ??
      (old &&
      eligible(old) &&
      distance(old.body, mob.home) < 410 &&
      distance(old.body, mob.body) < spec.detection + 85
        ? old
        : undefined);
    mob.target = target?.id ?? "";
    mob.attackIn = Math.max(0, mob.attackIn - ms);
    mob.body.moving = false;
    if (immobile(mob)) return;
    mob.repathIn -= ms;
    if (mob.kind === "overlord") {
      if (target && !mob.attackIn) this.bossAttack(mob, target);
      return;
    }
    if (!target) {
      const offsets = [
        { x: 0, y: 26 },
        { x: -25, y: 0 },
        { x: 0, y: -25 },
        { x: 25, y: 0 },
      ];
      const offset = offsets[Math.floor(mob.patrol / 1150) % offsets.length]!;
      mob.patrol += ms;
      mob.ai = "PATROL";
      const patrol = { x: mob.home.x + offset.x, y: mob.home.y + offset.y };
      this.walk(mob, safePoint(map, patrol) ? patrol : mob.home, ms, 0.55);
      return;
    }

    const range = distance(mob.body, target.body);
    const visible = clearSight(map, mob.body, target.body);
    if (range <= spec.range && visible && !mob.attackIn) {
      mob.ai = "ATTACK";
      mob.body.facing = playerFacing(
        directionTo(mob.body, target.body),
        mob.body.facing,
      );
      mob.attackIn = spec.windupMs + spec.recoveryMs;
      const ranged = mob.kind === "mage" || mob.kind === "illusion";
      field.warn({
        source: mob.id,
        from: { ...mob.body },
        at: { ...target.body },
        range: ranged ? spec.range + 22 : mob.kind === "lava" ? 37 : 29,
        damage: spec.damage,
        delay: spec.windupMs,
        fx: ranged
          ? "shadow/void-orb"
          : mob.kind === "lava"
            ? "fire/fire-breath"
            : "shadow/shadow-tendrils",
        ...(ranged ? { speed: 220 } : {}),
        ...(mob.kind === "lava" ? { push: 37 } : {}),
      });
      if (
        mob.kind === "mage" &&
        mob.summons < 2 &&
        field.monsters.size < combatBalance.limit.monsters
      ) {
        const point = {
          x: mob.home.x + 24 * (mob.summons ? -1 : 1),
          y: mob.home.y,
        };
        if (safePoint(map, point)) {
          field.summon(
            "servant",
            point,
            mob.encounter,
            13000,
            mob.summons === 0 ? "eye-beast" : "servant",
          );
          mob.summons++;
        }
      }
      return;
    }
    if (mob.attackIn > spec.recoveryMs) return;
    if (mob.kind === "mage" && range < 103) {
      const away = directionTo(target.body, mob.body);
      const dodge = {
        x: mob.body.x + away.x * 46,
        y: mob.body.y + away.y * 46,
      };
      mob.ai = "FLANK";
      if (safePoint(map, dodge)) this.walk(mob, dodge, ms, 1);
      return;
    }
    if (visible && range <= spec.range * 0.87) {
      mob.ai = "RECOVER";
      return;
    }
    const side = mob.kind === "shadow" && range > 90 && range < 150;
    const sign = Number(mob.id.split("-").at(-1)) % 2 ? 1 : -1;
    const flank = {
      x: target.body.x + sign * 38,
      y: target.body.y + sign * 23,
    };
    mob.ai = side ? "FLANK" : "CHASE";
    this.walk(mob, side && safePoint(map, flank) ? flank : target.body, ms, 1);
  }

  private walk(mob: Enemy, point: WorldPoint, ms: number, multiplier: number) {
    const { map } = this.field;
    if (distance(mob.home, point) > 400) point = mob.home;
    if (!clearSight(map, mob.body, point) || !safePoint(map, point)) {
      if (mob.repathIn <= 0) {
        const waypoint = navigation(map, mob.body, point);
        if (waypoint) mob.waypoint = waypoint;
        else delete mob.waypoint;
        mob.repathIn = 250;
      }
      if (!mob.waypoint) return;
      point = mob.waypoint;
    }
    const d = distance(mob.body, point);
    if (d < 2) {
      mob.repathIn = 0;
      return;
    }
    stepActor(
      map,
      mob,
      directionTo(mob.body, point),
      Math.min(
        d,
        (enemies[mob.kind].speed * speedFactor(mob) * multiplier * ms) / 1000,
      ),
      true,
    );
  }

  private bossAttack(boss: Enemy, target: CombatPlayer) {
    const phase = this.field.bossPhase;
    const config = combatBalance.boss;
    if (phase !== this.patternPhase) {
      this.patternPhase = phase;
      this.pattern = 0;
    }
    const turn = this.pattern++;
    const from = { ...boss.body };
    const at = { ...target.body };
    const warn = (
      radius: number,
      delay: number,
      fx: string,
      extra: Partial<HostileAttack> = {},
    ) =>
      this.field.warn({
        source: boss.id,
        from,
        at,
        range: radius,
        damage: enemies.overlord.damage,
        delay,
        fx,
        ...extra,
      });
    boss.ai = "ATTACK";
    boss.body.facing = playerFacing(
      directionTo(boss.body, target.body),
      boss.body.facing,
    );
    if (phase === 1) {
      boss.attackIn = config.phaseOne.recoverMs;
      if (turn % 3 === 0) {
        this.relocate(boss, target, turn);
        this.summon("illusion", config.illusions, config.illusionLifeMs);
      } else if (turn % 3 === 1) {
        warn(450, 650, "shadow/void-orb", {
          speed: config.phaseOne.shadowSpeed,
        });
      } else {
        warn(config.phaseOne.burstRadius, 880, "shadow/soul-drain", {
          drain: 9,
        });
      }
    } else if (phase === 2) {
      boss.attackIn = config.phaseTwo.recoverMs;
      if (turn % 3 === 0)
        this.summon("servant", config.summons, config.summonLifeMs);
      warn(config.phaseTwo.tendrilRadius, 850, "shadow/grasping-hands", {
        damage: 17,
      });
      if (turn % 2 === 0)
        warn(config.phaseTwo.floorRadius, 1160, "shadow/shadow-tendrils", {
          at: this.anchors[turn % this.anchors.length]!,
          damage: 14,
        });
    } else {
      boss.attackIn = config.phaseThree.recoverMs;
      if (turn % 2 === 0) {
        this.relocate(boss, target, turn);
        warn(config.phaseThree.beamRange, 900, "arcane/arcane-beam", {
          from: { ...boss.body },
          width: config.phaseThree.beamWidth,
          damage: 25,
        });
      } else {
        warn(config.phaseThree.blastRadius, 770, "shadow/dark-explosion", {
          damage: 20,
        });
        warn(
          config.phaseThree.blastRadius * 0.75,
          1050,
          "shadow/dark-explosion",
          {
            at: this.anchors[turn % this.anchors.length]!,
            damage: 15,
          },
        );
      }
    }
  }

  private relocate(boss: Enemy, target: CombatPlayer, turn: number) {
    const shifted = this.anchors
      .slice(turn % this.anchors.length)
      .concat(this.anchors.slice(0, turn % this.anchors.length));
    const next = shifted.find(
      (point) =>
        distance(point, target.body) > 90 &&
        distance(point, boss.body) > 40 &&
        [...this.field.players.values()].every(
          (player) => distance(point, player.body) > 28,
        ),
    );
    if (next) this.field.teleport(boss, next);
  }

  private summon(kind: EnemyKind, limit: number, lifetime: number) {
    const alive = [...this.field.monsters.values()].filter(
      (mob) =>
        mob.kind === kind && mob.encounter === "boss" && mob.life === "ALIVE",
    );
    const roster: readonly EnemyAppearance[] =
      kind === "servant" ? guardAppearances : ["illusion", "shadow"];
    const arrivals = roster.filter((look) =>
      alive.every((mob) => mob.appearance !== look),
    );
    for (const [index, point] of this.anchors
      .slice(0, limit - alive.length)
      .entries())
      this.field.summon(kind, point, "boss", lifetime, arrivals[index]);
  }
}
