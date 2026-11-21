import { useEffect, useRef } from "react";
import type Phaser from "phaser";

interface PhaserStage {
  isActive: () => boolean;
  onDispose: () => void;
}

export function usePhaserStage(
  load: (
    isActive: PhaserStage["isActive"],
  ) => Promise<(parent: HTMLElement) => Phaser.Game>,
  onError: (error: unknown) => void,
  onDispose?: PhaserStage["onDispose"],
) {
  const parent = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const abort = new AbortController();
    let active = true;
    let frame = 0;
    let game: Phaser.Game | undefined;

    const fail = (error: unknown) => {
      if (active) onError(error);
    };
    void load(() => active)
      .then((create) => {
        if (!active) return;
        // Defer startup until the mount survives Strict Mode's effect replay.
        frame = requestAnimationFrame(() => {
          if (!active || !parent.current) return;
          try {
            game = create(parent.current);
            parent.current.addEventListener(
              "webglcontextlost",
              () => fail(new Error("Graphics context lost.")),
              { once: true, capture: true, signal: abort.signal },
            );
          } catch (error) {
            fail(error);
          }
        });
      })
      .catch(fail);

    return () => {
      abort.abort();
      active = false;
      cancelAnimationFrame(frame);
      onDispose?.();
      game?.destroy(true);
    };
  }, [load, onDispose, onError]);

  return parent;
}
