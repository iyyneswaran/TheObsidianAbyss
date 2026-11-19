import Phaser from "phaser";
import { wizards, type WizardClass } from "@obsidian/game-assets";
import {
  createOnlineActors,
  type OnlineConnection,
} from "../characters/onlineActors";
import { createPlayer, preloadWizard } from "../characters/player";
import {
  createCombatPresentation,
  preloadCombat,
} from "../combat/presentation";
import { sortDungeonOccluders } from "../dungeon/actorDepth";
import { dungeonCombatMap, dungeonPreviewMap } from "../dungeon/assets";
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
    private readonly online?: OnlineConnection,
  ) {
    super("dungeon");
  }

  preload() {
    preloadDungeon(this, this.online ? dungeonCombatMap : dungeonPreviewMap);
    if (this.wizard) preloadWizard(this, this.wizard);
    if (this.online) {
      const classes = new Set(
        this.online.getSnapshot().members.map(({ wizard }) => wizard),
      );
      for (const id of classes) preloadWizard(this, wizards[id]);
      preloadCombat(this, classes);
    }
  }

  create() {
    try {
      this.startDungeon();
    } catch (error) {
      this.eventsOut.onError(error);
    }
  }

  private startDungeon() {
    const asset = this.online ? dungeonCombatMap : dungeonPreviewMap;
    const { data, tilemap, layers, tilesets } = loadDungeon(this, asset);
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

    const depthAt =
      this.wizard || this.online
        ? sortDungeonOccluders(this, tilemap, layers)
        : undefined;
    const player =
      this.wizard && depthAt
        ? createPlayer(this, data, this.wizard, depthAt)
        : undefined;
    const online =
      this.online && depthAt
        ? createOnlineActors(this, data, depthAt, this.online)
        : undefined;
    online?.step(0, 0, 0);
    const camera = this.cameras.main.setBounds(
      0,
      0,
      data.worldWidth,
      data.worldHeight,
    );
    const view = createDungeonCamera(
      camera,
      { width: data.worldWidth, height: data.worldHeight },
      player?.transform ?? online?.localPosition ?? rooms[0],
      player || online ? 1 : 0.5,
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
    if (!player && !online) keyboard.addKey(R).on("down", () => view.reset());

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
      dungeonLightKey(asset),
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
          online,
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
    const combat =
      this.online && depthAt
        ? createCombatPresentation(this, data, this.online, depthAt)
        : undefined;

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
      } else if (online) {
        online.step(x, y, step);
        if (online.localPosition) view.follow(online.localPosition, step);
      } else {
        view.pan(x, y, step);
      }
      positionCamera();
      combat?.step(step);
      elapsed += delta;
      animate(elapsed);
      const combatState = debug && this.online?.world?.combat;
      debug?.(
        elapsed,
        combat && combatState
          ? {
              ...combat.sample(),
              projectiles: combatState.projectiles.size,
              targets: [...combatState.enemies.entries()].map(
                ([id, enemy]) => ({
                  id,
                  kind: enemy.kind,
                  appearance: enemy.appearance,
                  x: enemy.x,
                  y: enemy.y,
                  hp: enemy.hp,
                  maxHp: enemy.maxHp,
                  action: enemy.action,
                  statuses: enemy.statuses,
                  target: enemy.target,
                }),
              ),
            }
          : undefined,
      );
    };

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.online?.sendMovement(0, 0, performance.now());
      this.input.off("wheel", zoom);
      delete this.step;
    });

    if (player || online) this.eventsOut.onReady({ mode: "play" });
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
