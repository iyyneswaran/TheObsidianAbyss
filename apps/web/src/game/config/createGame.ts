import { BootScene } from "../scenes/BootScene";
import { PlaygroundScene } from "../scenes/PlaygroundScene";
import { createPhaserGame } from "./engine";

export function createGame(
  parent: HTMLElement,
  onReady: (play: (() => void) | null) => void,
) {
  return createPhaserGame(parent, [BootScene, new PlaygroundScene(onReady)]);
}
