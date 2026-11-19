import { wizards } from "@obsidian/game-assets";
import { PARTY_SIZE } from "@obsidian/shared/coop";
import type { PartySnapshot } from "../multiplayer/party";

export function PartyRoster({ session }: { session: PartySnapshot }) {
  return (
    <ul
      aria-label="Team roster"
      className="grid grid-cols-2 gap-3 lg:grid-cols-4"
    >
      {Array.from({ length: PARTY_SIZE }, (_, slot) => {
        const member = session.members.find((entry) => entry.slot === slot);
        const wizard = member && wizards[member.wizard];
        return (
          <li
            key={slot}
            className="min-w-0 rounded-lg border border-gold/30 bg-panel px-4 py-3"
            data-testid={member ? "party-member" : "party-empty"}
          >
            {member && wizard ? (
              <>
                <p className="font-semibold text-slate-100">
                  {member.name}
                  {member.id === session.playerId && (
                    <span className="ml-2 text-xs text-slate-400">You</span>
                  )}
                </p>
                <p
                  className="mt-1 text-sm"
                  style={{ color: wizard.primaryColor }}
                >
                  {wizard.name}
                </p>
                <p className="mt-2 text-xs text-slate-300">
                  {member.id === session.leaderId && "Leader · "}
                  {member.connection === "CONNECTED"
                    ? "Connected"
                    : "Disconnected · Protected"}
                </p>
              </>
            ) : (
              <p className="text-sm text-slate-400">Empty slot</p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
