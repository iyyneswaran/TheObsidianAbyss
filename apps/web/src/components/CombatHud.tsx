import { abilitySlots, loadouts, type RunResult } from "@obsidian/game-core";
import { wizards } from "@obsidian/game-assets";
import type { PartySnapshot } from "../multiplayer/party";

const shortcuts = ["LMB", "Q", "E", "R", "F"];
const bossPhases = ["", "The Watcher", "The Summoner", "Eclipse"];

function Meter({
  label,
  value,
  max,
  tone,
  testId,
}: {
  label: string;
  value: number;
  max: number;
  tone: string;
  testId: string;
}) {
  return (
    <div
      className="min-w-0"
      data-testid={testId}
      data-value={value}
      data-max={max}
    >
      <div className="flex justify-between gap-3 text-xs font-semibold text-slate-200">
        <span>{label}</span>
        <span className="tabular-nums">
          {value} / {max}
        </span>
      </div>
      <div
        className="mt-1 h-1.5 overflow-hidden rounded-full bg-black/50"
        role="meter"
        aria-label={label}
        aria-valuenow={value}
        aria-valuemax={max}
      >
        <div
          className={"h-full rounded-full " + tone}
          style={{ width: (max ? (value / max) * 100 : 0) + "%" }}
        />
      </div>
    </div>
  );
}

export function CombatHud({
  session,
  watch,
  onWatch,
}: {
  session: PartySnapshot;
  watch: string;
  onWatch(id: string): void;
}) {
  const member = session.members.find(({ id }) => id === session.playerId);
  const local = session.local;
  if (!member || !local) return null;
  const { boss } = session;
  const dead = member.life === "DEAD";
  const options = session.members.filter(
    ({ life, connection }) => life === "ALIVE" && connection === "CONNECTED",
  );
  const watching = options.find(({ id }) => id === watch)?.id ?? options[0]?.id;
  return (
    <section aria-label="Combat controls" className="mt-4">
      {boss && (
        <div
          className="mb-3 rounded-lg border border-iris/60 bg-[#251731] px-4 py-2.5"
          data-testid="boss-hud"
          data-phase={boss.phase}
        >
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-serif text-xl text-[#f0dcb9]">
              Shadow Overlord
            </h2>
            <p className="text-xs text-iris">
              Phase {boss.phase} · {bossPhases[boss.phase]}
            </p>
          </div>
          <Meter
            label="Boss HP"
            value={boss.hp}
            max={boss.maxHp}
            tone="bg-[#c270cf]"
            testId="boss-health"
          />
          {boss.warnings > 0 && (
            <p
              className="mt-1.5 text-xs text-rose-200"
              data-testid="boss-warning"
            >
              Attack incoming. Move out of the marked area.
            </p>
          )}
        </div>
      )}
      <div className="rounded-lg border border-gold/35 bg-[#1d192d] px-4 py-3">
        <div className="grid items-center gap-3 md:grid-cols-[minmax(180px,0.65fr)_2fr]">
          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-1">
            <Meter
              label="HP"
              value={member.hp}
              max={member.maxHp}
              tone="bg-rose-500"
              testId="local-hp"
            />
            <Meter
              label="MP"
              value={local.mp}
              max={local.maxMp}
              tone="bg-sky-500"
              testId="local-mp"
            />
          </div>
          {dead ? (
            <div data-testid="spectator-mode">
              <p className="font-serif text-xl text-rose-200">
                Your wizard has fallen
              </p>
              <div
                className="mt-2 flex flex-wrap gap-2"
                aria-label="Spectate teammates"
              >
                {options.map((player) => (
                  <button
                    key={player.id}
                    className="action text-xs"
                    aria-pressed={player.id === watching}
                    onClick={() => onWatch(player.id)}
                  >
                    Watch {player.name}
                  </button>
                ))}
                {options.length === 0 && (
                  <p className="text-xs text-slate-300">
                    Waiting for a surviving teammate to reconnect.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <ul
              className="grid grid-cols-2 gap-2 sm:grid-cols-5"
              aria-label={wizards[member.wizard].name + " abilities"}
              data-testid="ability-bar"
            >
              {abilitySlots.map((slot, i) => {
                const ability = loadouts[member.wizard].abilities[slot];
                const remaining = (local.cooldowns[slot] ?? 0) / 10;
                const depleted = ability.mana > local.mp;
                return (
                  <li
                    key={slot}
                    className={`relative min-h-15 overflow-hidden rounded-md border bg-[#141322] px-2.5 py-1.5 text-xs ${i === 4 ? "border-gold/75" : "border-iris/30"}`}
                    data-testid="ability-slot"
                    data-slot={slot}
                    data-cooldown={remaining}
                    data-depleted={depleted}
                  >
                    {remaining > 0 && (
                      <span
                        className="pointer-events-none absolute inset-y-0 right-0 bg-iris/15"
                        style={{
                          width:
                            (remaining * 100000) / ability.cooldownMs + "%",
                        }}
                      />
                    )}
                    <div className="relative flex justify-between gap-1">
                      <kbd className="text-iris">{shortcuts[i]}</kbd>
                      <span
                        className={depleted ? "text-rose-200" : "text-sky-200"}
                      >
                        {depleted
                          ? "Low MP"
                          : ability.mana
                            ? ability.mana + " MP"
                            : "Free"}
                      </span>
                    </div>
                    <p className="relative mt-1 font-semibold text-slate-100">
                      {ability.name}
                    </p>
                    {remaining > 0 && (
                      <p className="relative text-[10px] text-gold">
                        {remaining.toFixed(1)}s
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <p className="mt-2 text-xs text-slate-300">
          {session.encounter} · {session.cleared}/3 encounters cleared
          {session.gateOpen && !boss ? " · Press G at the shadow gate" : ""}
          {local.statuses && (
            <span className="ml-2 text-[#d0bdff]" data-testid="local-status">
              {local.statuses}
            </span>
          )}
          {session.castError && (
            <span
              className="ml-2 text-rose-200"
              role="status"
              data-testid="cast-feedback"
            >
              {session.castError}
            </span>
          )}
        </p>
      </div>
    </section>
  );
}

export function RunSummary({
  result,
  onReturn,
}: {
  result: RunResult;
  onReturn(): void;
}) {
  const win = result.outcome === "VICTORY";
  const duration = Math.floor(result.durationMs / 1000);
  return (
    <section
      className="my-5 rounded-xl border border-gold/55 bg-[#241b35] p-5 sm:p-7"
      data-testid="run-result"
      data-outcome={result.outcome}
      data-run-id={result.id}
    >
      <h2
        className={
          "font-serif text-5xl " + (win ? "text-gold" : "text-rose-200")
        }
      >
        {win ? "Victory" : "Defeat"}
      </h2>
      <p className="mt-2 text-sm text-slate-200">
        {win ? "The Shadow Overlord fell." : "The Shadow Overlord endures."} ·{" "}
        {result.monsters} monsters defeated · {Math.floor(duration / 60)}m{" "}
        {duration % 60}s
      </p>
      <ul className="my-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {result.participants.map((player) => (
          <li
            key={player.id}
            className="rounded border border-iris/30 bg-[#171728] px-3 py-2 text-sm"
            data-testid="result-participant"
          >
            <p className="font-semibold">
              {player.name} · {player.status}
            </p>
            <p className="text-xs text-iris">{wizards[player.wizard].name}</p>
            <p className="mt-1 text-xs text-slate-300">
              {player.damage} damage · {player.healing} healing
            </p>
          </li>
        ))}
      </ul>
      <button className="action" onClick={onReturn}>
        Return to Private Teams
      </button>
    </section>
  );
}
