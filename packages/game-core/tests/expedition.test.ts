import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import {
  readDungeonMap,
  CombatRun,
  bodyAt,
  center,
  safePoint,
  clearSight,
  distance,
  trapCycle,
  trapRules,
  playerTerrain,
  movePlayer,
  playerSpeed,
  type DungeonZone,
  type TiledDungeonMap,
  type CombatProgress,
} from "../src/index.js";
const load = (id: string) =>
  readDungeonMap(
    JSON.parse(
      readFileSync(
        new URL(
          "../../../apps/web/public/assets/dungeon/" + id + ".tmj",
          import.meta.url,
        ),
        "utf8",
      ),
    ) as TiledDungeonMap,
  );
const map = load("expedition");
const origin = map.zones.find((z) => z.kind === "player_spawn")!;
function setup(n = 1) {
  const events: CombatProgress[] = [];
  const run = new CombatRun("expedition-test", map, (e) => events.push(e));
  for (let s = 0; s < n; s++)
    run.addPlayer(
      "p" + s,
      "Wizard " + s,
      "lightning",
      s,
      bodyAt(center(origin)),
    );
  return { run, world: run.expedition!, events, hero: run.players.get("p0")! };
}
function flood(start: DungeonZone) {
  const tile = map.worldToTile(center(start).x, center(start).y);
  const open = [tile],
    seen = new Set([tile.y * map.width + tile.x]);
  for (let i = 0; i < open.length; i++) {
    const { x, y } = open[i]!;
    for (const [dx, dy] of [
      [0, 1],
      [1, 0],
      [-1, 0],
      [0, -1],
    ] as const) {
      const a = x + dx,
        b = y + dy,
        k = b * map.width + a;
      if (!seen.has(k) && map.atTile(a, b).walkable) {
        seen.add(k);
        open.push({ x: a, y: b });
      }
    }
  }
  return (z: DungeonZone) => {
    const { x, y } = map.worldToTile(center(z).x, center(z).y);
    return seen.has(y * map.width + x);
  };
}
describe("Canonical expedition", () => {
  const { world } = setup();
  it("has eighteen primary rooms, two concealed wings and five independent sections", () => {
    expect(world.sections).toHaveLength(5);
    const rooms = map.zones.filter((z) => z.kind === "room");
    expect(rooms.filter((r) => !r.properties.secret)).toHaveLength(18);
    expect(rooms.filter((r) => r.properties.secret)).toHaveLength(2);
    expect(new Set(map.zones.map((z) => z.id)).size).toBe(map.zones.length);
  });
  for (const section of world.sections)
    it(
      section.id +
        " has canonical tile parity and safe routes to its required content",
      () => {
        const local = load(section.id);
        for (let y = 0; y < local.height; y++)
          for (let x = 0; x < local.width; x++)
            if (
              local.atTile(x, y).terrain !==
              map.atTile(section.x / 32 + x, section.y / 32 + y).terrain
            )
              throw Error("Tile mismatch " + x + "," + y);
        const markers = map.zones.filter(
          (z) => z.properties.zone === section.id,
        );
        if (Number(section.properties.index) > 0) {
          const entries = markers.filter((m) => m.kind === "zone_entry");
          const enemies = markers.filter((m) => m.kind === "combat_spawn");
          expect(
            entries.every((e) =>
              enemies.every((m) => distance(center(e), center(m)) > 240),
            ),
          ).toBe(true);
        }
        const connected = flood(markers.find((z) => z.kind === "zone_entry")!);
        const secret = markers.find(
          (z) => z.kind === "room" && z.properties.secret,
        )?.id;
        for (const z of markers.filter((z) =>
          [
            "zone_entry",
            "zone_gate",
            "boss_gate",
            "mechanism",
            "combat_spawn",
            "mana_restoration_zone",
            "bridge",
            "secret_door",
            "room",
          ].includes(z.kind),
        )) {
          const gated =
            z.id === secret ||
            (z.properties.room === secret && secret !== undefined) ||
            z.id === "shadow-throne" ||
            z.properties.room === "shadow-throne";
          expect(connected(z), z.id).toBe(!gated);
        }
        for (const z of markers.filter((z) =>
          [
            "combat_spawn",
            "zone_entry",
            "arena_entry",
            "boss_anchor",
            "boss_spawn",
            "mechanism",
            "zone_gate",
          ].includes(z.kind),
        ))
          expect(safePoint(map, center(z)), z.id).toBe(true);
      },
    );
  it.each(["flame_vent", "arcane_trap"] as const)(
    "warns before %s, hits a footprint once, protects outside/dead/disconnected seats",
    (kind) => {
      const { world, run, hero } = setup(4);
      world.index = kind === "flame_vent" ? 1 : 3;
      const z = world.objects.find((z) => z.kind === kind)!;
      for (const p of run.players.values())
        Object.assign(p.body, bodyAt({ x: z.x - 5, y: center(z).y }));
      const outside = run.players.get("p1")!,
        dead = run.players.get("p2")!,
        protectedSeat = run.players.get("p3")!;
      outside.body.x = z.x - 8;
      dead.life = "DEAD";
      run.setProtected("p3", true);
      const spec = trapRules[kind];
      const sample = (t: number) => {
        run.time = t - Number(z.properties.offset);
        world.step();
        return world.traps[z.id];
      };
      expect(sample(0)).toBe("idle");
      expect(sample(spec.idle)).toBe("warning");
      expect(hero.hp).toBe(hero.maxHp);
      expect(sample(spec.idle + spec.warning)).toBe("active");
      world.step();
      expect(hero.hp).toBe(hero.maxHp - spec.damage);
      expect(outside.hp).toBe(outside.maxHp);
      expect(dead.hp).toBe(dead.maxHp);
      expect(protectedSeat.hp).toBe(protectedSeat.maxHp);
      expect(sample(spec.idle + spec.warning + spec.active)).toBe("recovery");
      expect(
        trapCycle(
          kind,
          spec.idle + spec.warning + spec.active + spec.recovery,
          0,
        ).cycle,
      ).toBe(1);
    },
  );
  it("rejects locked, remote, stale, protected, dead and cross-party interactions", () => {
    const { world, run, hero } = setup(3),
      other = setup();
    const gate = world.objects.find((z) => z.kind === "zone_gate")!;
    Object.assign(hero.body, bodyAt(center(gate)));
    expect(run.interact(hero.id, world.revision)).toBe(false);
    for (const r of run.encounters.regions) r.state = "clear";
    const seal = world.mechanisms[0]!;
    expect(run.interact(hero.id, world.revision)).toBe(false);
    Object.assign(hero.body, bodyAt(center(seal)));
    run.setProtected(hero.id, true);
    expect(run.interact(hero.id, world.revision)).toBe(false);
    run.setProtected(hero.id, false);
    expect(run.interact(hero.id, world.revision)).toBe(true);
    Object.assign(hero.body, bodyAt(center(gate)));
    const reserve = run.players.get("p1")!,
      dead = run.players.get("p2")!;
    run.setProtected(reserve.id, true);
    dead.life = "DEAD";
    Object.assign(dead.body, bodyAt(center(gate)));
    expect(run.interact(dead.id, world.revision)).toBe(false);
    hero.hp -= 9;
    hero.mp -= 7;
    hero.cooldowns.BASIC = 83;
    expect(run.interact(hero.id, 1)).toBe(false);
    expect(run.interact(hero.id, world.revision)).toBe(true);
    expect([hero.hp, hero.mp, hero.cooldowns.BASIC]).toEqual([
      hero.maxHp - 9,
      hero.maxMp - 7,
      83,
    ]);
    expect(other.world.index).toBe(0);
    expect(world.pending.has(reserve.id)).toBe(true);
    run.setProtected(reserve.id, false);
    expect(safePoint(map, reserve.body)).toBe(true);
    expect(distance(hero.body, reserve.body)).toBe(32);
    expect(dead.life).toBe("DEAD");
  });
  it("walks all primary approaches and gate controls through the normal movement sweep", () => {
    let tiles = 0;
    for (const section of world.sections) {
      const objects = map.zones.filter((z) => z.properties.zone === section.id);
      let actor = bodyAt(center(objects.find((z) => z.kind === "zone_entry")!));
      const stops = objects
        .filter(
          (z) =>
            z.kind === "room" &&
            !z.properties.secret &&
            z.id !== "shadow-throne",
        )
        .flatMap((z) => [
          z,
          ...objects.filter(
            (o) => o.properties.room === z.id && o.kind === "mechanism",
          ),
        ]);
      stops.push(
        objects.find((z) => z.kind === "zone_gate" || z.kind === "boss_gate")!,
      );
      for (const stop of stops) {
        const key = (x: number, y: number) => y * map.width + x;
        const start = map.worldToTile(actor.x, actor.y),
          target = map.worldToTile(center(stop).x, center(stop).y),
          end = key(target.x, target.y);
        const queue = [key(start.x, start.y)],
          parents = new Map([[queue[0]!, -1]]);
        for (let n = 0; n < queue.length && !parents.has(end); n++) {
          const k = queue[n]!,
            x = k % map.width,
            y = Math.floor(k / map.width);
          for (const [dx, dy] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ] as const) {
            const next = key(x + dx, y + dy);
            if (!parents.has(next) && map.atTile(x + dx, y + dy).walkable) {
              parents.set(next, k);
              queue.push(next);
            }
          }
        }
        expect(parents.has(end), stop.id).toBe(true);
        const route = [];
        for (let k = end; k !== queue[0]; k = parents.get(k)!) route.push(k);
        for (const k of route.reverse()) {
          const goal = {
            x: ((k % map.width) + 0.5) * 32,
            y: (Math.floor(k / map.width) + 0.5) * 32,
          };
          const dir = { x: goal.x - actor.x, y: goal.y - actor.y };
          for (let step = 0; step < 8; step++)
            actor = movePlayer(map, actor, dir, 4000 / playerSpeed);
          expect(distance(actor, goal), stop.id).toBeLessThan(0.01);
          expect(playerTerrain(map, actor)).toEqual({
            solid: false,
            hazardous: false,
          });
          tiles++;
        }
      }
    }
    console.info(
      "Safe primary route:",
      tiles,
      "tile steps;",
      ((tiles * 32) / playerSpeed).toFixed(1),
      "movement-only seconds.",
    );
  });
  it("retries occupied encounter capacity without prematurely clearing the room", () => {
    const { run, hero } = setup();
    const r = run.encounters.regions[0]!;
    Object.assign(hero.body, bodyAt(center(r.actors[0]!)));
    for (let n = 0; n < 28; n++) run.summon("servant", center(origin), "other");
    run.step(34);
    expect(r.state).toBe("fighting");
    expect(r.spawned).toBe(0);
    run.monsters.clear();
    run.step(34);
    const foe = [...run.monsters.values()].find(
      (m) => m.encounter === r.zone.id,
    )!;
    expect(r.spawned).toBe(1);
    expect(distance(foe.body, hero.body)).toBeGreaterThan(25);
    expect(
      map
        .zonesAt(foe.body.x, foe.body.y)
        .some((z) => z.kind === "mana_restoration_zone"),
    ).toBe(false);
  });
  it("keeps the throne gate retryable when the monster budget is full", () => {
    const { run, world, hero } = setup();
    world.index = 4;
    for (const r of run.encounters.regions) r.state = "clear";
    Object.assign(hero.body, bodyAt(center(run.encounters.gate)));
    for (let n = 0; n < 28; n++)
      run.summon("illusion", center(origin), "other");
    expect(run.interact(hero.id, world.revision)).toBe(false);
    expect(run.encounters.bossStarted).toBe(false);
    run.monsters.clear();
    expect(run.interact(hero.id, world.revision)).toBe(true);
  });
  it.each([1, 2, 4])(
    "completes all five zones and three real boss phases with %i seats",
    (size) => {
      const { run, world, hero, events } = setup(size),
        phases = new Set<number>();
      const act = (z: DungeonZone) => {
        Object.assign(hero.body, bodyAt(center(z)));
        return run.interact(hero.id, world.revision);
      };
      const fight = (encounter: string) => {
        for (let frame = 0; frame < 4200; frame++) {
          const mob = [...run.monsters.values()].find(
            (m) => m.encounter === encounter && !m.lifetime,
          );
          if (!mob) break;
          for (const p of run.players.values()) {
            if (p.life !== "ALIVE") continue;
            const range = 190;
            const point = Array.from({ length: 16 }, (_, i) => {
              const a = ((i + p.slot + Math.floor(frame / 10)) * Math.PI) / 8;
              return {
                x: mob.body.x + Math.cos(a) * range,
                y: mob.body.y + Math.sin(a) * range,
              };
            }).find(
              (q) =>
                safePoint(map, q) &&
                clearSight(map, q, mob.body) &&
                [...run.areas.values()].every(
                  (a) => !a.hostile || distance(q, a.point) > a.radius + 9,
                ),
            );
            if (point) Object.assign(p.body, bodyAt(point));
            if (!p.cooldowns.BASIC)
              run.cast(p.id, {
                slot: "BASIC",
                sequence: p.sequence + 1,
                ...mob.body,
              });
            if (!p.cooldowns.SKILL_1 && p.mp >= 18)
              run.cast(p.id, {
                slot: "SKILL_1",
                sequence: p.sequence + 1,
                ...mob.body,
              });
          }
          run.step(1000 / 30);
          if (run.bossPhase) phases.add(run.bossPhase);
          if (run.ended) break;
        }
        expect(
          [...run.monsters.values()].filter(
            (m) =>
              m.encounter === encounter && !m.lifetime && m.life === "ALIVE",
          ),
          encounter,
        ).toHaveLength(0);
      };
      for (let i = 0; i < 5; i++) {
        expect(world.index).toBe(i);
        for (const r of run.encounters.regions.filter(
          (r) =>
            r.zone.properties.zone === world.zone.id &&
            !r.zone.properties.optional,
        )) {
          Object.assign(hero.body, bodyAt(center(r.zone)));
          run.step(34);
          fight(r.zone.id);
          run.step(34);
          expect(r.state).toBe("clear");
        }
        for (const z of world.mechanisms) expect(act(z), z.id).toBe(true);
        if (i === 2 || i === 3) {
          const door = world.objects.find((z) => z.kind === "secret_door")!;
          expect(act(door)).toBe(true);
          world.step();
          expect(
            world.discovered.has(String(door.properties.destination)),
          ).toBe(true);
          expect(
            act(world.objects.find((z) => z.kind === "secret_return")!),
          ).toBe(true);
          expect(act(door)).toBe(true);
        }
        expect(
          act(
            world.objects.find(
              (z) => z.kind === (i === 4 ? "boss_gate" : "zone_gate"),
            )!,
          ),
          world.zone.id,
        ).toBe(true);
        expect(playerTerrain(map, hero.body)).toEqual({
          solid: false,
          hazardous: false,
        });
      }
      phases.add(run.bossPhase);
      const bossAt = run.time;
      fight("boss");
      console.info(
        "Staged walkthrough",
        size,
        "seats;",
        (run.time / 1000).toFixed(1),
        "seconds including",
        ((run.time - bossAt) / 1000).toFixed(1),
        "boss seconds.",
      );
      expect([...phases]).toEqual([1, 2, 3]);
      expect(run.result?.outcome).toBe("VICTORY");
      const discoveries = events.filter((e) => e.metric === "discovery");
      expect(discoveries).toHaveLength(6 * size);
      expect(new Set(discoveries.map((e) => e.playerId + e.source)).size).toBe(
        discoveries.length,
      );
    },
  );
});
