import Phaser from "phaser";
import { combatEffects, type PixelFxAtlas } from "@obsidian/game-assets";
import {
  alternatives,
  center,
  enemyAppearances,
  loadouts,
  type AbilitySlot,
  type CombatClass,
  type CombatEvent,
  type DungeonMap,
} from "@obsidian/game-core";
import type { OnlineConnection } from "../characters/onlineActors";

const sharedEffects = [
  "fire/fire-breath",
  "shadow/void-orb",
  "shadow/shadow-tendrils",
  "shadow/grasping-hands",
  "shadow/soul-drain",
  "shadow/dark-explosion",
  "arcane/arcane-beam",
  "arcane/mana-burst",
  "arcane/portal",
  "spawn/disintegrate",
  "spawn/summon-rise",
  "explosions/big-explosion",
];
const facingRows: Record<string, number> = {
  down: 0,
  up: 1,
  left: 2,
  right: 3,
};
const directional = new Set([
  "fire/fire-breath",
  "fire/flamethrower",
  "ice/frost-breath",
  "nature/vine-whip",
  "arcane/arcane-beam",
]);

export function preloadCombat(
  scene: Phaser.Scene,
  classes: Iterable<CombatClass>,
) {
  const base = import.meta.env.BASE_URL;
  const ids = new Set(sharedEffects);
  for (const wizard of classes) {
    for (const { fx } of Object.values(loadouts[wizard].abilities)) ids.add(fx);
    for (const item of alternatives)
      if (item.wizard === wizard) ids.add(item.fx);
  }
  for (const id of ids) {
    const asset = combatEffects.get(id)!;
    scene.load.aseprite(
      asset.key,
      base + asset.texturePath,
      base + asset.metadataPath,
    );
  }
  for (const kind of enemyAppearances)
    scene.load.spritesheet(
      "combat:" + kind,
      base + `assets/monsters/${kind}.png`,
      { frameWidth: 48, frameHeight: 48 },
    );
}

export function createCombatPresentation(
  scene: Phaser.Scene,
  map: DungeonMap,
  party: OnlineConnection,
  depthAt: (y: number) => number,
) {
  const camera = scene.cameras.main;
  const gate = center(map.zones.find(({ kind }) => kind === "boss_gate")!);
  const warnings = scene.add.graphics().setDepth(68);
  const bars = scene.add.graphics().setDepth(89);
  const monsters = new Map<string, Phaser.GameObjects.Sprite>();
  const shots = new Map<string, Phaser.GameObjects.Sprite>();
  const effects = new Set<Phaser.GameObjects.Sprite>();
  const floats = new Set<Phaser.GameObjects.Text>();
  const recentHits = new Map<string, number>();
  let lastEvent = 0;
  let renderedFx = 0;
  let lastFx = "";
  const seenEffects = new Set<string>();

  const effect = (
    id: string,
    x: number,
    y: number,
    angle = 0,
    projectile = false,
  ) => {
    const key = combatEffects.get(id)?.key;
    if (!key || !scene.textures.exists(key)) return undefined;
    const atlas = scene.cache.json.get(key) as PixelFxAtlas | undefined;
    if (!atlas?.frames.length) return undefined;
    const { frameSize, pivot } = atlas.meta.pixelfx;
    const first = projectile ? Math.floor(atlas.frames.length * 0.25) : 0;
    const sprite = scene.add
      .sprite(x, y, key, atlas.frames[first]!.filename)
      .setOrigin(pivot[0] / frameSize[0], pivot[1] / frameSize[1])
      .setScale(projectile ? 0.85 : id === "ice/frost-nova" ? 0.88 : 1.45)
      .setDepth(projectile ? 85 : 87);
    if (projectile || directional.has(id)) sprite.setRotation(angle);
    if (projectile) return sprite;
    if (!scene.anims.exists(key)) {
      scene.anims.create({
        key,
        frames: atlas.frames.map(({ filename }) => ({ key, frame: filename })),
        duration: Math.min(1550, Math.max(380, atlas.frames.length * 16)),
      });
    }
    if (effects.size >= 32) {
      const oldest = effects.values().next().value;
      if (oldest) {
        effects.delete(oldest);
        oldest.destroy();
      }
    }
    effects.add(sprite);
    sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      effects.delete(sprite);
      sprite.destroy();
    });
    sprite.play(key);
    renderedFx++;
    lastFx = id;
    seenEffects.add(id);
    return sprite;
  };

  const play = (event: CombatEvent) => {
    if (event.id <= lastEvent) return;
    lastEvent = event.id;
    if (event.fx && event.kind !== "projectile")
      effect(event.fx, event.x, event.y, event.angle);
    if (event.kind !== "damage" && event.kind !== "heal") return;
    if (event.kind === "damage" && event.target)
      recentHits.set(event.target, scene.time.now + 130);
    if (floats.size >= 26) return;
    const healing = event.kind === "heal";
    const message = scene.add
      .text(event.x, event.y - 27, (healing ? "+" : "−") + event.amount, {
        fontFamily: "monospace",
        fontSize: "12px",
        fontStyle: "bold",
        color: healing ? "#9ffbb9" : "#ffe4b1",
        stroke: "#160f23",
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(93);
    floats.add(message);
    scene.tweens.add({
      targets: message,
      y: message.y - 18,
      alpha: 0,
      duration: 720,
      onComplete: () => {
        floats.delete(message);
        message.destroy();
      },
    });
  };

  const ability = (slot: AbilitySlot, pointer: Phaser.Input.Pointer) => {
    const target = camera.getWorldPoint(pointer.x, pointer.y);
    party.cast(slot, target.x, target.y);
  };
  const pointerDown = (pointer: Phaser.Input.Pointer) => {
    if (pointer.button === 0) ability("BASIC", pointer);
  };
  scene.input.on("pointerdown", pointerDown);
  const keyboard = scene.input.keyboard!;
  const actions = [
    ["Q", () => ability("SKILL_1", scene.input.activePointer)],
    ["E", () => ability("SKILL_2", scene.input.activePointer)],
    ["R", () => ability("SKILL_3", scene.input.activePointer)],
    ["F", () => ability("ULTIMATE", scene.input.activePointer)],
    ["G", () => party.interact()],
  ] as const;
  for (const [key, action] of actions) keyboard.on("keydown-" + key, action);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.input.off("pointerdown", pointerDown);
    for (const [key, action] of actions) keyboard.off("keydown-" + key, action);
  });

  function healthBar(
    x: number,
    y: number,
    width: number,
    ratio: number,
    color: number,
  ) {
    bars
      .fillStyle(0x1b1326, 0.94)
      .fillRect(x - width / 2 - 1, y - 1, width + 2, 5);
    bars.fillStyle(color, 1).fillRect(x - width / 2, y, width * ratio, 3);
  }

  return {
    sample: () => ({
      renderedFx,
      lastFx,
      seenEffects: [...seenEffects],
      aim: camera.getWorldPoint(
        scene.input.activePointer.x,
        scene.input.activePointer.y,
      ),
    }),
    step(delta: number) {
      const world = party.world;
      if (!world?.combat) return;
      for (const event of party.combatEvents) play(event);
      const data = world.combat;
      const mix = 1 - Math.exp(-delta / 66);
      warnings.clear();
      bars.clear();
      for (const [id, till] of recentHits)
        if (till <= scene.time.now) recentHits.delete(id);
      data.telegraphs.forEach((warning) => {
        if (!warning.hostile) {
          warnings
            .lineStyle(1, 0xe9c97e, 0.4)
            .strokeCircle(warning.x, warning.y, Math.min(warning.radius, 140));
          return;
        }
        if (warning.width) {
          warnings
            .lineStyle(warning.width, 0x8e275e, 0.3)
            .lineBetween(warning.fromX, warning.fromY, warning.x, warning.y);
          warnings
            .lineStyle(2, 0xff9c9e, 0.88)
            .lineBetween(warning.fromX, warning.fromY, warning.x, warning.y);
        } else {
          warnings
            .fillStyle(0x9e244f, 0.27)
            .fillCircle(warning.x, warning.y, warning.radius);
          warnings
            .lineStyle(2, 0xff929b, 0.95)
            .strokeCircle(warning.x, warning.y, warning.radius);
        }
      });
      for (const [id, sprite] of monsters) {
        if (!data.enemies.has(id)) {
          sprite.destroy();
          monsters.delete(id);
        }
      }
      data.enemies.forEach((enemy, id) => {
        let sprite = monsters.get(id);
        const boss = enemy.kind === "overlord";
        if (!sprite) {
          sprite = scene.add
            .sprite(
              enemy.x,
              enemy.y,
              "combat:" + (enemy.appearance || enemy.kind),
            )
            .setOrigin(0.5, 0.91)
            .setScale(boss ? 1.85 : enemy.kind === "servant" ? 0.8 : 1);
          if (enemy.kind === "illusion") sprite.setAlpha(0.6);
          monsters.set(id, sprite);
        }
        const moved = Math.hypot(enemy.x - sprite.x, enemy.y - sprite.y);
        const smoothing = moved > 90 ? 1 : mix;
        sprite.x += (enemy.x - sprite.x) * smoothing;
        sprite.y += (enemy.y - sprite.y) * smoothing;
        const walk = enemy.moving && Math.floor(scene.time.now / 135) % 2;
        sprite.setFrame(
          (facingRows[enemy.facing] ?? 0) * 2 + Number(walk || 0),
        );
        sprite.setDepth(depthAt(sprite.y));
        if (recentHits.has(id)) sprite.setTintFill(0xffe5dc);
        else if (enemy.statuses.includes("Frozen")) sprite.setTint(0x96dbff);
        else sprite.clearTint();
        healthBar(
          sprite.x,
          sprite.y - (boss ? 81 : 47),
          boss ? 74 : 32,
          enemy.hp / enemy.maxHp,
          boss ? 0xc668c7 : 0xdc6b85,
        );
      });
      for (const [id, shot] of shots) {
        if (!data.projectiles.has(id)) {
          shot.destroy();
          shots.delete(id);
        }
      }
      data.projectiles.forEach((projectile, id) => {
        let sprite = shots.get(id);
        if (!sprite) {
          sprite = effect(
            projectile.fx,
            projectile.x,
            projectile.y,
            projectile.angle,
            true,
          );
          if (sprite) {
            shots.set(id, sprite);
            renderedFx++;
            lastFx = projectile.fx;
            seenEffects.add(projectile.fx);
          }
        }
        sprite?.setPosition(projectile.x, projectile.y - 12);
        bars
          .fillStyle(projectile.hostile ? 0xfb7bab : 0xffc280, 0.86)
          .fillCircle(projectile.x, projectile.y - 10, 2);
      });
      const localId = party.getSnapshot().playerId;
      world.players.forEach((player, id) => {
        if (player.life === "DEAD" || !player.maxHp) return;
        if (recentHits.has(id))
          bars.fillStyle(0xee6963, 0.4).fillCircle(player.x, player.y - 12, 12);
        if (id !== localId || player.hp < player.maxHp)
          healthBar(
            player.x,
            player.y - 48,
            23,
            player.hp / player.maxHp,
            0x83d5a5,
          );
      });
      warnings
        .lineStyle(2, data.gateOpen ? 0xc891ff : 0x625176, 0.9)
        .strokeEllipse(gate.x, gate.y, 37, 23);
      if (data.gateOpen && !data.phase)
        warnings.fillStyle(0x8e55da, 0.22).fillEllipse(gate.x, gate.y, 36, 22);
    },
  };
}
