import { readFileSync } from "node:fs";
import {
  readDungeonMap,
  type TiledDungeonMap,
} from "../../packages/game-core/src/dungeon.js";

export const tiledDungeon = JSON.parse(
  readFileSync(
    new URL(
      "../../apps/web/public/assets/dungeon/obsidian-dungeon.tmj",
      import.meta.url,
    ),
    "utf8",
  ),
) as TiledDungeonMap;
export const dungeon = readDungeonMap(tiledDungeon);

export function zone(id: string) {
  const result = dungeon.zones.find((entry) => entry.id === id);
  if (!result) throw new Error(`Missing dungeon zone ${id}.`);
  return result;
}

export function tileCenter(x: number, y: number) {
  return {
    x: (x + 0.5) * dungeon.tileWidth,
    y: (y + 0.5) * dungeon.tileHeight,
  };
}

export const obstacleTiles = tiledDungeon.layers.flatMap((layer) =>
  layer.type === "tilelayer" && layer.name === "Obstacles"
    ? layer.data.flatMap((gid, i) =>
        gid
          ? [{ x: i % dungeon.width, y: Math.floor(i / dungeon.width), gid }]
          : [],
      )
    : [],
);
