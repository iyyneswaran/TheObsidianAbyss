import Phaser from "phaser";
import { createFrostNova, frostNova } from "../effects/frostNova";

export class PlaygroundScene extends Phaser.Scene {
  constructor(private readonly onReady: (play: (() => void) | null) => void) {
    super("playground");
  }

  create() {
    const { width, height } = this.scale.gameSize;
    const x = width / 2;
    const y = height / 2 + 28;

    this.add.ellipse(x, y, 156, 52, 0x24203a).setStrokeStyle(1, 0x534963);
    this.add.ellipse(x, y, 102, 32).setStrokeStyle(1, 0x534963);
    this.add.rectangle(x, y, 7, 7, 0xaa9262).setRotation(Math.PI / 4);

    const effect = createFrostNova(this, x, y);
    this.onReady(
      effect
        ? () => {
            effect.setVisible(true);
            effect.play(frostNova.key);
          }
        : null,
    );
  }
}
