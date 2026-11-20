import { useEffect, useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { findWizard, wizards } from "@obsidian/game-assets";
import { needsIncompleteConfirmation, PARTY_SIZE } from "@obsidian/shared/coop";
import { PartyConfirm } from "../components/PartyConfirm";
import { PartyRoster } from "../components/PartyRoster";
import { readWizardSelection } from "../game/characters/selection";
import { party } from "../multiplayer/party";
import { useParty } from "../multiplayer/useParty";

export function Party() {
  const website = useLocation();
  const session = useParty();
  const [wizard, setWizard] = useState(() =>
    readWizardSelection(website.state),
  );
  const [code, setCode] = useState(() => party.rememberedCode);
  const [dungeon, setDungeon] = useState<"classic" | "expedition">(
    "expedition",
  );
  const [confirm, setConfirm] = useState(false);
  const [copied, setCopied] = useState(false);
  const busy =
    session.connection === "connecting" || session.connection === "recovering";
  const connected = session.members.filter(
    (member) => member.connection === "CONNECTED",
  ).length;
  const own = session.members.find((member) => member.id === session.playerId);
  useEffect(() => party.restore(), []);

  if (session.phase === "ACTIVE" || session.result)
    return <Navigate to="/dungeon/online" replace />;
  return (
    <main className="mx-auto max-w-5xl px-5 py-8 sm:px-8">
      <Link className="text-sm text-iris hover:underline" to="/">
        The Obsidian Abyss
      </Link>
      <h1 className="mb-6 mt-2 font-serif text-4xl sm:text-5xl">
        Private teams
      </h1>
      {session.error && (
        <p
          className="mb-5 rounded border border-rose-500/50 bg-rose-950/30 p-3 text-sm text-rose-200"
          role="alert"
        >
          {session.error}
        </p>
      )}
      {busy && (
        <p className="mb-5 text-sm text-iris" role="status">
          {session.connection === "recovering"
            ? "Reconnecting…"
            : "Connecting…"}
        </p>
      )}
      {session.code && own ? (
        <section className="space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-3 rounded-xl border border-gold/40 bg-panel p-5">
            <div>
              <h2 className="text-sm text-slate-300">Team code</h2>
              <p
                className="font-mono text-3xl font-semibold tracking-[0.25em] text-[#ffdc9c]"
                data-testid="team-code"
              >
                {session.code}
              </p>
            </div>
            <button
              className="action"
              onClick={() =>
                void navigator.clipboard
                  .writeText(session.code)
                  .then(() => setCopied(true))
                  .catch(() => setCopied(false))
              }
            >
              {copied ? "Copied" : "Copy code"}
            </button>
          </div>
          <p data-testid="party-count" className="text-sm text-slate-300">
            {connected} of {PARTY_SIZE} connected
          </p>
          <PartyRoster session={session} />
          <div className="flex flex-wrap items-end justify-between gap-3">
            <label className="grid gap-2 text-sm">
              Your wizard
              <select
                className="rounded border border-gold/40 bg-panel p-2"
                value={own.wizard}
                disabled={
                  session.phase !== "LOBBY" ||
                  session.connection !== "connected"
                }
                onChange={(event) => {
                  const selected = findWizard(event.target.value);
                  if (selected)
                    party.command("wizard", { wizard: selected.id });
                }}
              >
                {Object.values(wizards).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-wrap gap-2">
              {session.leaderId === session.playerId &&
                session.phase === "LOBBY" && (
                  <button
                    className="action"
                    disabled={session.connection !== "connected"}
                    onClick={() =>
                      needsIncompleteConfirmation(connected)
                        ? setConfirm(true)
                        : party.command("start", { confirmIncomplete: false })
                    }
                  >
                    Start Dungeon
                  </button>
                )}
              {session.connection === "disconnected" && (
                <button
                  className="action"
                  onClick={() =>
                    void party.connect({
                      action: "reconnect",
                      code: session.code,
                    })
                  }
                >
                  Reconnect
                </button>
              )}
              <button
                className="action"
                disabled={session.connection !== "connected"}
                onClick={() => {
                  setCopied(false);
                  void party.leave(true);
                }}
              >
                Leave Team
              </button>
            </div>
          </div>
          {session.phase === "STARTING" && (
            <p role="status">Opening the dungeon…</p>
          )}
        </section>
      ) : (
        <div className="space-y-5">
          <label className="grid max-w-sm gap-2 text-sm">
            Your wizard
            <select
              className="rounded border border-gold/40 bg-panel p-2"
              value={wizard?.id ?? ""}
              disabled={busy}
              onChange={(event) => setWizard(findWizard(event.target.value))}
            >
              <option value="">Choose a wizard</option>
              {Object.values(wizards).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <section className="rounded-xl border border-gold/40 bg-panel p-5">
              <h2 className="mb-4 font-serif text-2xl">
                Create a private team
              </h2>
              <label className="mb-4 grid gap-1 text-sm">
                Dungeon route
                <select
                  className="rounded border border-gold/40 bg-abyss p-2"
                  value={dungeon}
                  onChange={(e) =>
                    setDungeon(
                      e.target.value === "classic" ? "classic" : "expedition",
                    )
                  }
                >
                  <option value="expedition">Five-zone expedition</option>
                  <option value="classic">Classic dungeon</option>
                </select>
              </label>
              <button
                className="action"
                disabled={!wizard || busy}
                onClick={() => {
                  if (wizard)
                    void party.connect({
                      action: "create",
                      wizard: wizard.id,
                      dungeon,
                    });
                }}
              >
                Create Team
              </button>
            </section>
            <form
              className="rounded-xl border border-gold/40 bg-panel p-5"
              onSubmit={(event) => {
                event.preventDefault();
                if (wizard)
                  void party.connect({
                    action: "join",
                    wizard: wizard.id,
                    code,
                  });
              }}
            >
              <h2 className="mb-4 font-serif text-2xl">Join by code</h2>
              <label className="grid gap-2 text-sm">
                Team code
                <input
                  className="rounded border border-gold/40 bg-abyss px-3 py-2 font-mono uppercase"
                  value={code}
                  disabled={busy}
                  maxLength={6}
                  required
                  autoComplete="off"
                  onChange={(event) =>
                    setCode(event.target.value.toUpperCase())
                  }
                />
              </label>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  className="action"
                  disabled={!wizard || !code.trim() || busy}
                >
                  Join Team
                </button>
                <button
                  className="action"
                  type="button"
                  disabled={!code.trim() || busy}
                  onClick={() =>
                    void party.connect({ action: "reconnect", code })
                  }
                >
                  Reconnect
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {confirm && (
        <PartyConfirm
          title="Incomplete Team"
          detail="Your party has fewer than four wizards. Dungeon difficulty will remain the same, and completing the dungeon may be significantly harder. Are you sure you want to enter?"
          confirm="Enter Dungeon"
          onCancel={() => setConfirm(false)}
          onConfirm={() => {
            setConfirm(false);
            party.command("start", { confirmIncomplete: true });
          }}
        />
      )}
    </main>
  );
}
