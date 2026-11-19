import Phaser from "phaser";
import { dungeonPreviewMap } from "../dungeon/assets";
import { createDungeonCamera } from "../dungeon/camera";
import { drawDungeonDebug } from "../dungeon/debug";
import { createEnvironment } from "../dungeon/environment";
import {
  dungeonLightKey,
  loadDungeon,
  preloadDungeon,
} from "../dungeon/loadDungeon";
import type { DungeonPreviewEvents } from "../dungeon/preview";

const keyCodes = Phaser.Input.Keyboard.KeyCodes;
const inputs = {
  w: keyCodes.W,
  a: keyCodes.A,
  s: keyCodes.S,
  d: keyCodes.D,
  up: keyCodes.UP,
  left: keyCodes.LEFT,
  down: keyCodes.DOWN,
  right: keyCodes.RIGHT,
};

export class DungeonScene extends Phaser.Scene {
  private step?: (delta: number) => void;

  constructor(private readonly eventsOut: DungeonPreviewEvents) {
    super("dungeon");
  }

  preload() {
    preloadDungeon(this, dungeonPreviewMap);
  }

  create() {
    try {
      this.startPreview();
    } catch (error) {
      this.eventsOut.onError(error);
    }
  }

  private startPreview() {
    const { data, tilemap, layers, tilesets } = loadDungeon(
      this,
      dungeonPreviewMap,
    );
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => tilemap.destroy());

    const rooms = data.zones.flatMap(({ id, kind, properties }) => {
      const { title, cameraX, cameraY } = properties;
      if (
        kind !== "room" ||
        typeof title !== "string" ||
        typeof cameraX !== "number" ||
        typeof cameraY !== "number"
      )
        return [];
      return [{ id, title, x: cameraX, y: cameraY }];
    });
    if (!rooms[0])
      throw new Error("Dungeon needs at least one room focus point.");
    const camera = this.cameras.main.setBounds(
      0,
      0,
      data.worldWidth,
      data.worldHeight,
    );
    const view = createDungeonCamera(
      camera,
      { width: data.worldWidth, height: data.worldHeight },
      rooms[0],
    );
    const keyboard = this.input.keyboard;
    if (!keyboard)
      throw new Error("Dungeon keyboard controls could not initialize.");

    const keys = Object.fromEntries(
      Object.entries(inputs).map(([name, code]) => [
        name,
        keyboard.addKey(code),
      ]),
    ) as Record<keyof typeof inputs, Phaser.Input.Keyboard.Key>;

    const reset = () => view.reset();
    const zoom = (
      _pointer: Phaser.Input.Pointer,
      _objects: unknown,
      _dx: number,
      dy: number,
    ) => {
      if (dy) view.zoomBy(dy < 0 ? 1 : -1);
    };
    keyboard.addKey(keyCodes.R).on("down", reset);
    this.input.on("wheel", zoom);

    const animate = createEnvironment(
      this,
      data,
      layers,
      tilesets,
      dungeonLightKey(dungeonPreviewMap),
    );

    let publishDebug: ((elapsed: number) => void) | undefined;
    if (import.meta.env.DEV) {
      let overlay: Phaser.GameObjects.Graphics | undefined;
      let enabled = false;
      let nextSample = 0;
      const point = new Phaser.Math.Vector2();
      const toggle = () => {
        enabled = !enabled;
        overlay ??= drawDungeonDebug(this, data);
        overlay.setVisible(enabled);
        nextSample = 0;
        if (!enabled) this.eventsOut.onDebug(null);
      };
      keyboard.addKey(keyCodes.F3).on("down", toggle);

      publishDebug = (elapsed) => {
        if (!enabled || elapsed < nextSample) return;
        const { x, y, zoom } = view.state;
        const hovered = this.game.canvas.matches(":hover");
        const pointer = this.input.activePointer;
        if (hovered) camera.getWorldPoint(pointer.x, pointer.y, point);
        else point.set(x, y);
        const tile = data.worldToTile(point.x, point.y);
        const room = data.zonesAt(x, y).find(({ kind }) => kind === "room");
        this.eventsOut.onDebug({
          cameraX: Math.round(x),
          cameraY: Math.round(y),
          zoom,
          worldWidth: data.worldWidth,
          worldHeight: data.worldHeight,
          tile: hovered ? `${tile.x}, ${tile.y}` : "—",
          terrain: data.atWorld(point.x, point.y).terrain,
          room: room?.id ?? "—",
          zones:
            data
              .zonesAt(point.x, point.y)
              .map(({ id }) => id)
              .join(", ") || "—",
        });
        nextSample = elapsed + 100;
      };
    }

    let lastX = NaN;
    let lastY = NaN;
    let lastZoom = NaN;
    const positionCamera = () => {
      const { x, y, zoom } = view.state;
      const pixelX = Math.round(x * zoom) / zoom;
      const pixelY = Math.round(y * zoom) / zoom;
      if (pixelX === lastX && pixelY === lastY && zoom === lastZoom) return;
      camera.setZoom(zoom).centerOn(pixelX, pixelY);
      lastX = pixelX;
      lastY = pixelY;
      lastZoom = zoom;
    };
    positionCamera();

    let elapsed = 0;
    this.step = (delta) => {
      const dx =
        Number(keys.d.isDown || keys.right.isDown) -
        Number(keys.a.isDown || keys.left.isDown);
      const dy =
        Number(keys.s.isDown || keys.down.isDown) -
        Number(keys.w.isDown || keys.up.isDown);
      view.pan(dx, dy, Math.min(delta, 50));
      positionCamera();
      elapsed += delta;
      animate(elapsed);
      publishDebug?.(elapsed);
    };

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.off("wheel", zoom);
      delete this.step;
    });

    this.eventsOut.onReady({
      rooms: rooms.map(({ id, title }) => ({ id, title })),
      focusRoom(id) {
        const room = rooms.find((entry) => entry.id === id);
        if (room) view.focus(room);
      },
    });
  }

  override update(_time: number, delta: number) {
    this.step?.(delta);
  }
}
