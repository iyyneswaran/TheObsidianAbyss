import { useEffect, useState } from "react";
import { wizards, type WizardClassId } from "@obsidian/game-assets";
import { PartyConfirm } from "../components/PartyConfirm";
import { api } from "./api";
import {
  Feedback,
  PageShell,
  panel,
  usePageData,
  WalletBadges,
  type Balance,
} from "./common";

interface Quest {
  id: string;
  title: string;
  detail: string;
  target: number;
  progress: number;
  coins: number;
  end: number;
  status: "In Progress" | "Completed" | "Claimed" | "Expired";
  wizard?: WizardClassId;
}
interface Board {
  now: number;
  daily: Quest[];
  weekly: Quest[];
  past: Quest[];
}

function remaining(ms: number) {
  const mins = Math.max(0, Math.ceil(ms / 60000));
  return `${Math.floor(mins / 1440)}d ${Math.floor((mins % 1440) / 60)}h ${mins % 60}m`;
}

export function Quests() {
  const { data, setData, error, setError } = usePageData<Board>(
    "/quests",
    30000,
  );
  const balance = usePageData<Balance>("/wallet");
  const [claim, setClaim] = useState<Quest>();
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [notice, setNotice] = useState("");
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  async function submit() {
    if (!claim || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await api<{ wallet: Balance; board: Board }>(
        "/quests/claim",
        { instanceId: claim.id },
      );
      setData(result.board);
      balance.setData(result.wallet);
      setNotice(claim.title + " reward collected.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Claim failed.");
    } finally {
      setBusy(false);
      setClaim(undefined);
    }
  }
  function section(title: string, quests: Quest[]) {
    return (
      <section className="mb-6" aria-label={title}>
        <div className="mb-3 flex flex-wrap justify-between gap-2">
          <h2 className="font-serif text-2xl text-gold">{title}</h2>
          {quests[0] && title !== "Previous rotation" && (
            <p className="text-xs text-slate-300">
              Resets in {remaining(quests[0].end - now)} · UTC
            </p>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {quests.map((quest) => (
            <article
              key={quest.id}
              data-testid="quest-card"
              data-quest-id={quest.id}
              data-class={quest.wizard ?? ""}
              className={panel}
            >
              {quest.wizard && (
                <p
                  className="mb-1 text-xs font-semibold text-iris"
                  data-testid="class-quest"
                >
                  {wizards[quest.wizard].name} challenge
                </p>
              )}
              <h3 className="font-serif text-xl text-[#efdfc8]">
                {quest.title}
              </h3>
              <p className="mt-1 min-h-9 text-sm text-slate-300">
                {quest.detail}
              </p>
              <progress
                className="mt-2 h-2 w-full accent-iris"
                aria-label={quest.title + " progress"}
                value={quest.progress}
                max={quest.target}
              />
              <p
                className="mt-1 text-xs text-slate-300"
                data-testid="quest-progress"
              >
                {quest.progress} / {quest.target}
              </p>
              <div className="mt-3 flex items-center justify-between gap-2">
                <span className="text-sm text-gold">◉ {quest.coins} coins</span>
                {quest.status === "Completed" ? (
                  <button className="action" onClick={() => setClaim(quest)}>
                    Claim
                  </button>
                ) : (
                  <span className="text-xs text-slate-300">{quest.status}</span>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>
    );
  }
  return (
    <PageShell
      title="Quest Board"
      detail="Complete dungeon objectives and claim coin rewards. Daily rotations reset at midnight UTC and weekly rotations on Mondays."
      badge={balance.data && <WalletBadges balance={balance.data} />}
    >
      <Feedback error={error} waiting={!data} />
      {notice && (
        <p
          data-testid="quest-claim-status"
          role="status"
          className="mb-3 text-emerald-200"
        >
          {notice}
        </p>
      )}
      {data && (
        <>
          {section("Daily quests", data.daily)}
          {section("Weekly quests", data.weekly)}
          {data.past.length > 0 && section("Previous rotation", data.past)}
        </>
      )}
      {claim && (
        <PartyConfirm
          title={claim.title}
          detail={`Claim ${claim.coins} coins for this completed quest.`}
          confirm={busy ? "Claiming…" : "Claim reward"}
          onCancel={() => {
            if (!busy) setClaim(undefined);
          }}
          onConfirm={() => void submit()}
        />
      )}
    </PageShell>
  );
}
