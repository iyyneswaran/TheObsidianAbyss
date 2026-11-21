export interface RoomPreview {
  id: string;
  title: string;
}

export interface DungeonDebugInfo {
  cameraX: number;
  cameraY: number;
  zoom: number;
  worldWidth: number;
  worldHeight: number;
  tile: string;
  terrain: string;
  room: string;
  zones: string;
  online?: OnlineDebugInfo;
  player?: PlayerTransform & {
    classId: WizardClassId;
    speed: number;
    tile: string;
    room: string;
    zones: string;
    hazardous: boolean;
    animation: string;
    frame: string;
  };
}

export type DungeonPreview =
  | { mode: "play" }
  | { mode: "inspect"; rooms: RoomPreview[]; focusRoom: (id: string) => void };

export interface DungeonPreviewEvents {
  onProgress?: (value: number) => void;
  onReady: (preview: DungeonPreview) => void;
  onError: (error: unknown) => void;
  onDebug: (info: DungeonDebugInfo | null) => void;
}
import type { WizardClassId } from "@obsidian/game-assets";
import type { PlayerTransform } from "@obsidian/game-core";
import type { OnlineDebugInfo } from "../characters/onlineActors";
