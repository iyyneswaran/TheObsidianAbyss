import type { CombatProgress, RunResult } from "@obsidian/game-core";
import {
  dayMs,
  rewardVersion,
  type createDatabase,
  type ProgressionOutbox,
  type QuestEvent,
} from "@obsidian/progression";

export interface GameProgression {
  db: ReturnType<typeof createDatabase>;
  outbox: ProgressionOutbox;
}

export class RunProgression {
  private readonly events = new Map<string, QuestEvent>();
  private batch = 0;
  private settled = false;
  private readonly started = Date.now();
  private readonly identities: Record<string, string>;

  constructor(
    private readonly services: GameProgression,
    private readonly runId: string,
    private readonly partyId: string,
    profiles: [string, string | undefined][],
  ) {
    this.identities = Object.fromEntries(
      profiles.filter((entry): entry is [string, string] => Boolean(entry[1])),
    );
  }

  capture(event: CombatProgress) {
    const profileId = this.identities[event.playerId];
    if (!profileId) return;
    const time = Date.now();
    const key = `${event.playerId}:${Math.floor(time / dayMs)}:${event.metric}`;
    const current = this.events.get(key);
    if (current) current.amount += event.amount;
    else
      this.events.set(key, {
        id: `${this.runId}:batch:${++this.batch}`,
        runId: this.runId,
        profileId,
        time,
        wizard: event.wizard,
        metric: event.metric,
        amount: event.amount,
      });
  }

  flush() {
    if (!this.events.size) return;
    this.services.outbox.enqueue({
      type: "events",
      events: [...this.events.values()],
    });
    this.events.clear();
  }

  finish(result: RunResult) {
    if (this.settled) return;
    this.settled = true;
    this.flush();
    this.services.outbox.enqueue({
      type: "settlement",
      value: {
        version: rewardVersion,
        partyId: this.partyId,
        started: this.started,
        ended: Math.max(this.started, Date.now()),
        result,
        profiles: this.identities,
      },
    });
  }

  async hasSettled() {
    return Boolean(
      await this.services.db.runResult.findUnique({
        where: { id: this.runId },
        select: { id: true },
      }),
    );
  }
}
