import Phaser from "phaser";
import type { WizardClass } from "@obsidian/game-assets";
import { createPlayer, preloadWizard } from "../characters/player";
import { sortDungeonOccluders } from "../dungeon/actorDepth";
import { dungeonPreviewMap } from "../dungeon/assets";
import { createDungeonCamera } from "../dungeon/camera";
import { setupDungeonDebug } from "../dungeon/debug";
import { createEnvironment } from "../dungeon/environment";
import {
  dungeonLightKey,
  loadDungeon,
  preloadDungeon,
} from "../dungeon/loadDungeon";
import type { DungeonPreviewEvents } from "../dungeon/preview";

const { W, A, S, D, UP, LEFT, DOWN, RIGHT, R } = Phaser.Input.Keyboard.KeyCodes;

export class DungeonScene extends Phaser.Scene {
  private step?: (delta: number) => void;

  constructor(
    private readonly eventsOut: DungeonPreviewEvents,
    private readonly wizard?: WizardClass,
  ) {
    super("dungeon");
  }

  preload() {
    preloadDungeon(this, dungeonPreviewMap);
    if (this.wizard) preloadWizard(this, this.wizard);
  }

  create() {
    try {
      this.startDungeon();
    } catch (error) {
      this.eventsOut.onError(error);
    }
  }

  private startDungeon() {
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

    const player = this.wizard
      ? createPlayer(
          this,
          data,
          this.wizard,
          sortDungeonOccluders(this, tilemap, layers),
        )
      : undefined;
    const camera = this.cameras.main.setBounds(
      0,
      0,
      data.worldWidth,
      data.worldHeight,
    );
    const view = createDungeonCamera(
      camera,
      { width: data.worldWidth, height: data.worldHeight },
      player?.transform ?? rooms[0],
      player ? 1 : 0.5,
    );
    const keyboard = this.input.keyboard;
    if (!keyboard)
      throw new Error("Dungeon keyboard controls could not initialize.");

    const keys = {
      w: keyboard.addKey(W),
      a: keyboard.addKey(A),
      s: keyboard.addKey(S),
      d: keyboard.addKey(D),
      up: keyboard.addKey(UP),
      left: keyboard.addKey(LEFT),
      down: keyboard.addKey(DOWN),
      right: keyboard.addKey(RIGHT),
    };
    if (!player) keyboard.addKey(R).on("down", () => view.reset());

    const zoom = (
      _pointer: Phaser.Input.Pointer,
      _objects: unknown,
      _dx: number,
      dy: number,
    ) => {
      if (dy) view.zoomBy(dy < 0 ? 1 : -1);
    };
    this.input.on("wheel", zoom);

    const animate = createEnvironment(
      this,
      data,
      layers,
      tilesets,
      dungeonLightKey(dungeonPreviewMap),
    );
    const debug = import.meta.env.DEV
      ? setupDungeonDebug(
          this,
          data,
          camera,
          view,
          this.eventsOut.onDebug,
          this.wizard,
          player,
        )
      : undefined;

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
      const x =
        Number(keys.d.isDown || keys.right.isDown) -
        Number(keys.a.isDown || keys.left.isDown);
      const y =
        Number(keys.s.isDown || keys.down.isDown) -
        Number(keys.w.isDown || keys.up.isDown);
      const step = Math.min(delta, 50);
      if (player) {
        player.step({ x, y }, step);
        view.follow(player.transform, step);
      } else {
        view.pan(x, y, step);
      }
      positionCamera();
      elapsed += delta;
      animate(elapsed);
      debug?.(elapsed);
    };

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.off("wheel", zoom);
      delete this.step;
    });

    if (player) this.eventsOut.onReady({ mode: "play" });
    else {
      this.eventsOut.onReady({
        mode: "inspect",
        rooms: rooms.map(({ id, title }) => ({ id, title })),
        focusRoom(id) {
          const room = rooms.find((entry) => entry.id === id);
          if (room) view.focus(room);
        },
      });
    }
  }

  override update(_time: number, delta: number) {
    this.step?.(delta);
  }
}
