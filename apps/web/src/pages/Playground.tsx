import { Link } from "react-router-dom";
import { PhaserPlayground } from "../components/PhaserPlayground";
import { useTestRoom } from "../hooks/useTestRoom";

const statusText = {
  idle: "Ready to connect",
  connecting: "Connecting…",
  connected: "Connected to test room",
  disconnecting: "Disconnecting…",
  disconnected: "Disconnected",
  error: "Connection error",
};

export function Playground() {
  const { status, connect, disconnect } = useTestRoom();
  const canConnect =
    status.kind === "idle" ||
    status.kind === "disconnected" ||
    status.kind === "error";

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-6 py-8">
      <header>
        <Link
          className="text-sm text-iris underline-offset-4 hover:underline"
          to="/"
        >
          The Obsidian Abyss
        </Link>
        <h1 className="mt-2 font-serif text-4xl font-semibold">Playground</h1>
      </header>
      <PhaserPlayground />
      <section
        aria-labelledby="connection-heading"
        className="space-y-3 rounded-lg border border-gold/50 bg-panel p-4"
      >
        <h2 id="connection-heading" className="font-semibold text-iris">
          Test room
        </h2>
        <p role="status">
          {status.kind === "error" ? status.message : statusText[status.kind]}
        </p>
        {status.kind === "connected" && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 text-sm">
            <dt>Room ID</dt>
            <dd className="font-mono">{status.roomId}</dd>
            <dt>Session ID</dt>
            <dd className="font-mono">{status.sessionId}</dd>
          </dl>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            className="action"
            disabled={!canConnect}
            onClick={() => void connect()}
          >
            Connect
          </button>
          <button
            className="action"
            disabled={status.kind !== "connected"}
            onClick={() => void disconnect()}
          >
            Disconnect
          </button>
        </div>
      </section>
    </main>
  );
}
