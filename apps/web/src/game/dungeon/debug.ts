import Phaser from "phaser";
import type { WizardClass } from "@obsidian/game-assets";
import {
  playerFootprint,
  playerSpeed,
  playerTerrain,
  type DungeonMap,
  type WorldPoint,
} from "@obsidian/game-core";
import type { DungeonPlayer } from "../characters/player";
import type { createOnlineActors } from "../characters/onlineActors";
import type { createDungeonCamera } from "./camera";
import type { DungeonDebugInfo } from "./preview";
import type { OnlineDebugInfo } from "../characters/onlineActors";

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

function drawDungeonDebug(scene: Phaser.Scene, map: DungeonMap) {
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

export function setupDungeonDebug(
  scene: Phaser.Scene,
  map: DungeonMap,
  camera: Phaser.Cameras.Scene2D.Camera,
  view: ReturnType<typeof createDungeonCamera>,
  publish: (info: DungeonDebugInfo | null) => void,
  wizard?: WizardClass,
  player?: DungeonPlayer,
  online?: ReturnType<typeof createOnlineActors>,
) {
  let overlay: Phaser.GameObjects.Graphics | undefined;
  let footprint: Phaser.GameObjects.Rectangle | undefined;
  let enabled = false;
  let nextSample = 0;
  const point = new Phaser.Math.Vector2();
  const zoneNames = ({ x, y }: WorldPoint) =>
    map
      .zonesAt(x, y)
      .map(({ id }) => id)
      .join(", ") || "—";
  const roomAt = ({ x, y }: WorldPoint) =>
    map.zonesAt(x, y).find(({ kind }) => kind === "room")?.id ?? "—";
  const tileAt = ({ x, y }: WorldPoint) => {
    const tile = map.worldToTile(x, y);
    return `${tile.x}, ${tile.y}`;
  };

  scene.input.keyboard
    ?.addKey(Phaser.Input.Keyboard.KeyCodes.F3)
    .on("down", () => {
      enabled = !enabled;
      overlay ??= drawDungeonDebug(scene, map);
      overlay.setVisible(enabled);
      if ((player || online) && !footprint) {
        footprint = scene.add
          .rectangle(0, 0, playerFootprint.width, playerFootprint.height)
          .setStrokeStyle(1, 0xcdffef)
          .setDepth(101);
      }
      footprint?.setVisible(enabled);
      nextSample = 0;
      if (!enabled) publish(null);
    });

  return (elapsed: number, combat?: OnlineDebugInfo["combat"]) => {
    if (!enabled) return;
    const transform = player?.transform;
    const rendered = transform ?? online?.localPosition;
    if (rendered) footprint?.setPosition(rendered.x, rendered.y);
    if (elapsed < nextSample) return;

    const center = view.state;
    const hovered = scene.game.canvas.matches(":hover");
    const pointer = scene.input.activePointer;
    if (hovered) camera.getWorldPoint(pointer.x, pointer.y, point);
    else point.set(center.x, center.y);

    publish({
      cameraX: Math.round(center.x),
      cameraY: Math.round(center.y),
      zoom: center.zoom,
      worldWidth: map.worldWidth,
      worldHeight: map.worldHeight,
      tile: hovered ? tileAt(point) : "—",
      terrain: map.atWorld(point.x, point.y).terrain,
      room: roomAt(center),
      zones: zoneNames(point),
      ...(online
        ? { online: { ...online.sample(), ...(combat ? { combat } : {}) } }
        : {}),
      ...(wizard && player && transform
        ? {
            player: {
              ...transform,
              classId: wizard.id,
              speed: playerSpeed,
              tile: tileAt(transform),
              room: roomAt(transform),
              zones: zoneNames(transform),
              hazardous: playerTerrain(map, transform).hazardous,
              animation: player.animation,
              frame: player.frame,
            },
          }
        : {}),
    });
    nextSample = elapsed + 100;
  };
}
