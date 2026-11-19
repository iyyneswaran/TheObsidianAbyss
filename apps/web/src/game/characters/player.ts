import type Phaser from "phaser";
import {
  hasWizardFrames,
  wizardAnimationKey,
  wizardAnimations,
  wizardDirections,
  wizardSheet,
  type WizardClass,
  type WizardMotion,
} from "@obsidian/game-assets";
import {
  movePlayer,
  resolvePlayerSpawn,
  type DungeonMap,
  type WorldPoint,
} from "@obsidian/game-core";

export function preloadWizard(scene: Phaser.Scene, wizard: WizardClass) {
  scene.load.spritesheet(
    wizard.spriteKey,
    import.meta.env.BASE_URL + wizard.spritePath,
    wizardSheet,
  );
}

export function createPlayer(
  scene: Phaser.Scene,
  map: DungeonMap,
  wizard: WizardClass,
  depthAt: (y: number) => number,
) {
  let transform = resolvePlayerSpawn(map);
  const texture = scene.textures.get(wizard.spriteKey);
  if (
    !scene.textures.exists(wizard.spriteKey) ||
    !hasWizardFrames((frame) => texture.has(frame))
  ) {
    throw new Error(
      `The ${wizard.name} sprite sheet is missing or incomplete.`,
    );
  }

  const registered: string[] = [];
  for (const [row, direction] of wizardDirections.entries()) {
    for (const motion of ["idle", "walk"] as const) {
      const { frames, frameRate } = wizardAnimations[motion];
      const key = wizardAnimationKey(wizard, motion, direction);
      scene.anims.create({
        key,
        frameRate,
        repeat: -1,
        frames: frames.map((column) => ({
          key: wizard.spriteKey,
          frame: row * wizardSheet.columns + column,
        })),
      });
      registered.push(key);
    }
  }
  scene.events.once("shutdown", () => {
    for (const key of registered) scene.anims.remove(key);
  });

  const sprite = scene.add
    .sprite(transform.x, transform.y, wizard.spriteKey)
    .setOrigin(
      wizardSheet.feetX / wizardSheet.frameWidth,
      wizardSheet.feetY / wizardSheet.frameHeight,
    )
    .setDepth(depthAt(transform.y));
  const shadow = scene.add
    .ellipse(transform.x, transform.y + 1, 20, 6, 0x100d1b, 0.65)
    .setDepth(35);

  function render() {
    const { x, y, facing, moving } = transform;
    const motion: WizardMotion = moving ? "walk" : "idle";
    const key = wizardAnimationKey(wizard, motion, facing);
    if (sprite.anims.currentAnim?.key !== key) sprite.play(key);
    sprite.setPosition(x, y);
    const depth = depthAt(y);
    if (depth !== sprite.depth) sprite.setDepth(depth);
    shadow.setPosition(x, y + 1);
  }

  render();

  return {
    get transform() {
      return transform;
    },
    get animation() {
      return sprite.anims.currentAnim?.key ?? "";
    },
    get frame() {
      return sprite.frame.name;
    },
    step(input: WorldPoint, elapsed: number) {
      transform = movePlayer(map, transform, input, elapsed);
      render();
    },
  };
}

export type DungeonPlayer = ReturnType<typeof createPlayer>;
