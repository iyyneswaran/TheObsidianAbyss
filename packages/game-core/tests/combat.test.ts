import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  abilitySlots,
  bodyAt,
  clearSight,
  combatBalance,
  CombatRun,
  distance,
  eligible,
  loadouts,
  playerTerrain,
  readDungeonMap,
  safePoint,
  speedFactor,
  type AbilitySlot,
  type CombatClass,
  type TiledDungeonMap,
  type WorldPoint,
} from "../src/index.js";

const map = readDungeonMap(
  JSON.parse(
    readFileSync(
      new URL(
        "../../../apps/web/public/assets/dungeon/obsidian-combat.tmj",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as TiledDungeonMap,
);
const floor = { x: 2128, y: 1456 };
const point = { x: 2180, y: 1456 };
const tick = 1000 / 30;

function advance(run: CombatRun, ms: number) {
  for (let left = ms; left > 0; left -= tick) run.step(tick);
}
function runFor(wizard: CombatClass = "fire", position: WorldPoint = floor) {
  const run = new CombatRun("test", map);
  run.addPlayer("hero", "Hero", wizard, 0, bodyAt(position));
  return { run, player: run.players.get("hero")! };
}
function cast(
  run: CombatRun,
  slot: AbilitySlot,
  aim = point,
  sequence = run.players.get("hero")!.sequence + 1,
) {
  return run.cast("hero", { slot, sequence, ...aim });
}

describe("authoritative wizard loadouts", () => {
  for (const wizard of Object.keys(loadouts) as CombatClass[]) {
    for (const slot of abilitySlots) {
      it(`${wizard} ${slot} resolves with its configured cost, interval and gameplay effect`, () => {
        const { run, player } = runFor(wizard);
        const target = run.summon("overlord", point, "boss")!;
        target.attackIn = 10000;
        const ability = loadouts[wizard].abilities[slot];
        if (ability.heal && !ability.damage) player.hp -= 80;
        const before = player.hp;
        const aim =
          ability.shape === "dash" ? { x: floor.x + 150, y: floor.y } : point;
        expect(cast(run, slot, aim)).toBeUndefined();
        expect(player.mp).toBe(player.maxMp - ability.mana);
        expect(player.cooldowns[slot]).toBe(ability.cooldownMs);
        expect(slot === "BASIC" ? ability.mana === 0 : ability.mana > 0).toBe(
          true,
        );
        if (ability.shield)
          expect(player.statuses.get("Shielded")?.power).toBe(ability.shield);
        if (ability.block)
          expect(player.statuses.get("Blocking")?.power).toBe(ability.block);
        if (ability.charge)
          expect(player.statuses.get("Charged")?.power).toBe(ability.charge);
        if (ability.taunt) expect(player.statuses.has("Taunting")).toBe(true);
        advance(
          run,
          (ability.pulses ?? 1) * (ability.pulseMs ?? 0) +
            (ability.delayMs ?? 0) +
            220,
        );
        if (ability.damage) expect(target.hp).toBeLessThan(target.maxHp);
        if (ability.heal && !ability.damage)
          expect(player.hp).toBeGreaterThan(before);
        if (ability.shape === "dash")
          expect(player.body.x).toBeGreaterThan(floor.x);
      });
    }
  }
  it("rejects malformed, duplicate, out-of-order, invalid aim, depleted, and too-fast casts", () => {
    const { run, player } = runFor("earth");
    expect(cast(run, "SKILL_2", { x: Infinity, y: 0 }, 7)).toMatch(/aim/);
    expect(cast(run, "SKILL_2", point, 7)).toMatch(/expired/);
    expect(cast(run, "SKILL_2", point, 6)).toMatch(/expired/);
    expect(cast(run, "SKILL_2", { x: 520, y: 600 })).toMatch(/target/);
    expect(player.mp).toBe(player.maxMp);
    player.mp = 0;
    expect(cast(run, "SKILL_2")).toMatch(/mana/);
    for (let i = 0; i < 10; i++) cast(run, "SKILL_2");
    expect(cast(run, "SKILL_2")).toMatch(/quickly/);
  });
  it("stops accepted cooldown replays and hits each Chain Lightning target once", () => {
    const { run, player } = runFor("lightning");
    const mobs = [
      point,
      { x: 2194, y: 1436 },
      { x: 2200, y: 1456 },
      { x: 2200, y: 1426 },
    ].map((p) => run.summon("shadow", p, "test")!);
    expect(cast(run, "SKILL_1")).toBeUndefined();
    const balance = player.mp;
    expect(cast(run, "SKILL_1")).toContain("cooling down");
    expect(player.mp).toBe(balance);
    expect(mobs.filter((mob) => mob.hp < mob.maxHp)).toHaveLength(3);
    expect(mobs.every((mob) => mob.maxHp - mob.hp <= 37)).toBe(true);
  });
  it("stops projectiles at cover and protects allies from friendly area damage", () => {
    const { run, player } = runFor();
    run.addPlayer("ally", "Ally", "ice", 1, bodyAt(point));
    const ally = run.players.get("ally")!;
    const enemy = run.summon("shadow", point, "test")!;
    expect(cast(run, "BASIC")).toBeUndefined();
    enemy.body.x += 120;
    enemy.body.y += 40;
    enemy.attackIn = 10000;
    advance(run, 850);
    expect(run.shots.size).toBe(0);
    expect(enemy.hp).toBe(enemy.maxHp);
    expect(cast(run, "ULTIMATE")).toBeUndefined();
    advance(run, 400);
    expect(ally.hp).toBe(ally.maxHp);
    expect(run.damage(ally, 99, player.id)).toBe(0);
  });
  it("rejects auto-target behind cover and only heals existing missing HP", () => {
    const { run, player } = runFor("healer", { x: 592, y: 512 });
    const enemy = run.summon("shadow", { x: 592, y: 590 }, "test")!;
    expect(clearSight(map, player.body, enemy.body)).toBe(false);
    expect(cast(run, "BASIC", enemy.body)).toMatch(/target/);
    player.hp -= 3;
    expect(cast(run, "BASIC", player.body)).toBeUndefined();
    expect(player.hp).toBe(player.maxHp);
    expect(player.healing).toBe(3);
    run.damage(player, 999, "enemy");
    expect(run.heal(player, 99, player)).toBe(0);
    expect(player.hp).toBe(0);
    expect(player.life).toBe("DEAD");
  });
  it("freezes and slows movement, refreshes a single burn, then expires statuses", () => {
    const { run } = runFor("ice");
    const enemy = run.summon("shadow", point, "test")!;
    const initial = { ...enemy.body };
    expect(cast(run, "SKILL_1")).toBeUndefined();
    expect(speedFactor(enemy)).toBe(0);
    advance(run, 800);
    expect(enemy.body).toEqual(initial);
    advance(run, 850);
    expect(enemy.statuses.has("Frozen")).toBe(false);
    const { run: fire } = runFor();
    const victim = fire.summon("shadow", point, "test")!;
    cast(fire, "SKILL_1");
    expect(victim.statuses.size).toBe(1);
    const hp = victim.hp;
    advance(fire, 1000);
    expect(victim.hp).toBeLessThan(hp);
    advance(fire, 1800);
    expect(victim.statuses.has("Burning")).toBe(false);
  });
});

describe("hazards, AI and run lifecycle", () => {
  it("telegraphs and validates an Arcane Beam before applying damage", () => {
    const { run, player } = runFor("fire", point);
    run.addPlayer(
      "outside",
      "Outside",
      "wind",
      1,
      bodyAt({ x: point.x, y: point.y - 24 }),
    );
    const outside = run.players.get("outside")!;
    const boss = run.summon("overlord", floor, "boss")!;
    boss.attackIn = 12000;
    run.warn({
      source: boss.id,
      from: floor,
      at: point,
      range: 220,
      width: 30,
      delay: 900,
      damage: 25,
      fx: "arcane/arcane-beam",
    });
    expect(run.areas.size).toBe(1);
    advance(run, 830);
    expect(player.hp).toBe(player.maxHp);
    advance(run, 120);
    expect(player.hp).toBe(player.maxHp - 25);
    expect(outside.hp).toBe(outside.maxHp);
    expect(run.areas.size).toBe(0);
  });

  it("bounds Phase 2 reinforcements and removes expired illusions", () => {
    const { run, player } = runFor("defense");
    const boss = run.summon("overlord", point, "boss")!;
    const prior = { ...boss.body };
    advance(run, 2300);
    expect(distance(prior, boss.body)).toBeGreaterThan(40);
    expect(safePoint(map, boss.body)).toBe(true);
    expect(
      [...run.monsters.values()].filter(({ kind }) => kind === "illusion"),
    ).toHaveLength(2);
    run.damage(boss, 216, player.id);
    expect(run.bossPhase).toBe(2);
    const living = (kind: string) =>
      [...run.monsters.values()].filter((actor) => actor.kind === kind).length;
    for (let time = 0; time < 10500; time += 100) {
      advance(run, 100);
      expect(living("servant")).toBeLessThanOrEqual(combatBalance.boss.summons);
      if (player.hp < 100) run.heal(player, 70, player);
    }
    expect(living("illusion")).toBe(0);
    expect(living("servant")).toBeGreaterThan(0);
    expect(
      run.events.some(
        ({ kind, duration }) => kind === "warning" && (duration ?? 0) >= 850,
      ),
    ).toBe(true);
  });

  it("routes a pursuing enemy around a pillar without ever entering its footprint", () => {
    const { run, player } = runFor("defense", { x: 2192, y: 1488 });
    const hunter = run.summon("shadow", { x: 2160, y: 1488 }, "test")!;
    advance(run, 33);
    expect(hunter.target).toBe("hero");
    const destination = { x: 2256, y: 1488 };
    Object.assign(player.body, destination);
    expect(clearSight(map, hunter.body, destination)).toBe(false);
    for (let time = 0; time < 2400; time += 50) {
      advance(run, 50);
      expect(safePoint(map, hunter.body)).toBe(true);
    }
    expect(clearSight(map, hunter.body, destination)).toBe(true);
    expect(distance(hunter.body, destination)).toBeLessThan(60);
  });

  it("damages only actual lava, caps shrine mana without passive regeneration, and freezes protected state", () => {
    const { run, player } = runFor("defense", { x: 2048, y: 576 });
    const shield = cast(run, "SKILL_1", player.body);
    expect(shield).toBeUndefined();
    advance(run, 4000);
    expect(player.hp).toBe(player.maxHp);
    const mp = player.mp;
    advance(run, 500);
    expect(player.mp).toBe(mp);
    Object.assign(player.body, { x: 2048, y: 535 });
    expect(playerTerrain(map, player.body).hazardous).toBe(true);
    advance(run, 1000);
    expect(player.hp).toBe(player.maxHp - combatBalance.lava.damage);
    const cooldown = player.cooldowns.SKILL_1;
    run.setProtected(player.id, true);
    expect(eligible(player)).toBe(false);
    expect(cast(run, "SKILL_3")).toContain("cannot cast");
    advance(run, 3000);
    expect(player.cooldowns.SKILL_1).toBe(cooldown);
    expect(player.hp).toBe(player.maxHp - combatBalance.lava.damage);
    Object.assign(player.body, { x: 1312, y: 1504 });
    advance(run, 2000);
    expect(player.mp).toBe(mp);
    run.setProtected(player.id, false);
    advance(run, 2000);
    expect(player.mp).toBe(player.maxMp);
  });
  it("patrols, acquires a target, telegraphs, deals damage, and drops protected targets", () => {
    const { run, player } = runFor("ice", { x: 496, y: 336 });
    advance(run, 130);
    const mob = [...run.monsters.values()][0]!;
    expect(mob.kind).toBe("shadow");
    expect(mob.target).toBe("hero");
    const start = { ...mob.body };
    advance(run, 600);
    expect(distance(mob.body, player.body)).toBeLessThan(
      distance(start, player.body),
    );
    advance(run, 1100);
    expect(player.hp).toBeLessThan(player.maxHp);
    expect(run.events.some(({ kind }) => kind === "warning")).toBe(true);
    run.setProtected(player.id, true);
    const hp = player.hp;
    advance(run, 4800);
    expect(mob.target).toBe("");
    expect(mob.ai).toBe("PATROL");
    expect(player.hp).toBe(hp);
    expect(safePoint(map, mob.body)).toBe(true);
  });
  it("requires all encounters and proximity for portal, then resolves one win after all thresholds", () => {
    const { run, player } = runFor();
    expect(run.interact("hero")).toBe(false);
    for (const region of run.encounters.regions) {
      Object.assign(
        player.body,
        region.actors[0]
          ? { x: region.actors[0].x + 16, y: region.actors[0].y + 16 }
          : floor,
      );
      advance(run, tick);
      for (const mob of run.monsters.values())
        if (mob.encounter === region.zone.id) run.damage(mob, mob.hp, "hero");
      advance(run, tick);
    }
    expect(run.encounters.gateOpen).toBe(true);
    expect(run.interact("hero")).toBe(false);
    Object.assign(player.body, { x: 1520, y: 1488 });
    expect(run.interact("hero")).toBe(true);
    expect(run.interact("hero")).toBe(false);
    const boss = [...run.monsters.values()].find(
      (mob) => mob.kind === "overlord",
    )!;
    expect(boss.hp).toBe(720);
    expect(run.bossPhase).toBe(1);
    run.damage(boss, 468, "hero");
    expect(run.bossPhase).toBe(3);
    expect(
      run.events
        .filter(({ kind }) => kind === "phase")
        .map(({ amount }) => amount),
    ).toEqual([1, 2, 3]);
    advance(run, 4600);
    expect(safePoint(map, boss.body)).toBe(true);
    expect(run.events.some(({ kind }) => kind === "warning")).toBe(true);
    const hp = player.hp;
    run.damage(boss, 999, "hero");
    run.damage(boss, 999, "hero");
    advance(run, 4000);
    expect(player.hp).toBe(hp);
    expect(run.result?.outcome).toBe("VICTORY");
    expect(run.events.filter(({ kind }) => kind === "outcome")).toHaveLength(1);
    expect(run.areas.size + run.shots.size).toBe(0);
  });
  it("locks death permanently and waits for a protected seat until it forfeits", () => {
    const { run, player } = runFor();
    run.addPlayer("peer", "Peer", "healer", 1, bodyAt(floor));
    run.setProtected("peer", true);
    run.damage(player, 500, "lava");
    advance(run, 30);
    expect(run.result).toBeUndefined();
    expect(cast(run, "BASIC")).toContain("cannot cast");
    run.setProtected("hero", true);
    run.setProtected("hero", false);
    expect(player.life).toBe("DEAD");
    run.forfeit("peer");
    expect(run.result?.outcome).toBe("DEFEAT");
    expect(run.result?.participants.map(({ status }) => status)).toEqual([
      "Dead",
      "Forfeited",
    ]);
  });
});
