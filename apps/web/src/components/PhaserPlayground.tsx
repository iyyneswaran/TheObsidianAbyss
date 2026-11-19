import { useCallback, useRef, useState } from "react";
import { usePhaserStage } from "../hooks/usePhaserStage";

export function PhaserPlayground() {
  const play = useRef<(() => void) | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "unavailable">(
    "loading",
  );
  const load = useCallback(async (isActive: () => boolean) => {
    const { createGame } = await import("../game/config/createGame");
    return (parent: HTMLElement) =>
      createGame(parent, (trigger) => {
        if (!isActive()) return;
        play.current = trigger;
        setStatus(trigger ? "ready" : "unavailable");
      });
  }, []);
  const fail = useCallback(() => setStatus("unavailable"), []);
  const dispose = useCallback(() => {
    play.current = null;
  }, []);
  const parent = usePhaserStage(load, fail, dispose);

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
