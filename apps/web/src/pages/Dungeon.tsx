import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import type { DungeonDebugInfo, DungeonPreview } from "../game/dungeon/preview";
import { usePhaserStage } from "../hooks/usePhaserStage";

export function Dungeon() {
  const [preview, setPreview] = useState<DungeonPreview>();
  const [debug, setDebug] = useState<DungeonDebugInfo | null>(null);
  const [error, setError] = useState(false);
  const fail = useCallback(() => setError(true), []);

  const load = useCallback(
    async (isActive: () => boolean) => {
      const { createDungeonGame } =
        await import("../game/config/createDungeonGame");
      return (parent: HTMLElement) =>
        createDungeonGame(parent, {
          onReady(data) {
            if (isActive()) setPreview(data);
          },
          onError() {
            if (isActive()) fail();
          },
          onDebug(info) {
            if (isActive()) setDebug(info);
          },
        });
    },
    [fail],
  );
  const parent = usePhaserStage(load, fail);

  return (
    <main className="mx-auto max-w-[1330px] px-5 py-7 sm:px-6">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link
            className="text-sm text-iris underline-offset-4 hover:underline"
            to="/"
          >
            The Obsidian Abyss
          </Link>
          <h1 className="mt-2 font-serif text-4xl font-semibold sm:text-5xl">
            Dungeon preview
          </h1>
        </div>
        <Link className="action" to="/playground">
          Open playground
        </Link>
      </header>
      <div className="overflow-hidden rounded-lg border border-gold/40 bg-[#151020]">
        <nav
          aria-label="Dungeon rooms"
          className="flex min-h-14 flex-wrap items-center gap-2 border-b border-gold/25 bg-panel/80 px-3 py-2"
        >
          {preview?.rooms.map(({ id, title }) => (
            <button
              className="action"
              key={id}
              onClick={() => preview.focusRoom(id)}
            >
              {title}
            </button>
          ))}
          {!preview && !error && (
            <p role="status" className="px-1 text-sm text-slate-300">
              Loading dungeon…
            </p>
          )}
          {error && (
            <p role="alert" className="px-1 text-sm text-rose-200">
              The dungeon could not load. Reload this page to try again.
            </p>
          )}
        </nav>
        <div
          className="aspect-video w-full overflow-hidden bg-[#130e1c]"
          aria-label="Dungeon map"
          ref={parent}
          data-testid="dungeon-stage"
        />
        <p className="border-t border-gold/25 bg-panel/80 px-4 py-3 text-sm text-slate-300">
          <kbd>WASD</kbd> or <kbd>arrows</kbd> to pan{" "}
          <span aria-hidden="true">·</span> Scroll over the map to zoom{" "}
          <span aria-hidden="true">·</span> <kbd>R</kbd> to reset
          {import.meta.env.DEV && (
            <>
              {" "}
              <span aria-hidden="true">·</span> <kbd>F3</kbd> for debug
            </>
          )}
        </p>
      </div>
      {import.meta.env.DEV && debug && (
        <section
          className="mt-4 rounded-md border border-iris/35 bg-panel px-4 py-3 font-mono text-xs"
          aria-label="Dungeon debug"
        >
          <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-[auto_1fr_auto_1fr]">
            <dt>Camera center</dt>
            <dd data-testid="camera-center">
              {debug.cameraX}, {debug.cameraY}
            </dd>
            <dt>Zoom</dt>
            <dd data-testid="camera-zoom">{debug.zoom}×</dd>
            <dt>World</dt>
            <dd>
              {debug.worldWidth} × {debug.worldHeight} px
            </dd>
            <dt>Room</dt>
            <dd data-testid="camera-room">{debug.room}</dd>
            <dt>Pointer tile</dt>
            <dd>{debug.tile}</dd>
            <dt>Terrain</dt>
            <dd>{debug.terrain}</dd>
            <dt>Zones</dt>
            <dd className="break-words sm:col-span-3">{debug.zones}</dd>
          </dl>
          <p className="mt-2 text-slate-300">
            Pink solid · Orange lava · Gold bridge · Cyan shrine · Green spawn ·
            Magenta patrol
          </p>
        </section>
      )}
    </main>
  );
}
