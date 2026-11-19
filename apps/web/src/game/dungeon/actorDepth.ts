import type Phaser from "phaser";
import { dungeonLayerDepths } from "@obsidian/game-core";

/** Ground and lava remain batched layers. Only actor occluders join the Y sort. */
export function sortDungeonOccluders(
  scene: Phaser.Scene,
  map: Phaser.Tilemaps.Tilemap,
  layers: Phaser.Tilemaps.TilemapLayer[],
) {
  const depthAt = (y: number) =>
    dungeonLayerDepths.Walls + (y / (map.heightInPixels + 1)) * 14;
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
        scene.add
          .image(
            tile.pixelX + tile.width / 2,
            tile.pixelY + tile.height / 2,
            texture,
            frame,
          )
          .setFlip(tile.flipX, tile.flipY)
          .setRotation(tile.rotation)
          .setAlpha(tile.alpha)
          .setDepth(depthAt(tile.pixelY + tile.height));
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
  return depthAt;
}
