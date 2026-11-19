import Phaser from "phaser";
import { gameViewport } from "@obsidian/game-core";
import { BootScene } from "../scenes/BootScene";
import { PlaygroundScene } from "../scenes/PlaygroundScene";

export function createGame(
  parent: HTMLElement,
  onReady: (play: (() => void) | null) => void,
) {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: "#101022",
    pixelArt: true,
    roundPixels: true,
    banner: false,
    audio: { noAudio: true },
    scale: {
      ...gameViewport,
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [BootScene, new PlaygroundScene(onReady)],
  });
}
