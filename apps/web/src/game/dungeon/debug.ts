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

function drawDungeonDebug(
  graphics: Phaser.GameObjects.Graphics,
  map: DungeonMap,
  leftTile: number,
  topTile: number,
  rightTile: number,
  bottomTile: number,
) {
  graphics.clear();
  const { tileWidth, tileHeight } = map;
  for (let y = topTile; y < bottomTile; y++) {
    for (let x = leftTile; x < rightTile; x++) {
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
    if (
      color === undefined ||
      zone.x + zone.width < leftTile * tileWidth ||
      zone.x > rightTile * tileWidth ||
      zone.y + zone.height < topTile * tileHeight ||
      zone.y > bottomTile * tileHeight
    )
      continue;
    graphics
      .lineStyle(2, color, 0.78)
      .strokeRect(zone.x, zone.y, zone.width, zone.height);
  }
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
  let visibleBucket = "";
  const point = new Phaser.Math.Vector2();
  const zoneNames = ({ x, y }: WorldPoint) =>
    map
      .zonesAt(x, y)
      .map(({ id }) => id)
      .join(", ") || "â€”";
  const roomAt = ({ x, y }: WorldPoint) =>
    map.zonesAt(x, y).find(({ kind }) => kind === "room")?.id ?? "â€”";
  const tileAt = ({ x, y }: WorldPoint) => {
    const tile = map.worldToTile(x, y);
    return `${tile.x}, ${tile.y}`;
  };

  scene.input.keyboard
    ?.addKey(Phaser.Input.Keyboard.KeyCodes.F3)
    .on("down", () => {
      enabled = !enabled;
      overlay ??= scene.add.graphics().setDepth(100);
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

  return (
    elapsed: number,
    combat?: () => NonNullable<OnlineDebugInfo["combat"]>,
  ) => {
    if (!enabled || !overlay) return;
    const viewRect = camera.worldView;
    const left = Math.max(
      0,
      Math.floor(viewRect.left / (map.tileWidth * 8)) * 8,
    );
    const top = Math.max(
      0,
      Math.floor(viewRect.top / (map.tileHeight * 8)) * 8,
    );
    const right = Math.min(
      map.width,
      Math.ceil(viewRect.right / (map.tileWidth * 8)) * 8,
    );
    const bottom = Math.min(
      map.height,
      Math.ceil(viewRect.bottom / (map.tileHeight * 8)) * 8,
    );
    const bucket = [left, top, right, bottom].join("/");
    if (bucket !== visibleBucket) {
      visibleBucket = bucket;
      drawDungeonDebug(overlay, map, left, top, right, bottom);
    }
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
      tile: hovered ? tileAt(point) : "â€”",
      terrain: map.atWorld(point.x, point.y).terrain,
      room: roomAt(center),
      zones: zoneNames(point),
      ...(online
        ? {
            online: {
              ...online.sample(),
              ...(combat ? { combat: combat() } : {}),
            },
          }
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
