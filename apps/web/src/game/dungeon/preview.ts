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
}

export interface DungeonPreview {
  rooms: RoomPreview[];
  focusRoom: (id: string) => void;
}

export interface DungeonPreviewEvents {
  onReady: (preview: DungeonPreview) => void;
  onError: (error: unknown) => void;
  onDebug: (info: DungeonDebugInfo | null) => void;
}
