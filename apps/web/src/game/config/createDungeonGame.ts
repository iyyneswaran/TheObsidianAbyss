import type { WizardClass } from "@obsidian/game-assets";
import type { DungeonPreviewEvents } from "../dungeon/preview";
import { DungeonScene } from "../scenes/DungeonScene";
import { createPhaserGame } from "./engine";

export function createDungeonGame(
  parent: HTMLElement,
  events: DungeonPreviewEvents,
  wizard?: WizardClass,
) {
  return createPhaserGame(parent, [new DungeonScene(events, wizard)], {
    backgroundColor: "#130e1c",
    input: { mouse: { preventDefaultWheel: true } },
  });
}
