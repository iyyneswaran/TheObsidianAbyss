import { useEffect, useRef, useState } from "react";
import type Phaser from "phaser";

export function PhaserPlayground() {
  const parent = useRef<HTMLDivElement>(null);
  const play = useRef<(() => void) | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "unavailable">(
    "loading",
  );

  useEffect(() => {
    let active = true;
    let frame = 0;
    let game: Phaser.Game | undefined;

    void import("../game/config/createGame")
      .then(({ createGame }) => {
        if (!active) return;

        // Defer startup until the mount survives Strict Mode's effect replay.
        frame = requestAnimationFrame(() => {
          if (!parent.current) return;
          game = createGame(parent.current, (trigger) => {
            if (!active) return;
            play.current = trigger;
            setStatus(trigger ? "ready" : "unavailable");
          });
        });
      })
      .catch(() => {
        if (active) setStatus("unavailable");
      });

    return () => {
      active = false;
      cancelAnimationFrame(frame);
      play.current = null;
      game?.destroy(true);
    };
  }, []);

  return (
    <section aria-label="Effects preview" className="space-y-4">
      <div
        ref={parent}
        className="aspect-video w-full overflow-hidden rounded-lg border border-gold/50 bg-[#101022]"
        data-testid="game-stage"
      />
      <button
        className="action"
        disabled={status !== "ready"}
        onClick={() => play.current?.()}
      >
        Play Frost Nova
      </button>
      {status === "unavailable" && (
        <p role="alert">Frost Nova could not load.</p>
      )}
    </section>
  );
}
