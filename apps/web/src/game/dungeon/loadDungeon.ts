import type Phaser from "phaser";
import {
  dungeonLayerDepths,
  readDungeonMap,
  type TiledDungeonMap,
} from "@obsidian/game-core";

export interface DungeonAsset {
  key: string;
  path: string;
  light: string;
}

const textureKey = (map: DungeonAsset, name: string) =>
  `${map.key}:tiles:${name}`;
export const dungeonLightKey = (map: DungeonAsset) => `${map.key}:light`;

export function preloadDungeon(scene: Phaser.Scene, asset: DungeonAsset) {
  const root = new URL(import.meta.env.BASE_URL, window.location.href);
  const url = new URL(asset.path, root);
  scene.load.once(
    `filecomplete-tilemapJSON-${asset.key}`,
    (_key: string, _type: string, data: TiledDungeonMap) => {
      for (const tileset of data.tilesets) {
        if (tileset.image)
          scene.load.image(
            textureKey(asset, tileset.name),
            new URL(tileset.image, url).href,
          );
      }
    },
  );
  scene.load.image(dungeonLightKey(asset), new URL(asset.light, root).href);
  scene.load.tilemapTiledJSON(asset.key, url.href);
}

export function loadDungeon(scene: Phaser.Scene, asset: DungeonAsset) {
  const cached = scene.cache.tilemap.get(asset.key) as
    { data: TiledDungeonMap } | undefined;
  if (!cached) throw new Error("Dungeon map could not be loaded.");

  const data = readDungeonMap(cached.data);
  const tilemap = scene.make.tilemap({ key: asset.key });
  const tilesets = cached.data.tilesets.map(({ name }) => {
    const key = textureKey(asset, name);
    const tileset =
      scene.textures.exists(key) && tilemap.addTilesetImage(name, key);
    if (!tileset)
      throw new Error(`Dungeon tileset ${name} could not be loaded.`);
    return tileset;
  });

  const layers = Object.entries(dungeonLayerDepths).map(([name, depth]) => {
    const layer = tilemap.createLayer(name, tilesets);
    if (!layer) throw new Error(`Could not render dungeon layer ${name}.`);
    return layer.setDepth(depth);
  });

  return { data, tilemap, layers, tilesets: cached.data.tilesets };
}
