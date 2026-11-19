import Phaser from "phaser";
import { gameViewport } from "@obsidian/game-core";

export function createPhaserGame(
  parent: HTMLElement,
  scene: Phaser.Types.Scenes.SceneType[],
  options: Pick<Phaser.Types.Core.GameConfig, "backgroundColor" | "input"> = {},
) {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: "#101022",
    ...options,
    pixelArt: true,
    roundPixels: true,
    banner: false,
    audio: { noAudio: true },
    scale: {
      ...gameViewport,
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene,
  });
}
