import { describe, expect, it } from "vitest";
import {
  dungeon,
  obstacleTiles,
  tileCenter,
  zone,
} from "../../../tests/fixtures/dungeon.js";
import {
  movePlayer,
  normalizeMovement,
  playerFacing,
  playerFootprint,
  playerSpeed,
  playerTerrain,
  resolvePlayerSpawn,
  type DungeonCell,
  type PlayerTransform,
} from "../src/index.js";

const floor: DungeonCell = {
  terrain: "floor",
  walkable: true,
  solid: false,
  hazardous: false,
  blocksSight: false,
};
const wall = dungeon.atTile(-1, -1);
const field = {
  tileWidth: 32,
  tileHeight: 32,
  atTile(x: number, y: number) {
    return x >= 0 && x < 20 && y >= 0 && y < 20 ? floor : wall;
  },
};
const idle = {
  x: 200,
  y: 200,
  facing: "down",
  moving: false,
} satisfies PlayerTransform;
const right = { x: 1, y: 0 };
const up = { x: 0, y: -1 };
const down = { x: 0, y: 1 };
const diagonal = { x: 1, y: 1 };
const still = { x: 0, y: 0 };
const footprintX = playerFootprint.width / 2;
const footprintY = playerFootprint.height / 2;

describe("portable wizard movement", () => {
  it("normalizes nonzero vectors and ignores non-finite input", () => {
    expect(normalizeMovement({ x: 3, y: 4 })).toEqual({ x: 0.6, y: 0.8 });
    expect(normalizeMovement({ x: Infinity, y: 0 })).toEqual(still);
  });

  it("moves at the configured cardinal speed", () => {
    expect(movePlayer(field, idle, right, 1000)).toEqual({
      ...idle,
      x: idle.x + playerSpeed,
      facing: "right",
      moving: true,
    });
  });

  it("keeps diagonal movement at the cardinal speed", () => {
    const next = movePlayer(field, idle, diagonal, 1000);
    expect(Math.hypot(next.x - idle.x, next.y - idle.y)).toBeCloseTo(
      playerSpeed,
    );
    expect(next.x - idle.x).toBeCloseTo(next.y - idle.y);
  });

  it("selects the dominant direction with vertical ties", () => {
    expect(playerFacing({ x: -1, y: -1 }, "down")).toBe("up");
    expect(playerFacing({ x: -2, y: 1 }, "down")).toBe("left");
    expect(playerFacing(diagonal, "left")).toBe("down");
    expect(playerFacing(right, "left")).toBe("right");
  });

  it("stops and preserves the last facing on zero input", () => {
    const next = movePlayer(
      field,
      { ...idle, facing: "left", moving: true },
      still,
      250,
    );
    expect(next).toEqual({ ...idle, facing: "left" });
  });

  it("moves the same total distance at different frame times", () => {
    const once = movePlayer(field, idle, diagonal, 500);
    let stepped: PlayerTransform = idle;
    for (let i = 0; i < 25; i++)
      stepped = movePlayer(field, stepped, diagonal, 20);
    expect(stepped.x).toBeCloseTo(once.x);
    expect(stepped.y).toBeCloseTo(once.y);
  });

  it("keeps the complete footprint within world bounds", () => {
    expect(movePlayer(field, idle, right, 20_000).x).toBe(
      20 * field.tileWidth - footprintX,
    );
    expect(movePlayer(field, idle, up, 20_000).y).toBe(footprintY);
    expect(movePlayer(field, idle, { x: -1, y: 0 }, 20_000).x).toBe(footprintX);
    expect(movePlayer(field, idle, down, 20_000).y).toBe(
      20 * field.tileHeight - footprintY,
    );
  });

  it("sweeps through every intervening column even at a large delta", () => {
    const divided = {
      ...field,
      atTile(x: number, y: number) {
        return x === 8 ? wall : field.atTile(x, y);
      },
    };
    const near = movePlayer(divided, idle, right, 20_000);
    expect(near.x).toBe(8 * field.tileWidth - footprintX);
    expect(playerTerrain(divided, near).solid).toBe(false);
    expect(movePlayer(divided, near, right, 16)).toEqual({
      ...near,
      moving: false,
    });
    expect(
      movePlayer(divided, { ...idle, x: 318 }, { x: -1, y: 0 }, 20_000).x,
    ).toBe(9 * field.tileWidth + footprintX);
  });

  it("slides on the open axis while pinned against an obstacle", () => {
    const divided = {
      ...field,
      atTile(x: number, y: number) {
        return x === 8 ? wall : field.atTile(x, y);
      },
    };
    const atEdge = { ...idle, x: 8 * field.tileWidth - footprintX };
    const next = movePlayer(divided, atEdge, diagonal, 120);
    expect(next.x).toBe(atEdge.x);
    expect(next.y).toBeGreaterThan(atEdge.y);
    expect(next.moving).toBe(true);
    expect(playerTerrain(divided, next).solid).toBe(false);
  });
});

describe("canonical dungeon movement", () => {
  it("spawns at the safe marker center with a down-facing idle", () => {
    const spawn = zone("player_spawn");
    const transform = resolvePlayerSpawn(dungeon);
    expect(transform).toEqual({
      x: spawn.x + spawn.width / 2,
      y: spawn.y + spawn.height / 2,
      facing: "down",
      moving: false,
    });
    expect(playerTerrain(dungeon, transform)).toEqual({
      solid: false,
      hazardous: false,
    });
  });

  it("chooses a safe in-marker fallback and rejects an entirely blocked spawn", () => {
    const start = resolvePlayerSpawn(dungeon);
    const initial = dungeon.worldToTile(start.x, start.y);
    const blocked = {
      ...dungeon,
      atTile(x: number, y: number) {
        return x === initial.x && y === initial.y ? wall : dungeon.atTile(x, y);
      },
    };
    const fallback = resolvePlayerSpawn(blocked);
    expect(fallback).not.toEqual(start);
    expect(
      dungeon
        .zonesAt(fallback.x, fallback.y)
        .some(({ id }) => id === "player_spawn"),
    ).toBe(true);
    expect(playerTerrain(blocked, fallback)).toEqual({
      solid: false,
      hazardous: false,
    });
    expect(() =>
      resolvePlayerSpawn({ ...dungeon, atTile: () => wall }),
    ).toThrow(/safe player spawn/);
  });

  it("sweeps to the entrance wall from the actual spawn", () => {
    const start = resolvePlayerSpawn(dungeon);
    const tile = dungeon.worldToTile(start.x, start.y);
    let wallY = tile.y;
    while (!dungeon.atTile(tile.x, wallY).solid) wallY--;
    const stopped = movePlayer(dungeon, start, up, 6000);
    expect(stopped.y).toBe((wallY + 1) * dungeon.tileHeight + footprintY);
    expect(playerTerrain(dungeon, stopped).solid).toBe(false);
  });

  it.each([
    [18, 17],
    [10, 11],
  ])("blocks the obstacle at tile %i,%i", (x, y) => {
    expect(obstacleTiles.some((tile) => tile.x === x && tile.y === y)).toBe(
      true,
    );
    const start = { ...idle, ...tileCenter(x, y - 1) };
    expect(playerTerrain(dungeon, start).solid).toBe(false);
    const next = movePlayer(dungeon, start, down, 1600);
    expect(next.y).toBe(y * dungeon.tileHeight - footprintY);
    expect(playerTerrain(dungeon, next).solid).toBe(false);
  });

  it("crosses the bridge on safe stone between its reachable banks", () => {
    const bridge = zone("bridge");
    const west = { ...idle, x: bridge.x - 16, y: bridge.y + bridge.height / 2 };
    const east = bridge.x + bridge.width + 16;
    let player: PlayerTransform = west;
    const ticks = 20;
    for (let i = 0; i < ticks; i++) {
      player = movePlayer(
        dungeon,
        player,
        right,
        ((east - west.x) / playerSpeed / ticks) * 1000,
      );
      expect(playerTerrain(dungeon, player)).toEqual({
        solid: false,
        hazardous: false,
      });
    }
    expect(player.x).toBeCloseTo(east);
  });

  it("detects lava on footprint contact and allows entry without solid collision", () => {
    const bridge = zone("bridge");
    const edge = {
      ...idle,
      x: bridge.x + bridge.width / 2,
      y: bridge.y + footprintY,
    };
    expect(playerTerrain(dungeon, edge).hazardous).toBe(false);
    const firstContact = movePlayer(dungeon, edge, up, 12);
    expect(dungeon.atWorld(firstContact.x, firstContact.y).walkable).toBe(true);
    expect(playerTerrain(dungeon, firstContact)).toEqual({
      solid: false,
      hazardous: true,
    });
    const inLava = movePlayer(dungeon, firstContact, up, 150);
    expect(dungeon.atWorld(inLava.x, inLava.y).hazardous).toBe(true);
  });
});
