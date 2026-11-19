import type Phaser from "phaser";
import { effects, type PixelFxAtlas } from "@obsidian/game-assets";

export const frostNova = effects["ice/frost-nova"];

export function preloadFrostNova(scene: Phaser.Scene) {
  const base = import.meta.env.BASE_URL;
  scene.load.aseprite(
    frostNova.key,
    base + frostNova.texturePath,
    base + frostNova.metadataPath,
  );
}

export function createFrostNova(scene: Phaser.Scene, x: number, y: number) {
  const atlas = scene.cache.json.get(frostNova.key) as PixelFxAtlas | undefined;
  if (!atlas || !scene.textures.exists(frostNova.key)) return undefined;

  const { fps, frameSize, pivot } = atlas.meta.pixelfx;
  scene.anims.create({
    key: frostNova.key,
    frames: atlas.frames.map(({ filename, duration }) => ({
      key: frostNova.key,
      frame: filename,
      duration,
    })),
    frameRate: fps,
    ...frostNova.playback,
  });

  return scene.add
    .sprite(x, y, frostNova.key)
    .setOrigin(pivot[0] / frameSize[0], pivot[1] / frameSize[1])
    .setDepth(frostNova.layer === "above-actors" ? 1 : -1)
    .setVisible(false);
}
