import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { wizards, type WizardClassId } from "@obsidian/game-assets";
import { api } from "./api";
import {
  Feedback,
  PageShell,
  panel,
  field,
  usePageData,
  WalletBadges,
  type Balance,
} from "./common";

interface PlayerStats {
  displayName: string;
  permanent: boolean;
  createdAt: string;
  xp: number;
  level: number;
  levelXp: number;
  levelTarget: number;
  wizard: string;
  victories: number;
  defeats: number;
  monsters: number;
  damage: string;
  healing: string;
  mitigation: string;
  wallet: Balance;
}
interface History extends Balance {
  ledger: {
    id: string;
    currency: "COINS" | "GEMS";
    amount: number;
    reason: string;
  }[];
  runs: {
    runId: string;
    coins: number;
    gems: number;
    xp: number;
    run: { outcome: string };
  }[];
}

export function AccountForm({ mode }: { mode: "login" | "register" }) {
  const registering = mode === "register";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      await api("/auth/" + mode, {
        username: fields.get("username"),
        password: fields.get("password"),
      });
      navigate("/profile", { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to sign in.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <PageShell
      title={registering ? "Create an account" : "Sign in"}
      detail={
        registering
          ? "Keep your wizard and earned rewards across devices."
          : "Return to your wizard and persistent progression."
      }
    >
      <form
        className={panel + " max-w-lg space-y-4"}
        onSubmit={(event) => void submit(event)}
      >
        <label className="block text-sm">
          Username
          <input
            name="username"
            autoComplete="username"
            minLength={3}
            maxLength={24}
            required
            className={field}
          />
        </label>
        <label className="block text-sm">
          Password
          <input
            type="password"
            name="password"
            autoComplete={registering ? "new-password" : "current-password"}
            minLength={registering ? 12 : 1}
            maxLength={128}
            required
            className={field}
          />
        </label>
        {registering && (
          <p className="text-xs text-slate-300">
            Use at least 12 characters. A valid guest profile on this browser is
            converted into your account.
          </p>
        )}
        <Feedback error={error} />
        <div className="flex flex-wrap items-center gap-3">
          <button className="action" disabled={busy}>
            {busy ? "Working…" : registering ? "Register" : "Sign in"}
          </button>
          <Link
            className="text-sm text-iris"
            to={registering ? "/login" : "/register"}
          >
            {registering ? "Already have an account?" : "Create an account"}
          </Link>
        </div>
      </form>
    </PageShell>
  );
}

export function Profile() {
  const { data, error, setError } = usePageData<PlayerStats>("/profile");
  const history = usePageData<History>("/wallet");
  const navigate = useNavigate();
  async function logout() {
    try {
      await api("/auth/logout", {});
      navigate("/login", { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sign-out failed.");
    }
  }
  return (
    <PageShell
      title="Wizard Profile"
      detail="Your account, dungeon record, and wallet ledger."
      badge={data?.wallet && <WalletBadges balance={data.wallet} />}
    >
      <Feedback error={error} waiting={!data} />
      {data && (
        <>
          <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
            <section className={panel}>
              <p className="text-xs uppercase tracking-widest text-iris">
                {data.permanent ? "Permanent account" : "Guest profile"}
              </p>
              <h2
                data-testid="profile-name"
                className="mt-2 font-serif text-3xl text-gold"
              >
                {data.displayName}
              </h2>
              <p className="mt-3 text-sm" data-testid="profile-level">
                Level {data.level}
              </p>
              <p className="mt-2 text-sm text-slate-300">
                <span data-testid="profile-xp">{data.xp}</span> total XP
              </p>
              <progress
                className="mt-2 h-2 w-full accent-iris"
                aria-label="Experience toward next level"
                value={data.levelXp}
                max={data.levelTarget}
              />
              <p className="mt-2 text-xs text-slate-300">
                {data.levelXp} / {data.levelTarget} XP to next level
              </p>
              <p className="mt-4 text-sm text-slate-300">
                Wizard · {wizards[data.wizard as WizardClassId]?.name}
              </p>
              <p className="mt-2 text-xs text-slate-400">
                Created {new Date(data.createdAt).toLocaleDateString()}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {data.permanent ? (
                  <button className="action" onClick={() => void logout()}>
                    Sign out
                  </button>
                ) : (
                  <>
                    <Link className="action" to="/register">
                      Create an account
                    </Link>
                    <Link className="action" to="/login">
                      Sign in
                    </Link>
                  </>
                )}
              </div>
              {!data.permanent && (
                <p className="mt-3 text-xs text-slate-300">
                  Guest progression is tied to this browser. Register to recover
                  it across devices.
                </p>
              )}
            </section>
            <section className={panel}>
              <h2 className="font-serif text-2xl text-[#f1e2cd]">
                Dungeon record
              </h2>
              <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {Object.entries({
                  Victories: data.victories,
                  Defeats: data.defeats,
                  "Monsters defeated": data.monsters,
                  "Damage dealt": data.damage,
                  "HP healed": data.healing,
                  "Damage prevented": data.mitigation,
                }).map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded border border-iris/20 bg-[#16142a] p-3"
                  >
                    <dt className="text-xs text-slate-300">{label}</dt>
                    <dd className="mt-1 text-lg font-semibold text-iris">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
              {history.data?.runs.map(({ runId, run, coins, gems, xp }) => (
                <p
                  data-testid="run-history"
                  data-run-id={runId}
                  key={runId}
                  className="mt-3 border-t border-iris/20 pt-2 text-sm"
                >
                  {run.outcome === "VICTORY" ? "Victory" : "Defeat"} · {coins}{" "}
                  coins · {gems} gems · {xp} XP
                </p>
              ))}
            </section>
          </div>
          <section className={panel + " mt-4"}>
            <h2 className="font-serif text-2xl text-[#f1e2cd]">
              Wallet activity
            </h2>
            {history.data?.ledger.length ? (
              <ul className="mt-2 divide-y divide-iris/15">
                {history.data.ledger.map((entry) => (
                  <li
                    key={entry.id}
                    className="flex justify-between gap-3 py-2 text-sm"
                  >
                    <span>
                      {entry.reason.replaceAll("_", " ").toLowerCase()}
                    </span>
                    <span className="font-semibold text-gold">
                      {entry.amount > 0 && "+"}
                      {entry.amount} {entry.currency.toLowerCase()}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-slate-300">
                No wallet activity yet.
              </p>
            )}
          </section>
        </>
      )}
    </PageShell>
  );
}
