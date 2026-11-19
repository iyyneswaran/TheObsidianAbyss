/** Logical game dimensions in pixels. The renderer handles display scaling. */
export const gameViewport = { width: 640, height: 360 } as const;

export * from "./dungeon.js";
export * from "./movement.js";
export * from "./combat/index.js";
