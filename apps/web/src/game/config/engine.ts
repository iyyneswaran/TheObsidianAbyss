import Phaser from "phaser";
import { gameViewport } from "@obsidian/game-core";

// Phaser 3.90 does not detach its document visibility callback or canvas wheel listener.
class RouteGame extends Phaser.Game {
  protected override start() {
    const add = document.addEventListener;
    const ownAdd = Object.getOwnPropertyDescriptor(
      document,
      "addEventListener",
    );
    const previousBlur = window.onblur;
    const previousFocus = window.onfocus;
    const removeVisibility: (() => void)[] = [];

    document.addEventListener = (
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | AddEventListenerOptions,
    ) => {
      add.call(document, type, listener, options);
      if (/^(webkit|moz|ms)?visibilitychange$/.test(type)) {
        removeVisibility.push(() =>
          document.removeEventListener(type, listener, options),
        );
      }
    };
    try {
      super.start();
    } finally {
      if (ownAdd) Object.defineProperty(document, "addEventListener", ownAdd);
      else Reflect.deleteProperty(document, "addEventListener");
    }

    const blur = window.onblur;
    const focus = window.onfocus;
    const wheelTarget = this.input.mouse?.target;
    const wheel = this.input.mouse?.onMouseWheel as EventListener | undefined;
    this.events.once(Phaser.Core.Events.DESTROY, () => {
      for (const remove of removeVisibility) remove();
      if (window.onblur === blur) window.onblur = previousBlur;
      if (window.onfocus === focus) window.onfocus = previousFocus;
      if (wheel && wheelTarget instanceof EventTarget)
        wheelTarget.removeEventListener("wheel", wheel);
    });
  }
}

export function createPhaserGame(
  parent: HTMLElement,
  scene: Phaser.Types.Scenes.SceneType[],
  options: Pick<Phaser.Types.Core.GameConfig, "backgroundColor" | "input"> = {},
) {
  return new RouteGame({
    type: Phaser.AUTO,
    parent,
    backgroundColor: "#101022",
    ...options,
    pixelArt: true,
    roundPixels: true,
    banner: false,
    audio: { noAudio: true },
    scale: {
      ...gameViewport,
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene,
  });
}
