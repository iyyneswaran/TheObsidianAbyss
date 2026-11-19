import type Phaser from "phaser";
import type { DungeonMap } from "@obsidian/game-core";

const options = {
  room: 0xa59dda,
  player_spawn: 0x8bffac,
  monster_patrol_zone: 0xff77cc,
  mana_shrine: 0x68b4ff,
  mana_restoration_zone: 0x41e5fc,
  safe_area: 0x8effec,
  hiding_area: 0xad8cff,
  bridge: 0xffe793,
  room_connection: 0x60a38e,
} as Record<string, number>;

export function drawDungeonDebug(scene: Phaser.Scene, map: DungeonMap) {
  const graphics = scene.add.graphics().setDepth(100);
  const { tileWidth, tileHeight } = map;
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const { terrain } = map.atTile(x, y);
      if (terrain !== "solid" && terrain !== "lava") continue;
      const left = x * tileWidth;
      const top = y * tileHeight;
      const right = left + tileWidth;
      const bottom = top + tileHeight;
      const color = terrain === "lava" ? 0xffa630 : 0xf35b80;
      graphics
        .fillStyle(color, 0.17)
        .fillRect(left, top, tileWidth, tileHeight);
      graphics.lineStyle(1, color, 0.9);
      if (map.atTile(x, y - 1).terrain !== terrain)
        graphics.lineBetween(left, top, right, top);
      if (map.atTile(x + 1, y).terrain !== terrain)
        graphics.lineBetween(right, top, right, bottom);
      if (map.atTile(x, y + 1).terrain !== terrain)
        graphics.lineBetween(left, bottom, right, bottom);
      if (map.atTile(x - 1, y).terrain !== terrain)
        graphics.lineBetween(left, top, left, bottom);
    }
  }

  for (const zone of map.zones) {
    const color = options[zone.kind];
    if (color === undefined) continue;
    graphics
      .lineStyle(2, color, 0.78)
      .strokeRect(zone.x, zone.y, zone.width, zone.height);
  }
  return graphics;
}
