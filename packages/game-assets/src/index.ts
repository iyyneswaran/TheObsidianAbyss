export interface EffectAsset {
  id: string;
  key: string;
  texturePath: string;
  metadataPath: string;
  playback: { repeat: number; hideOnComplete: boolean };
  layer: "behind-actors" | "above-actors";
}

export interface PixelFxAtlas {
  frames: {
    filename: string;
    frame: { x: number; y: number; w: number; h: number };
    duration: number;
  }[];
  meta: {
    image: string;
    size: { w: number; h: number };
    pixelfx: {
      id: string;
      fps: number;
      loop: boolean;
      frames: number;
      frameSize: [width: number, height: number];
      pivot: [x: number, y: number];
    };
  };
}

export const effects = {
  "ice/frost-nova": {
    id: "ice/frost-nova",
    key: "frost-nova",
    texturePath: "assets/fx/ice/frost-nova.png",
    metadataPath: "assets/fx/ice/frost-nova.json",
    playback: { repeat: 0, hideOnComplete: true },
    layer: "above-actors",
  },
} as const satisfies Record<string, EffectAsset>;

export type EffectId = keyof typeof effects;

export * from "./wizards.js";
