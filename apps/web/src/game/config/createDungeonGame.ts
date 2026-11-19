import type { DungeonPreviewEvents } from "../dungeon/preview";
import { DungeonScene } from "../scenes/DungeonScene";
import { createPhaserGame } from "./engine";

export function createDungeonGame(
  parent: HTMLElement,
  events: DungeonPreviewEvents,
) {
  return createPhaserGame(parent, [new DungeonScene(events)], {
    backgroundColor: "#130e1c",
    input: { mouse: { preventDefaultWheel: true } },
  });
}
