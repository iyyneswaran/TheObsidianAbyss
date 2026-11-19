import type Phaser from "phaser";
import { wizards, type WizardClassId } from "@obsidian/game-assets";
import type { DungeonMap, WorldPoint } from "@obsidian/game-core";
import type { PlayerConnection } from "@obsidian/shared/coop";
import type { party } from "../../multiplayer/party";
import { createWizardActor } from "./player";

export type OnlineConnection = typeof party;
export interface OnlineDebugInfo {
  code: string;
  roomId: string;
  localId: string;
  rate: number;
  tick: number;
  combat?: {
    renderedFx: number;
    lastFx: string;
    seenEffects: string[];
    aim: WorldPoint;
    projectiles: number;
    targets: {
      id: string;
      kind: string;
      appearance: string;
      hp: number;
      maxHp: number;
      x: number;
      y: number;
      action: string;
      statuses: string;
      target: string;
    }[];
  };
  actors: {
    id: string;
    name: string;
    wizard: WizardClassId;
    authoritative: WorldPoint;
    rendered: WorldPoint;
    connection: PlayerConnection;
    acknowledged: number;
    animation: string;
    room: string;
    zones: string;
    hazardous: boolean;
  }[];
}

export function createOnlineActors(
  scene: Phaser.Scene,
  map: DungeonMap,
  depthAt: (y: number) => number,
  party: OnlineConnection,
) {
  const actors = new Map<
    string,
    { sprite: ReturnType<typeof createWizardActor>; renderPoint: WorldPoint }
  >();

  return {
    get localPosition() {
      const localId = party.getSnapshot().playerId;
      const world = party.world;
      if (world?.players.get(localId)?.life === "DEAD") {
        const target = party.spectatorId;
        const selected = world.players.get(target);
        if (selected?.life === "ALIVE" && selected.connection === "CONNECTED")
          return actors.get(target)?.renderPoint;
        for (const [id, player] of world.players)
          if (player.life === "ALIVE" && player.connection === "CONNECTED")
            return actors.get(id)?.renderPoint;
      }
      return actors.get(localId)?.renderPoint;
    },
    step(x: number, y: number, delta: number) {
      const world = party.world;
      if (!world?.players) return;
      party.sendMovement(x, y, performance.now());

      for (const [id, actor] of actors) {
        if (world.players.has(id)) continue;
        actor.sprite.destroy();
        actors.delete(id);
      }
      world.players.forEach((player, id) => {
        let actor = actors.get(id);
        if (!actor) {
          const wizard = wizards[player.wizard];
          actor = {
            sprite: createWizardActor(scene, wizard, depthAt, player),
            renderPoint: { x: player.x, y: player.y },
          };
          actors.set(id, actor);
        }
        const point = actor.renderPoint;
        const locked = player.connection !== "CONNECTED";
        const mix =
          locked || Math.hypot(player.x - point.x, player.y - point.y) > 90
            ? 1
            : 1 - Math.exp(-delta / 58);
        point.x += (player.x - point.x) * mix;
        point.y += (player.y - point.y) * mix;
        actor.sprite.render(
          {
            x: point.x,
            y: point.y,
            facing: player.facing,
            moving: player.moving && !locked,
          },
          locked,
        );
        actor.sprite.setVisible(player.life === "ALIVE");
      });
    },
    sample(): OnlineDebugInfo {
      const world = party.world;
      const { code, roomId, playerId } = party.getSnapshot();
      const samples: OnlineDebugInfo["actors"] = [];
      for (const [id, actor] of actors) {
        const player = world?.players.get(id);
        if (!player) continue;
        const zones = map.zonesAt(player.x, player.y);
        samples.push({
          id,
          name: player.name,
          wizard: player.wizard,
          authoritative: { x: player.x, y: player.y },
          rendered: { ...actor.renderPoint },
          connection: player.connection,
          acknowledged: player.acknowledged,
          animation: actor.sprite.animation,
          room: zones.find(({ kind }) => kind === "room")?.id ?? "—",
          zones: zones.map(({ id: zoneId }) => zoneId).join(", ") || "—",
          hazardous: player.hazardous,
        });
      }
      return {
        code,
        roomId,
        localId: playerId,
        rate: party.updateRate,
        tick: world?.tick ?? 0,
        actors: samples,
      };
    },
  };
}
