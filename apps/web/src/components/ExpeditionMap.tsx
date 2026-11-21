import { useEffect, useMemo, useState } from "react";
import type { ExpeditionView } from "@obsidian/game-core";
import { preferences, keyName, gameInput } from "../settings/preferences";
import { party } from "../multiplayer/party";

export function ExpeditionMap({ exploration }: { exploration: string }) {
  const chart = useMemo(
    () => JSON.parse(exploration) as ExpeditionView,
    [exploration],
  );
  const [expanded, setExpanded] = useState(false);
  const [, refresh] = useState(0);
  useEffect(() => {
    function key(e: KeyboardEvent) {
      if (keyName(e) === preferences().keys.map && gameInput(e))
        setExpanded((v) => !v);
    }
    window.addEventListener("keydown", key);
    const id = window.setInterval(() => refresh((n) => n + 1), 200);
    return () => {
      window.removeEventListener("keydown", key);
      clearInterval(id);
    };
  }, []);
  const { playerId } = party.getSnapshot();
  const room = chart.rooms.find((r) => r.id === chart.current[playerId]);
  const players = [...(party.world?.players ?? [])].filter(
    ([, p]) => p.life === "ALIVE" && p.connection === "CONNECTED",
  );
  const left = Math.min(...chart.rooms.map((r) => r.x)),
    top = Math.min(...chart.rooms.map((r) => r.y));
  const right = Math.max(...chart.rooms.map((r) => r.x + r.w)),
    bottom = Math.max(...chart.rooms.map((r) => r.y + r.h));
  const mid = (id: string) => {
    const r = chart.rooms.find((r) => r.id === id)!;
    return [r.x + r.w / 2, r.y + r.h / 2] as const;
  };
  return (
    <aside
      aria-label="Expedition map"
      className={
        "absolute right-2 top-2 z-10 max-h-[96%] overflow-auto rounded-md border border-[#a98d66]/70 bg-[#110f20]/95 px-3 py-2 text-[#e7ddc8] shadow-xl " +
        (expanded ? "w-[min(390px,94%)]" : "w-[min(200px,48%)]")
      }
    >
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 text-left"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        <strong className="font-serif text-sm text-[#f0cf94]">
          {chart.title}
        </strong>
        <kbd className="rounded border border-[#70617c] px-1 text-xs">
          {preferences().keys.map}
        </kbd>
      </button>
      <p className="text-xs text-[#bfb2cd]" data-testid="current-room">
        {room?.title ?? "Passage"}
      </p>
      {chart.rooms.length > 0 && (
        <svg
          role="img"
          aria-label="Discovered rooms and party positions"
          className={expanded ? "h-36 w-full" : "h-14 w-full"}
          viewBox={[
            left - 90,
            top - 90,
            right - left + 180,
            bottom - top + 180,
          ].join(" ")}
        >
          {chart.links.map(([a, b]) => (
            <line
              key={a + b}
              x1={mid(a)[0]}
              y1={mid(a)[1]}
              x2={mid(b)[0]}
              y2={mid(b)[1]}
              stroke="#ae91ba"
              strokeWidth={32}
            />
          ))}
          {chart.rooms.map((r) => (
            <g key={r.id}>
              <title>{r.title}</title>
              <rect
                x={r.x}
                y={r.y}
                width={r.w}
                height={r.h}
                rx={55}
                fill={room?.id === r.id ? "#56435e" : "#312b40"}
                stroke={r.secret ? "#ba78fe" : "#a28b75"}
                strokeWidth={15}
              />
              {r.markers.map((m) => (
                <g key={m.id}>
                  <title>{m.title}</title>
                  {m.kind === "mana_restoration_zone" ? (
                    <path
                      d={`M ${m.x} ${m.y - 31} l 25 31 -25 31 -25 -31 Z`}
                      fill="#6ad9ff"
                    />
                  ) : m.kind.endsWith("gate") ? (
                    <rect
                      x={m.x - 27}
                      y={m.y - 36}
                      width={54}
                      height={72}
                      rx={16}
                      fill={chart.open ? "#6de4af" : "#cf92eb"}
                    />
                  ) : (
                    <circle cx={m.x} cy={m.y} r={24} fill="#dba15b" />
                  )}
                </g>
              ))}
            </g>
          ))}
          {players.map(([id, p]) => (
            <circle
              key={id}
              cx={p.x}
              cy={p.y}
              r={expanded ? 27 : 37}
              fill={id === playerId ? "#ffda7d" : "#67ebc8"}
              stroke="#19141f"
              strokeWidth={7}
            />
          ))}
        </svg>
      )}
      {expanded ? (
        <>
          <p className="border-t border-[#5b465e] pt-1 text-xs">
            {chart.visited}/18 rooms · {chart.secrets}/2 secrets
          </p>
          <ul className="mt-1 text-xs">
            {chart.objectives.map((o) => (
              <li key={o.id}>
                {o.done ? "✓" : "◇"} {o.title}
              </li>
            ))}
          </ul>
          <p className="mt-1 text-xs text-[#edce93]">
            {chart.gate} · {chart.open ? "Open" : "Sealed"}
          </p>
        </>
      ) : (
        <p className="text-xs">
          {chart.objectives.find((o) => !o.done)?.title ?? chart.gate}
        </p>
      )}
    </aside>
  );
}
