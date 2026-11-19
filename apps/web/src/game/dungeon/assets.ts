export const dungeonPreviewMap = {
  key: "obsidian-dungeon",
  path: "assets/dungeon/obsidian-dungeon.tmj",
  light: "assets/dungeon/light.png",
} as const;

export const dungeonCombatMap = {
  ...dungeonPreviewMap,
  key: "obsidian-combat",
  path: "assets/dungeon/obsidian-combat.tmj",
} as const;
