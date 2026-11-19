import Phaser from "phaser";
import { preloadFrostNova } from "../effects/frostNova";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("boot");
  }

  preload() {
    preloadFrostNova(this);
  }

  create() {
    this.scene.start("playground");
  }
}
