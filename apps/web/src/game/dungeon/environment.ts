import Phaser from "phaser";
import type { DungeonMap, TiledTileset } from "@obsidian/game-core";

export function createEnvironment(
  scene: Phaser.Scene,
  map: DungeonMap,
  layers: Phaser.Tilemaps.TilemapLayer[],
  tilesets: TiledTileset[],
  lightKey: string,
) {
  const clips = new Map<
    number,
    {
      frames: { gid: number; until: number }[];
      duration: number;
      current: number;
      tiles: Phaser.Tilemaps.Tile[];
    }
  >();
  const emitters = new Map<number, string>();
  for (const tileset of tilesets) {
    for (const tile of tileset.tiles ?? []) {
      const gid = tileset.firstgid + tile.id;
      const emitter = tile.properties?.find(
        ({ name }) => name === "emitter",
      )?.value;
      if (typeof emitter === "string") emitters.set(gid, emitter);
      if (!tile.animation?.length) continue;

      let duration = 0;
      const frames = tile.animation.map(({ tileid, duration: interval }) => {
        duration += interval;
        return { gid: tileset.firstgid + tileid, until: duration };
      });
      clips.set(gid, { frames, duration, current: gid, tiles: [] });
    }
  }

  function glow(
    x: number,
    y: number,
    color: number,
    diameter: number,
    opacity: number,
  ) {
    return scene.add
      .image(x, y, lightKey)
      .setTint(color)
      .setDisplaySize(diameter, diameter)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(55)
      .setAlpha(opacity);
  }

  const lights: {
    image: Phaser.GameObjects.Image;
    phase: number;
    alpha: number;
    amplitude: number;
    speed: number;
  }[] = [];
  for (const layer of layers) {
    layer.forEachTile(
      (tile) => {
        clips.get(tile.index)?.tiles.push(tile);
        const emitter = emitters.get(tile.index);
        const x = tile.pixelX + map.tileWidth / 2;
        const y = tile.pixelY + map.tileHeight / 2;
        if (emitter === "torch") {
          lights.push({
            image: glow(x, y + 3, 0xff761f, 134, 0.58),
            phase: x + y,
            alpha: 0.58,
            amplitude: 0.13,
            speed: 0.011,
          });
        } else if (emitter === "shrine") {
          lights.push({
            image: glow(x, y + 40, 0x26a9ff, 230, 0.7),
            phase: 0,
            alpha: 0.7,
            amplitude: 0.16,
            speed: 0.003,
          });
        }

        if (
          layer.layer.name === "Lava" &&
          tile.index > 0 &&
          tile.x % 3 === 0 &&
          tile.y % 3 === 0
        ) {
          glow(x, y, 0xf45620, 150, 0.25);
        }
      },
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      { isNotEmpty: true },
    );
  }

  return (elapsed: number) => {
    for (const clip of clips.values()) {
      const frame = clip.frames.find(
        ({ until }) => elapsed % clip.duration < until,
      );
      if (!frame || frame.gid === clip.current) continue;
      clip.current = frame.gid;
      for (const tile of clip.tiles) tile.index = frame.gid;
    }
    for (const { image, phase, alpha, amplitude, speed } of lights) {
      image.setAlpha(alpha + Math.sin(elapsed * speed + phase) * amplitude);
    }
  };
}
