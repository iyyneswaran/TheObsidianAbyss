import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  dungeonLayerDepths,
  readDungeonMap,
  type DungeonZone,
  type TiledDungeonMap,
} from "../src/index.js";

const assetDir = new URL(
  "../../../apps/web/public/assets/dungeon/",
  import.meta.url,
);
const tiled = JSON.parse(
  readFileSync(new URL("obsidian-dungeon.tmj", assetDir), "utf8"),
) as TiledDungeonMap;
const map = readDungeonMap(tiled);
const neighbors = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
] as const;
const key = (x: number, y: number) => y * map.width + x;

function zone(id: string) {
  const result = map.zones.find((entry) => entry.id === id);
  if (!result) throw new Error(`Missing dungeon zone ${id}.`);
  return result;
}

function* zoneTiles({ x, y, width, height }: DungeonZone) {
  for (let row = y; row < y + height; row += map.tileHeight) {
    for (let col = x; col < x + width; col += map.tileWidth)
      yield map.worldToTile(col, row);
  }
}

function reachable(
  start: { x: number; y: number },
  excluded = new Set<number>(),
) {
  const seen = new Set([key(start.x, start.y)]);
  const queue = [start];
  for (const { x, y } of queue) {
    for (const [dx, dy] of neighbors) {
      const col = x + dx;
      const row = y + dy;
      const id = key(col, row);
      if (map.atTile(col, row).walkable && !seen.has(id) && !excluded.has(id)) {
        seen.add(id);
        queue.push({ x: col, y: row });
      }
    }
  }
  return seen;
}

describe("canonical dungeon map", () => {
  it("loads the finite Tiled map, required layers, embedded atlas, and tile frames", () => {
    expect([map.width, map.height, map.tileWidth, map.tileHeight]).toEqual([
      80, 64, 32, 32,
    ]);
    expect(tiled.layers.map(({ name }) => name)).toEqual([
      ...Object.keys(dungeonLayerDepths),
      "ObjectZones",
    ]);
    expect(tiled.tilesets.length).toBeGreaterThan(0);

    for (const tileset of tiled.tilesets) {
      const atlas = readFileSync(new URL(tileset.image, assetDir));
      expect(atlas.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
      expect(
        (atlas.readUInt32BE(16) / map.tileWidth) *
          (atlas.readUInt32BE(20) / map.tileHeight),
      ).toBe(tileset.tilecount);
      for (const tile of tileset.tiles ?? []) {
        for (const frame of tile.animation ?? []) {
          expect(frame.duration).toBeGreaterThan(0);
          expect(frame.tileid).toBeGreaterThanOrEqual(0);
          expect(frame.tileid).toBeLessThan(tileset.tilecount);
        }
      }
    }
  });

  it("uses unique stable IDs and defines all required regions", () => {
    expect(new Set(map.zones.map(({ id }) => id)).size).toBe(map.zones.length);
    expect(new Set(map.zones.map(({ objectId }) => objectId)).size).toBe(
      map.zones.length,
    );
    expect(
      map.zones.filter(({ kind }) => kind === "room").map(({ id }) => id),
    ).toEqual(["room_a", "room_b", "room_c"]);
    expect(map.zones.map(({ kind }) => kind)).toEqual(
      expect.arrayContaining([
        "player_spawn",
        "lava_hazard",
        "mana_shrine",
        "mana_restoration_zone",
        "monster_patrol_zone",
        "hiding_area",
        "bridge",
        "room_connection",
        "safe_area",
      ]),
    );
    expect(
      map.zonesAt(zone("bridge").x, zone("bridge").y).map(({ id }) => id),
    ).toContain("bridge");
  });

  it("connects all walkable terrain to spawn and keeps restoration, patrol, and hiding zones reachable", () => {
    const start = zoneTiles(zone("player_spawn")).next().value!;
    const seen = reachable(start);
    for (const id of ["room_a", "room_b", "room_c"]) {
      const roomCells = [...zoneTiles(zone(id))];
      expect(
        roomCells.filter(({ x, y }) => seen.has(key(x, y))).length,
      ).toBeGreaterThan(100);
    }

    const safeZones = map.zones.filter(({ kind }) =>
      [
        "player_spawn",
        "mana_restoration_zone",
        "safe_area",
        "hiding_area",
        "monster_patrol_zone",
      ].includes(kind),
    );
    for (const safe of safeZones) {
      for (const { x, y } of zoneTiles(safe)) {
        expect(map.atTile(x, y).walkable, safe.id).toBe(true);
        expect(seen.has(key(x, y)), safe.id).toBe(true);
      }
    }

    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        if (map.atTile(x, y).walkable)
          expect(seen.has(key(x, y)), `isolated floor at ${x},${y}`).toBe(true);
      }
    }
  });

  it("connects both banks across the bridge with lava directly north and south", () => {
    const bridge = zone("bridge");
    const start = map.worldToTile(bridge.x, bridge.y);
    const last = map.worldToTile(
      bridge.x + bridge.width - 1,
      bridge.y + bridge.height - 1,
    );
    const west = { x: start.x - 1, y: start.y };
    const east = key(last.x + 1, start.y);
    expect(map.atTile(last.x + 1, start.y).walkable).toBe(true);
    expect(reachable(west).has(east)).toBe(true);
    const excluded = new Set<number>();
    for (const { x, y } of zoneTiles(bridge)) {
      expect(map.atTile(x, y).walkable).toBe(true);
      excluded.add(key(x, y));
    }
    expect(reachable(west, excluded).has(east)).toBe(false);
    for (let x = start.x; x <= last.x; x++) {
      expect(map.atTile(x, start.y - 1).hazardous).toBe(true);
      expect(map.atTile(x, last.y + 1).hazardous).toBe(true);
    }
  });

  it("keeps walls and substantial obstacles solid and sight-blocking while lava remains a separate hazard", () => {
    for (const layer of tiled.layers) {
      if (
        layer.type !== "tilelayer" ||
        !["Walls", "Obstacles", "Lava"].includes(layer.name)
      )
        continue;
      expect(layer.data.some(Boolean)).toBe(true);
      layer.data.forEach((gid, index) => {
        if (!gid) return;
        const cell = map.atTile(
          index % map.width,
          Math.floor(index / map.width),
        );
        expect(cell).toMatchObject(
          layer.name === "Lava"
            ? {
                terrain: "lava",
                solid: false,
                hazardous: true,
                blocksSight: false,
              }
            : {
                terrain: "solid",
                solid: true,
                hazardous: false,
                blocksSight: true,
              },
        );
      });
    }
    expect(map.atWorld(-1, 16)).toMatchObject({
      terrain: "void",
      solid: true,
      walkable: false,
    });
    expect(map.atWorld(map.worldWidth, 16).terrain).toBe("void");
  });

  it("rejects a misaligned layer and duplicate object IDs", () => {
    const misaligned = structuredClone(tiled);
    const ground = misaligned.layers.find(
      (layer) => layer.type === "tilelayer" && layer.name === "Ground",
    );
    if (ground?.type !== "tilelayer") throw new Error("Ground layer missing.");
    ground.x = 1;
    expect(() => readDungeonMap(misaligned)).toThrow(/Ground/);

    const duplicates = structuredClone(tiled);
    const objectLayer = duplicates.layers.find(
      (layer) => layer.type === "objectgroup",
    );
    if (objectLayer?.type !== "objectgroup")
      throw new Error("ObjectZones layer missing.");
    objectLayer.objects.push(objectLayer.objects[0]!);
    expect(() => readDungeonMap(duplicates)).toThrow(/unique/);
  });
});
