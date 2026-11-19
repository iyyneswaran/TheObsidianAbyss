import type { DungeonMap } from "../dungeon.js";
import {
  defaultEquipment,
  equippedAbilities,
  type Equipment,
} from "./alternates.js";
import {
  playerTerrain,
  type PlayerTransform,
  type WorldPoint,
} from "../movement.js";
import {
  abilitySlots,
  combatBalance,
  enemies,
  loadouts,
  type Ability,
  type CombatClass,
  type Effect,
  type EnemyKind,
  type EnemyAppearance,
  type Status,
} from "./balance.js";
import { Encounters, type HostileAttack } from "./encounters.js";
import {
  bodyAt,
  clearSight,
  closest,
  directionTo,
  distance,
  eligible,
  immobile,
  stepActor,
  type CastInput,
  type CombatEvent,
  type CombatPlayer,
  type CombatProgress,
  type Enemy,
  type Fighter,
  type Outcome,
  type ProgressMetric,
  type RunResult,
} from "./rules.js";

type PendingEvent = Omit<CombatEvent, "id">;
interface Target {
  point: WorldPoint;
  actor?: Fighter;
  friendly?: boolean;
}
export interface Shot {
  id: string;
  source: string;
  hostile: boolean;
  point: WorldPoint;
  direction: WorldPoint;
  speed: number;
  left: number;
  fx: string;
  effect: Effect;
}
export interface Area {
  id: string;
  source: string;
  origin: WorldPoint;
  point: WorldPoint;
  radius: number;
  width: number;
  angle: number;
  expires: number;
  hostile: boolean;
  fx: string;
  execute: () => void;
}
const angleTo = (a: WorldPoint, b: WorldPoint) =>
  Math.atan2(b.y - a.y, b.x - a.x);

export class CombatRun {
  readonly players = new Map<string, CombatPlayer>();
  readonly monsters = new Map<string, Enemy>();
  readonly shots = new Map<string, Shot>();
  readonly areas = new Map<string, Area>();
  readonly encounters: Encounters;
  readonly events: CombatEvent[] = [];
  bossPhase = 0;
  time = 0;
  monstersDefeated = 0;
  result?: RunResult;
  private entitySequence = 0;
  private eventSequence = 0;
  private hadCombat = false;

  constructor(
    readonly id: string,
    readonly map: DungeonMap,
    private readonly onProgress?: (event: CombatProgress) => void,
  ) {
    this.encounters = new Encounters(this);
  }

  get ended() {
    return Boolean(this.result);
  }

  addPlayer(
    id: string,
    name: string,
    wizard: CombatClass,
    slot: number,
    body: PlayerTransform,
    protectedSeat = false,
    equipment: Equipment = defaultEquipment,
  ) {
    const { hp, mp } = loadouts[wizard];
    this.players.set(id, {
      id,
      name,
      wizard,
      slot,
      body,
      hp,
      mp,
      maxHp: hp,
      maxMp: mp,
      life: "ALIVE",
      statuses: new Map(),
      cooldowns: Object.fromEntries(
        abilitySlots.map((key) => [key, 0]),
      ) as CombatPlayer["cooldowns"],
      protected: protectedSeat,
      forfeited: false,
      lavaIn: combatBalance.lava.intervalMs * 0.7,
      sequence: 0,
      rateElapsed: 0,
      rateCount: 0,
      damage: 0,
      healing: 0,
      mitigation: 0,
      kills: 0,
      equipment: { ...equipment },
      abilities: equippedAbilities(wizard, equipment),
    });
  }

  setProtected(id: string, value: boolean) {
    const player = this.players.get(id);
    if (!player) return;
    player.protected = value;
    if (value) this.cancel(id);
    else if (
      this.encounters.bossStarted &&
      player.life === "ALIVE" &&
      !this.map
        .zonesAt(player.body.x, player.body.y)
        .some((zone) => zone.kind === "boss_arena")
    )
      this.encounters.arrive(player);
  }

  forfeit(id: string) {
    const player = this.players.get(id);
    if (player) player.forfeited = true;
    this.cancel(id);
    this.checkDefeat();
  }

  interact(id: string) {
    const player = this.players.get(id);
    return Boolean(!this.ended && player && this.encounters.enter(player));
  }

  summon(
    kind: EnemyKind,
    point: WorldPoint,
    encounter: string,
    lifetime = 0,
    appearance: EnemyAppearance = kind === "shadow" ? "ghost-wisp" : kind,
  ) {
    if (this.ended || this.monsters.size >= combatBalance.limit.monsters)
      return undefined;
    const id = this.nextId(kind);
    const maxHp = enemies[kind].hp;
    const enemy: Enemy = {
      id,
      kind,
      appearance,
      home: point,
      encounter,
      hp: maxHp,
      maxHp,
      body: bodyAt(point),
      life: "ALIVE",
      statuses: new Map(),
      ai: "IDLE",
      target: "",
      attackIn: kind === "overlord" ? 2200 : 480,
      repathIn: 0,
      patrol: 0,
      summons: 0,
      contributions: new Map(),
      lifetime,
    };
    this.monsters.set(id, enemy);
    if (kind === "overlord") this.setPhase(enemy);
    else this.emit("impact", point, { target: id, fx: "spawn/summon-rise" });
    return enemy;
  }

  teleport(enemy: Enemy, point: WorldPoint) {
    Object.assign(enemy.body, bodyAt(point));
    this.emit("teleport", point, { source: enemy.id, fx: "arcane/portal" });
  }

  cast(id: string, input: CastInput): string | undefined {
    const player = this.players.get(id);
    if (this.ended || !player || !eligible(player))
      return "Your wizard cannot cast.";
    if (input.sequence <= player.sequence) return "That cast already expired.";
    player.sequence = input.sequence;
    if (++player.rateCount > combatBalance.limit.castsPerSecond)
      return "Casting too quickly.";
    if (immobile(player)) return "Your wizard is immobilized.";
    const ability = player.abilities[input.slot];
    if (!ability) return "Unknown ability.";
    if (player.cooldowns[input.slot] > 0) return "Ability is cooling down.";
    if (player.mp < ability.mana) return "Insufficient mana.";
    const aim = { x: input.x, y: input.y };
    if (
      !Number.isFinite(aim.x) ||
      !Number.isFinite(aim.y) ||
      aim.x < 0 ||
      aim.y < 0 ||
      aim.x >= this.map.worldWidth ||
      aim.y >= this.map.worldHeight
    )
      return "Invalid aim.";
    const target = this.target(player, ability, aim);
    if (!target) return "No valid target in range and sight.";
    const needsArea = ability.delayMs || ability.pulses;
    if (
      (needsArea && this.areas.size >= combatBalance.limit.areas) ||
      (ability.shape === "projectile" &&
        this.shots.size >= combatBalance.limit.shots)
    )
      return "Too many active spells.";

    player.mp -= ability.mana;
    player.cooldowns[input.slot] = ability.cooldownMs;
    const charged = ability.damage && player.statuses.get("Charged");
    const effect = charged
      ? { ...ability, damage: (ability.damage ?? 0) + charged.power }
      : ability;
    if (charged) this.removeStatus(player, "Charged");
    const origin = { ...player.body };
    const visual = ability.shape === "projectile" ? undefined : ability.fx;
    this.emit("cast", target.point, {
      source: id,
      angle: angleTo(origin, target.point),
      ...(visual ? { fx: visual } : {}),
      ...(target.actor ? { target: target.actor.id } : {}),
    });
    const execute = () => {
      if (!this.ended && eligible(player) && !immobile(player))
        this.resolve(player, ability, effect, target, origin);
    };
    if (needsArea) {
      const delay = ability.delayMs ?? 1;
      this.schedule(
        {
          source: id,
          origin,
          point: target.point,
          radius: ability.radius ?? ability.range,
          width: 0,
          angle: angleTo(origin, target.point),
          hostile: false,
          fx: ability.fx,
        },
        delay,
        execute,
        ability.pulses,
        ability.pulseMs,
      );
    } else execute();
    return undefined;
  }

  warn(attack: HostileAttack) {
    const direction = directionTo(attack.from, attack.at);
    const angle = angleTo(attack.from, attack.at);
    const axisEnd = {
      x: attack.from.x + direction.x * attack.range,
      y: attack.from.y + direction.y * attack.range,
    };
    this.schedule(
      {
        source: attack.source,
        origin: attack.from,
        point: attack.width || attack.speed ? axisEnd : attack.at,
        radius: attack.range,
        width: attack.width ?? (attack.speed ? 10 : 0),
        angle,
        hostile: true,
        fx: attack.fx,
      },
      attack.delay,
      () => {
        const mob = this.monsters.get(attack.source);
        if (!mob || mob.life !== "ALIVE" || immobile(mob)) return;
        if (attack.speed) {
          this.launch(
            attack.source,
            true,
            attack.from,
            direction,
            attack.range,
            attack.speed,
            attack.fx,
            { damage: attack.damage },
          );
          return;
        }
        const valid = (p: CombatPlayer) => {
          if (!eligible(p) || !clearSight(this.map, attack.from, p.body))
            return false;
          if (!attack.width) return distance(attack.at, p.body) <= attack.range;
          const x = p.body.x - attack.from.x;
          const y = p.body.y - attack.from.y;
          const projected = x * direction.x + y * direction.y;
          return (
            projected >= 0 &&
            projected <= attack.range &&
            Math.abs(x * direction.y - y * direction.x) <= attack.width / 2
          );
        };
        this.emit("impact", attack.width ? attack.from : attack.at, {
          source: mob.id,
          fx: attack.fx,
          angle,
        });
        for (const p of this.players.values()) {
          if (!valid(p)) continue;
          const hit = this.damage(p, attack.damage, mob.id);
          if (hit && eligible(p)) {
            if (attack.push)
              stepActor(
                this.map,
                p,
                directionTo(attack.from, p.body),
                attack.push,
              );
            if (attack.drain) p.mp = Math.max(0, p.mp - attack.drain);
          }
        }
      },
    );
  }

  step(ms: number) {
    if (this.ended) return;
    this.time += ms;
    for (const player of this.players.values()) {
      if (!eligible(player)) continue;
      player.rateElapsed += ms;
      if (player.rateElapsed >= 1000) {
        player.rateElapsed %= 1000;
        player.rateCount = 0;
      }
      for (const slot of abilitySlots)
        player.cooldowns[slot] = Math.max(0, player.cooldowns[slot] - ms);
      this.statusStep(player, ms);
      if (eligible(player)) this.environment(player, ms);
    }
    for (const mob of this.monsters.values()) this.statusStep(mob, ms);
    if (this.ended) return;
    this.encounters.step(ms);
    for (const area of this.areas.values()) {
      if (area.expires > this.time) continue;
      this.areas.delete(area.id);
      area.execute();
      if (this.ended) return;
    }
    for (const shot of this.shots.values()) {
      this.advance(shot, Math.min(shot.left, (shot.speed * ms) / 1000));
      if (this.ended) return;
    }
    this.checkDefeat();
  }

  private target(
    player: CombatPlayer,
    ability: Ability,
    aim: WorldPoint,
  ): Target | undefined {
    const from = player.body;
    const inRange = (actor: Fighter) =>
      distance(from, actor.body) <= ability.range &&
      clearSight(this.map, from, actor.body);
    const hostile = (enemy: Enemy) => enemy.life === "ALIVE" && inRange(enemy);
    if (ability.aim === "self") return { point: { ...from } };
    if (ability.aim === "direction")
      return distance(from, aim) > 2 ? { point: aim } : undefined;
    if (ability.aim === "ground")
      return distance(from, aim) <= ability.range &&
        clearSight(this.map, from, aim)
        ? { point: aim }
        : undefined;
    if (ability.aim === "halo") {
      const friend = closest(
        this.players.values(),
        aim,
        (p) =>
          eligible(p) &&
          p.hp < p.maxHp &&
          inRange(p) &&
          distance(aim, p.body) <= 26,
      );
      if (friend)
        return { point: { ...friend.body }, actor: friend, friendly: true };
    }
    const aimed = ability.aim === "enemy";
    const enemy = closest(
      this.monsters.values(),
      aimed ? aim : from,
      (mob) =>
        hostile(mob) &&
        (!aimed ||
          distance(mob.body, aim) <= (mob.kind === "overlord" ? 45 : 32)),
    );
    if (enemy) return { point: { ...enemy.body }, actor: enemy };
    if (ability.aim === "halo" && player.hp < player.maxHp)
      return { point: { ...from }, actor: player, friendly: true };
    return undefined;
  }

  private resolve(
    player: CombatPlayer,
    ability: Ability,
    effect: Effect,
    target: Target,
    origin: WorldPoint,
  ) {
    const source = player.id;
    const direction = directionTo(origin, target.point);
    const buff = (kind: Status, amount: number) =>
      this.applyStatus(player, kind, ability.buffMs ?? 0, amount, player.id);
    if (ability.shield) buff("Shielded", ability.shield);
    if (ability.block) buff("Blocking", ability.block);
    if (ability.charge) buff("Charged", ability.charge);
    if (ability.taunt) buff("Taunting", ability.radius ?? 0);
    switch (ability.shape) {
      case "dash":
        stepActor(this.map, player, direction, ability.range);
        break;
      case "projectile":
        this.launch(
          source,
          false,
          origin,
          direction,
          ability.range + 16,
          ability.speed!,
          ability.fx,
          effect,
        );
        break;
      case "direct":
        if (target.friendly)
          this.heal(target.actor as CombatPlayer, ability.heal ?? 0, player);
        else if (target.actor)
          this.applyHit(target.actor, effect, source, origin);
        break;
      case "chain": {
        const hit = new Set<string>();
        let eligibleHits = 0;
        let next = target.actor as Enemy | undefined;
        for (
          let jump = 0;
          next && jump < (ability.jumps ?? 1) && !this.ended;
          jump++
        ) {
          const point = next.body;
          hit.add(next.id);
          if (this.progressEnemy(next.id)) eligibleHits++;
          this.applyHit(next, effect, source, origin);
          this.emit("impact", point, {
            target: next.id,
            source,
            fx: ability.fx,
          });
          next = closest(
            this.monsters.values(),
            point,
            (mob) =>
              mob.life === "ALIVE" &&
              !hit.has(mob.id) &&
              distance(point, mob.body) <= (ability.radius ?? 0) &&
              clearSight(this.map, point, mob.body),
          );
        }
        if (eligibleHits > 1) this.credit(player, "chain", eligibleHits);
        break;
      }
      case "radius":
      case "line":
      case "cone": {
        const radial = ability.shape === "radius";
        const point = radial ? target.point : origin;
        const radius = radial ? (ability.radius ?? 0) : ability.range;
        const within = (actor: Fighter) => {
          if (
            distance(point, actor.body) > radius ||
            !clearSight(this.map, point, actor.body)
          )
            return false;
          const ray = directionTo(point, actor.body);
          if (ability.shape === "line") {
            const dx = actor.body.x - point.x;
            const dy = actor.body.y - point.y;
            return (
              dx * direction.x + dy * direction.y >= 0 &&
              Math.abs(dx * direction.y - dy * direction.x) <=
                (ability.width ?? 0) / 2
            );
          }
          return radial || ray.x * direction.x + ray.y * direction.y >= 0.72;
        };
        if (effect.heal)
          for (const p of this.players.values())
            if (within(p)) this.heal(p, effect.heal, player);
        if (effect.damage)
          for (const mob of this.monsters.values())
            if (within(mob)) this.applyHit(mob, effect, source, point);
        break;
      }
    }
  }

  private schedule(
    fields: Omit<Area, "id" | "expires" | "execute">,
    delay: number,
    action: () => void,
    remaining = 1,
    interval = 0,
  ) {
    if (this.areas.size >= combatBalance.limit.areas || this.ended) return;
    const id = this.nextId("area");
    this.areas.set(id, {
      ...fields,
      id,
      expires: this.time + delay,
      execute: () => {
        action();
        if (remaining > 1)
          this.schedule(fields, interval, action, remaining - 1, interval);
      },
    });
    this.emit("warning", fields.point, {
      source: fields.source,
      duration: delay,
      angle: fields.angle,
    });
  }

  private launch(
    source: string,
    hostile: boolean,
    origin: WorldPoint,
    direction: WorldPoint,
    length: number,
    speed: number,
    fx: string,
    effect: Effect,
  ) {
    if (this.shots.size >= combatBalance.limit.shots || this.ended) return;
    const id = this.nextId("shot");
    this.shots.set(id, {
      id,
      source,
      hostile,
      point: { ...origin },
      direction,
      fx,
      speed,
      left: length,
      effect,
    });
    this.emit("projectile", origin, {
      source,
      target: id,
      fx,
      angle: Math.atan2(direction.y, direction.x),
    });
  }

  private advance(shot: Shot, pixels: number) {
    const samples = Math.max(1, Math.ceil(pixels / 4));
    const step = pixels / samples;
    for (let sample = 0; sample < samples; sample++) {
      const next = {
        x: shot.point.x + step * shot.direction.x,
        y: shot.point.y + step * shot.direction.y,
      };
      if (!clearSight(this.map, shot.point, next)) {
        this.shots.delete(shot.id);
        return;
      }
      shot.point = next;
      const candidates: Iterable<Fighter> = shot.hostile
        ? this.players.values()
        : this.monsters.values();
      const target = closest(
        candidates,
        next,
        (actor) =>
          actor.life === "ALIVE" &&
          (!shot.hostile || eligible(actor as CombatPlayer)) &&
          distance(actor.body, next) <=
            ((actor as Enemy).kind === "overlord" ? 28 : 14) &&
          clearSight(this.map, next, actor.body),
      );
      if (target) {
        this.shots.delete(shot.id);
        this.emit("impact", next, {
          source: shot.source,
          target: target.id,
          fx: shot.fx,
          angle: Math.atan2(shot.direction.y, shot.direction.x),
        });
        this.applyHit(target, shot.effect, shot.source, next);
        return;
      }
    }
    shot.left -= pixels;
    if (shot.left <= 0.01) this.shots.delete(shot.id);
  }

  private applyHit(
    target: Fighter,
    effect: Effect,
    source: string,
    point: WorldPoint,
  ) {
    this.damage(target, effect.damage ?? 0, source);
    if (target.life !== "ALIVE" || this.ended) return;
    if (effect.status && effect.statusMs) {
      const duration =
        (target as Enemy).kind === "overlord"
          ? effect.statusMs * 0.27
          : effect.statusMs;
      this.applyStatus(target, effect.status, duration, 0, source);
      if (immobile(target)) {
        target.body.moving = false;
        this.cancel(target.id);
      }
    }
    if (effect.push && (target as Enemy).kind !== "overlord") {
      const start = { ...target.body };
      stepActor(
        this.map,
        target,
        effect.push > 0
          ? directionTo(point, target.body)
          : directionTo(target.body, point),
        Math.min(
          Math.abs(effect.push),
          effect.push < 0 ? distance(point, target.body) : Infinity,
        ),
        true,
      );
      const caster = this.players.get(source);
      if (
        caster &&
        this.progressEnemy(target.id) &&
        distance(start, target.body) >= 1
      )
        this.credit(caster, "push", 1);
    }
  }

  damage(target: Fighter, amount: number, source: string) {
    if (
      this.ended ||
      target.life !== "ALIVE" ||
      !Number.isFinite(amount) ||
      amount <= 0
    )
      return 0;
    const player = this.players.get(target.id);
    if (player && (!eligible(player) || this.players.has(source))) return 0;
    const incoming = Math.ceil(amount);
    const realAttack = Boolean(player && this.monsters.has(source));
    if (realAttack) this.hadCombat = true;
    const blocking = target.statuses.get("Blocking");
    const shield = target.statuses.get("Shielded");
    if (blocking) amount *= 1 - blocking.power;
    amount = Math.ceil(amount);
    if (shield) {
      const absorbed = Math.min(amount, shield.power);
      amount -= absorbed;
      shield.power -= absorbed;
      if (!shield.power) this.removeStatus(target, "Shielded");
    }
    if (player && realAttack && incoming > amount) {
      player.mitigation += incoming - amount;
      this.credit(player, "mitigate", incoming - amount);
    }
    const lost = Math.min(target.hp, amount);
    if (lost <= 0) return 0;
    target.hp -= lost;
    const caster = this.players.get(source);
    if (caster) {
      caster.damage += lost;
      const enemy = this.progressEnemy(target.id);
      if (enemy) {
        this.hadCombat = true;
        enemy.contributions.set(
          caster.id,
          (enemy.contributions.get(caster.id) ?? 0) + lost,
        );
        this.credit(caster, "damage", lost);
      }
    }
    this.emit("damage", target.body, {
      source,
      target: target.id,
      amount: lost,
    });
    if (target.hp === 0) this.die(target, source);
    else if ((target as Enemy).kind === "overlord")
      this.setPhase(target as Enemy);
    return lost;
  }

  heal(target: CombatPlayer, amount: number, source: CombatPlayer) {
    if (
      this.ended ||
      !eligible(target) ||
      !eligible(source) ||
      !Number.isFinite(amount) ||
      amount <= 0
    )
      return 0;
    const restored = Math.min(target.maxHp - target.hp, amount);
    if (restored <= 0) return 0;
    target.hp += restored;
    source.healing += restored;
    if (source.id !== target.id) this.credit(source, "heal", restored);
    this.emit("heal", target.body, {
      source: source.id,
      target: target.id,
      amount: restored,
    });
    return restored;
  }

  private applyStatus(
    target: Fighter,
    key: Status,
    duration: number,
    power: number,
    source: string,
  ) {
    const old = target.statuses.get(key);
    const caster = this.players.get(source);
    if (!old && caster && this.progressEnemy(target.id)) {
      if (key === "Burning") this.credit(caster, "burn", 1);
      if (key === "Frozen") this.credit(caster, "freeze", 1);
      if (key === "Slowed") this.credit(caster, "slow", 1);
    }
    target.statuses.set(key, {
      remaining: Math.max(duration, old?.remaining ?? 0),
      power: Math.max(power, old?.power ?? 0),
      next: old?.next ?? combatBalance.burn.intervalMs,
      source,
    });
    this.emit("status", target.body, { source, target: target.id, duration });
  }

  private removeStatus(target: Fighter, key: Status) {
    target.statuses.delete(key);
    this.emit("remove", target.body, { target: target.id });
  }

  private statusStep(target: Fighter, ms: number) {
    for (const [key, effect] of target.statuses) {
      if (key === "Burning") {
        effect.next -= Math.min(ms, effect.remaining);
        if (effect.next <= 0) {
          const author = this.players.get(effect.source);
          if (!author || eligible(author))
            this.damage(target, combatBalance.burn.damage, effect.source);
          effect.next += combatBalance.burn.intervalMs;
        }
      }
      effect.remaining -= ms;
      if (effect.remaining <= 0 && target.statuses.has(key))
        this.removeStatus(target, key);
    }
  }

  private environment(player: CombatPlayer, ms: number) {
    if (playerTerrain(this.map, player.body).hazardous) {
      player.lavaIn -= ms;
      if (player.lavaIn <= 0) {
        player.lavaIn += combatBalance.lava.intervalMs;
        this.damage(player, combatBalance.lava.damage, "lava");
      }
    }
    if (!eligible(player)) return;
    const restoring = this.map
      .zonesAt(player.body.x, player.body.y)
      .some((zone) => zone.kind === "mana_restoration_zone");
    if (restoring && player.mp < player.maxMp) {
      const previous = Math.floor(player.mp);
      player.mp = Math.min(
        player.maxMp,
        player.mp + (combatBalance.shrinePerSecond * ms) / 1000,
      );
      this.credit(player, "mana", Math.floor(player.mp) - previous);
      if (Math.floor(player.mp / 20) > Math.floor(previous / 20))
        this.emit("mana", player.body, {
          target: player.id,
          fx: "arcane/mana-burst",
        });
    }
  }

  private die(target: Fighter, source: string) {
    target.life = "DEAD";
    target.body.moving = false;
    target.statuses.clear();
    this.cancel(target.id);
    const mob = this.monsters.get(target.id);
    this.emit("death", target.body, {
      source,
      target: target.id,
      fx:
        mob?.kind === "overlord"
          ? "explosions/big-explosion"
          : "spawn/disintegrate",
    });
    if (mob) {
      if (!mob.lifetime && mob.kind !== "overlord") {
        for (const [id, damage] of mob.contributions) {
          const contributor = this.players.get(id);
          if (
            contributor &&
            eligible(contributor) &&
            (id === source || damage >= mob.maxHp * 0.2)
          ) {
            contributor.kills++;
            this.credit(contributor, "kill", 1);
          }
        }
      }
      mob.ai = "DEAD";
      this.monsters.delete(target.id);
      if (mob.kind === "overlord") this.finish("VICTORY");
      else if (mob.kind !== "illusion") this.monstersDefeated++;
    } else this.checkDefeat();
  }

  private cancel(id: string) {
    for (const area of this.areas.values())
      if (area.source === id) this.areas.delete(area.id);
    for (const shot of this.shots.values())
      if (shot.source === id) this.shots.delete(shot.id);
  }

  private setPhase(boss: Enemy) {
    const [first, second] = combatBalance.bossPhases;
    const ratio = boss.hp / boss.maxHp;
    const phase = ratio <= second ? 3 : ratio <= first ? 2 : 1;
    while (this.bossPhase < phase) {
      this.bossPhase++;
      this.emit("phase", boss.body, {
        source: boss.id,
        amount: this.bossPhase,
      });
    }
  }

  private checkDefeat() {
    if (
      this.players.size &&
      ![...this.players.values()].some(
        (player) => player.life === "ALIVE" && !player.forfeited,
      )
    )
      this.finish("DEFEAT");
  }

  private finish(outcome: Outcome) {
    if (this.ended) return;
    this.result = {
      id: this.id,
      outcome,
      monsters: this.monstersDefeated,
      bossDefeated: outcome === "VICTORY",
      durationMs: Math.round(this.time),
      qualifies: outcome === "VICTORY" || this.hadCombat,
      participants: [...this.players.values()].map((p) => ({
        id: p.id,
        name: p.name,
        wizard: p.wizard,
        status: p.forfeited
          ? "Forfeited"
          : p.life === "ALIVE"
            ? "Survived"
            : "Dead",
        damage: p.damage,
        healing: p.healing,
        mitigation: p.mitigation,
        kills: p.kills,
        slot: p.slot,
        protectedAtEnd: p.protected,
      })),
    };
    this.shots.clear();
    this.areas.clear();
    for (const player of this.players.values()) player.body.moving = false;
    this.emit("outcome", { x: 0, y: 0 });
  }

  drainEvents() {
    return this.events.splice(0);
  }

  private progressEnemy(id: string) {
    const enemy = this.monsters.get(id);
    return enemy && !enemy.lifetime && enemy.kind !== "illusion"
      ? enemy
      : undefined;
  }

  private credit(player: CombatPlayer, metric: ProgressMetric, amount: number) {
    if (this.onProgress && eligible(player) && amount > 0)
      this.onProgress({
        playerId: player.id,
        wizard: player.wizard,
        metric,
        amount,
      });
  }

  private nextId(prefix: string) {
    return `${prefix}-${++this.entitySequence}`;
  }

  private emit(
    kind: CombatEvent["kind"],
    point: WorldPoint,
    fields: Partial<PendingEvent> = {},
  ) {
    if (this.events.length >= combatBalance.limit.events) this.events.shift();
    this.events.push({
      kind,
      x: point.x,
      y: point.y,
      id: ++this.eventSequence,
      ...fields,
    });
  }
}
