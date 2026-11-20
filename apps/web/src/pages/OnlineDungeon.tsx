import { useCallback, useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { ExpeditionMap } from "../components/ExpeditionMap";
import { PartyConfirm } from "../components/PartyConfirm";
import { CombatHud, RunSummary } from "../components/CombatHud";
import { PartyRoster } from "../components/PartyRoster";
import type { DungeonDebugInfo } from "../game/dungeon/preview";
import { usePhaserStage } from "../hooks/usePhaserStage";
import { party } from "../multiplayer/party";
import { useParty } from "../multiplayer/useParty";

const labels = {
  idle: "Waiting for team",
  connecting: "Connecting",
  connected: "Connected",
  recovering: "Reconnecting",
  disconnected: "Disconnected",
};

function OnlineStage() {
  const { exploration } = useParty();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [debug, setDebug] = useState<DungeonDebugInfo | null>(null);
  const fail = useCallback(() => setError(true), []);
  const load = useCallback(
    async (isActive: () => boolean) => {
      const { createDungeonGame } =
        await import("../game/config/createDungeonGame");
      return (parent: HTMLElement) =>
        createDungeonGame(
          parent,
          {
            onReady() {
              if (isActive()) setReady(true);
            },
            onError() {
              if (isActive()) fail();
            },
            onDebug(info) {
              if (isActive()) setDebug(info);
            },
          },
          undefined,
          party,
        );
    },
    [fail],
  );
  const parent = usePhaserStage(load, fail);

  return (
    <>
      {!ready && !error && (
        <p className="mt-3 text-sm text-slate-300">Loading the dungeon…</p>
      )}
      {error && (
        <p role="alert" className="mt-3 text-rose-200">
          The dungeon could not load. Reopen this page to reconnect.
        </p>
      )}
      <div className="relative mt-5 overflow-hidden rounded-xl border border-gold/40 bg-[#130e1c]">
        <div
          ref={parent}
          className="aspect-video w-full"
          data-testid="online-stage"
          data-ready={ready}
          aria-label="Online dungeon map"
        />
        {exploration && <ExpeditionMap exploration={exploration} />}
        <p className="border-t border-gold/25 bg-panel px-4 py-3 text-sm text-slate-300">
          WASD or arrows to move · Left click to attack · Q / E / R / F to cast
          · G to interact · Scroll to zoom
          {import.meta.env.DEV && " · F3 for debug"}
        </p>
      </div>
      {import.meta.env.DEV && debug?.online && <OnlineDebug info={debug} />}
    </>
  );
}

function OnlineDebug({ info }: { info: DungeonDebugInfo }) {
  const online = info.online!;
  const connected = online.actors.filter(
    ({ connection }) => connection === "CONNECTED",
  ).length;
  return (
    <section
      aria-label="Multiplayer debug"
      className="my-4 overflow-x-auto rounded-lg border border-iris/30 bg-panel p-4 font-mono text-xs"
    >
      <p className="mb-2">
        Team {online.code} · Room{" "}
        <span data-testid="debug-room-id">{online.roomId}</span>
      </p>
      <p className="mb-2">
        Local player <span data-testid="debug-local-id">{online.localId}</span>{" "}
        · {connected} connected · {online.actors.length - connected}{" "}
        disconnected
      </p>
      <p
        className="mb-3"
        data-testid="combat-camera"
        data-x={info.cameraX}
        data-y={info.cameraY}
        data-zoom={info.zoom}
      >
        Tick <span data-testid="debug-tick">{online.tick}</span> ·{" "}
        <span data-testid="debug-rate">{online.rate}</span> patches/s · Camera{" "}
        {info.cameraX}, {info.cameraY} · {info.zoom}×
      </p>
      <table className="w-full min-w-3xl text-left">
        <thead>
          <tr>
            <th>Actor</th>
            <th>Class</th>
            <th>Authoritative</th>
            <th>Rendered</th>
            <th>Connection</th>
            <th>Ack</th>
            <th>Animation</th>
            <th>Room and zones</th>
            <th>Hazard</th>
          </tr>
        </thead>
        <tbody>
          {online.actors.map((actor) => (
            <tr
              key={actor.id}
              className="border-t border-iris/15"
              data-testid="online-actor"
              data-player-id={actor.id}
            >
              <td className="py-2">{actor.name}</td>
              <td data-testid="actor-wizard">{actor.wizard}</td>
              <td data-testid="actor-position">
                {actor.authoritative.x.toFixed(1)},{" "}
                {actor.authoritative.y.toFixed(1)}
              </td>
              <td data-testid="actor-rendered">
                {actor.rendered.x.toFixed(1)}, {actor.rendered.y.toFixed(1)}
              </td>
              <td data-testid="actor-connection">{actor.connection}</td>
              <td data-testid="actor-ack">{actor.acknowledged}</td>
              <td data-testid="actor-animation">{actor.animation}</td>
              <td data-testid="actor-zones">{actor.zones}</td>
              <td>{actor.hazardous ? "Lava" : "Safe"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {online.combat && (
        <div className="mt-3">
          <p
            data-testid="combat-aim"
            data-x={online.combat.aim.x}
            data-y={online.combat.aim.y}
          >
            Aim {online.combat.aim.x.toFixed(0)},{" "}
            {online.combat.aim.y.toFixed(0)}
          </p>
          <p
            data-testid="combat-fx"
            data-count={online.combat.renderedFx}
            data-rendered={online.combat.seenEffects.join(" ")}
          >
            {online.combat.lastFx}
          </p>
          <p>Projectiles {online.combat.projectiles}</p>
          {online.combat.targets.map((enemy) => (
            <p
              key={enemy.id}
              data-testid="combat-enemy"
              data-id={enemy.id}
              data-kind={enemy.kind}
              data-appearance={enemy.appearance}
              data-x={enemy.x}
              data-y={enemy.y}
              data-hp={enemy.hp}
              data-max={enemy.maxHp}
              data-status={enemy.statuses}
              data-target={enemy.target}
            >
              {enemy.kind} · {enemy.hp}/{enemy.maxHp} HP · {enemy.action}{" "}
              {enemy.statuses} · target {enemy.target || "—"}
            </p>
          ))}
        </div>
      )}
    </section>
  );
}

export function OnlineDungeon() {
  const session = useParty();
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState(false);
  const [watch, setWatch] = useState("");
  const code = session.code || party.rememberedCode;
  useEffect(() => party.restore(), []);

  if (!code && session.connection === "idle")
    return <Navigate to="/party" replace />;
  if (session.phase === "LOBBY") return <Navigate to="/party" replace />;
  return (
    <main className="mx-auto max-w-[1330px] px-5 py-6 sm:px-6">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-iris">
            Team{" "}
            <span className="font-mono font-semibold" data-testid="online-code">
              {code}
            </span>
          </p>
          <h1 className="mt-1 font-serif text-4xl sm:text-5xl">
            Co-op dungeon
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <p role="status" className="text-sm" data-testid="network-status">
            {labels[session.connection]}
          </p>
          {session.phase === "ACTIVE" && (
            <button
              className="action"
              disabled={session.connection !== "connected"}
              onClick={() => setConfirm(true)}
            >
              Leave Session
            </button>
          )}
        </div>
      </header>
      {session.error && (
        <p role="alert" className="mb-3 text-sm text-rose-200">
          {session.error}
        </p>
      )}
      {session.connection === "disconnected" && (
        <div className="mb-3 flex gap-2">
          <button
            className="action"
            onClick={() => void party.connect({ action: "reconnect", code })}
          >
            Reconnect
          </button>
          <Link className="action" to="/">
            Back to home
          </Link>
        </div>
      )}
      {session.members.length > 0 && <PartyRoster session={session} />}
      {session.result && (
        <RunSummary
          settlement={session.settlement}
          result={session.result}
          onReturn={() => {
            void party.leave(true);
            navigate("/party", { replace: true });
          }}
        />
      )}
      {session.phase === "ACTIVE" && (
        <CombatHud
          session={session}
          watch={watch}
          onWatch={(id) => {
            party.spectatorId = id;
            setWatch(id);
          }}
        />
      )}
      {(session.phase === "ACTIVE" || session.result) && <OnlineStage />}
      {confirm && (
        <PartyConfirm
          title="Leave the dungeon?"
          detail="Leaving releases your wizard from this run. You can form another team from the lobby."
          confirm="Leave Session"
          onCancel={() => setConfirm(false)}
          onConfirm={() => {
            void party.leave(true);
            navigate("/party", { replace: true });
          }}
        />
      )}
    </main>
  );
}
