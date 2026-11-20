import type Phaser from "phaser";
import { dungeonLayerDepths, type DungeonZone } from "@obsidian/game-core";

/** Ground and lava remain batched layers. Only actor occluders join the Y sort. */
export function sortDungeonOccluders(
  scene: Phaser.Scene,
  map: Phaser.Tilemaps.Tilemap,
  layers: Phaser.Tilemaps.TilemapLayer[],
  sections: DungeonZone[] = [],
) {
  const depthAt = (y: number) =>
    dungeonLayerDepths.Walls + (y / (map.heightInPixels + 1)) * 14;
  const groups = new Map<string, Phaser.Tilemaps.Tile[]>();
  const pool: Phaser.GameObjects.Image[] = [];
  function render(tile: Phaser.Tilemaps.Tile, index?: number) {
    const texture = tile.tileset!.image!;
    const frame = "dungeon-occluder-" + tile.index;
    const image =
      index === undefined
        ? scene.add.image(0, 0, texture, frame)
        : (pool[index] ??
          (pool[index] = scene.add.image(0, 0, texture, frame)));
    image
      .setTexture(texture.key, frame)
      .setPosition(tile.pixelX + tile.width / 2, tile.pixelY + tile.height / 2)
      .setFlip(tile.flipX, tile.flipY)
      .setRotation(tile.rotation)
      .setAlpha(tile.alpha)
      .setDepth(depthAt(tile.pixelY + tile.height))
      .setVisible(true);
  }
  for (const layer of layers) {
    if (layer.layer.name !== "Walls" && layer.layer.name !== "Obstacles")
      continue;
    layer.forEachTile(
      (tile) => {
        const tileset = tile.tileset;
        const texture = tileset?.image;
        const uv = tileset?.getTileTextureCoordinates(tile.index) as
          { x: number; y: number } | null | undefined;
        if (!texture || !uv)
          throw new Error(
            `Missing occluder texture for dungeon tile ${tile.index}.`,
          );

        const frame = `dungeon-occluder-${tile.index}`;
        if (!texture.has(frame))
          texture.add(frame, 0, uv.x, uv.y, tile.width, tile.height);
        if (!sections.length) {
          render(tile);
          return;
        }
        const section = sections.find(
          (s) =>
            tile.pixelX >= s.x &&
            tile.pixelX < s.x + s.width &&
            tile.pixelY >= s.y &&
            tile.pixelY < s.y + s.height,
        );
        if (section) {
          const group = groups.get(section.id) ?? [];
          group.push(tile);
          groups.set(section.id, group);
        }
      },
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      { isNotEmpty: true },
    );
    layer.setVisible(false);
  }
  if (sections.length) {
    let active: string | undefined;
    function switchSection() {
      const camera = scene.cameras.main;
      const x = camera.midPoint.x,
        y = camera.midPoint.y;
      const section = sections.find(
        (s) => x >= s.x && y >= s.y && x < s.x + s.width && y < s.y + s.height,
      );
      if (!section || section.id === active) return;
      active = section.id;
      const tiles = groups.get(active) ?? [];
      tiles.forEach(render);
      for (let i = tiles.length; i < pool.length; i++)
        pool[i]!.setVisible(false);
    }
    switchSection();
    scene.events.on("postupdate", switchSection);
    scene.events.once("shutdown", () =>
      scene.events.off("postupdate", switchSection),
    );
  }
  return depthAt;
}
