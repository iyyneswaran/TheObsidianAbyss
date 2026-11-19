import type { WizardClass } from "@obsidian/game-assets";
import type { OnlineConnection } from "../characters/onlineActors";
import type { DungeonPreviewEvents } from "../dungeon/preview";
import { DungeonScene } from "../scenes/DungeonScene";
import { createPhaserGame } from "./engine";

export function createDungeonGame(
  parent: HTMLElement,
  events: DungeonPreviewEvents,
  wizard?: WizardClass,
  online?: OnlineConnection,
) {
  return createPhaserGame(parent, [new DungeonScene(events, wizard, online)], {
    backgroundColor: "#130e1c",
    input: { mouse: { preventDefaultWheel: true } },
  });
}
