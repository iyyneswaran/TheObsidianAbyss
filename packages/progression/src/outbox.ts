import { randomUUID } from "node:crypto";
import {
  mkdir,
  open,
  readdir,
  readFile,
  rename,
  unlink,
} from "node:fs/promises";
import { resolve } from "node:path";
import { outboxRecord } from "./outboxRecord.js";
import type { PrismaClient } from "../generated/client/index.js";
import {
  recordEvents,
  settleRun,
  type QuestEvent,
  type Settlement,
} from "./settlement.js";

export type ProgressJob =
  | { type: "events"; events: QuestEvent[] }
  | { type: "settlement"; value: Settlement };

const delay = 1200;

export class ProgressionOutbox {
  private running?: Promise<void> | undefined;
  private readonly timer: ReturnType<typeof setInterval>;
  private readonly memory = new Map<string, string>();
  private writing?: Promise<void> | undefined;
  private closed = false;
  private retrying = false;

  constructor(
    private readonly db: PrismaClient,
    private readonly directory: string,
  ) {
    this.timer = setInterval(() => void this.flush(), delay);
    this.timer.unref();
    void this.flush();
  }

  enqueue(job: ProgressJob) {
    const key = `${Date.now()}-${randomUUID()}`;
    this.memory.set(key, JSON.stringify(job));
    void this.persist();
  }

  async flush() {
    if (this.closed) return;
    this.running ??= this.drain()
      .then(() => {
        if (this.retrying && process.env.NODE_ENV === "production")
          console.info(
            JSON.stringify({ event: "progression.outbox.recovered" }),
          );
        this.retrying = false;
      })
      .catch(() => {
        if (!this.retrying && process.env.NODE_ENV === "production")
          console.warn(JSON.stringify({ event: "progression.outbox.retry" }));
        this.retrying = true;
        // Keep the unprocessed files on disk for the next interval.
      })
      .finally(() => {
        this.running = undefined;
      });
    await this.running;
  }

  async close() {
    this.closed = true;
    clearInterval(this.timer);
    await this.persist();
    await this.running;
  }

  private async persist() {
    this.writing ??= this.persistPending()
      .catch(() => {
        // Failed disk writes stay queued in memory until the next attempt.
        console.warn("Progression outbox could not write pending jobs.");
      })
      .finally(() => {
        this.writing = undefined;
      });
    await this.writing;
  }

  private async persistPending() {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    for (const [key, payload] of this.memory) {
      const partial = resolve(this.directory, key + ".part");
      const file = await open(partial, "w", 0o600);
      try {
        await file.writeFile(payload);
        await file.sync();
      } finally {
        await file.close();
      }
      await rename(partial, resolve(this.directory, key + ".json"));
      this.memory.delete(key);
    }
  }

  private async drain() {
    await this.persist();
    const files = (await readdir(this.directory)).filter((file) =>
      /^\d{13}-[0-9a-f-]{36}\.json$/.test(file),
    );
    for (const file of files.sort().slice(0, 32)) {
      const path = resolve(this.directory, file);
      const payload = await readFile(path, "utf8");
      const decoded = outboxRecord.safeParse(parseRecord(payload));
      if (!decoded.success) {
        await rename(path, path + ".quarantine");
        console.error(
          JSON.stringify({
            service: "game",
            event: "progression.outbox.quarantined",
          }),
        );
        continue;
      }
      const job = decoded.data;
      if (job.type === "settlement") await settleRun(this.db, job.value);
      else await recordEvents(this.db, job.events);
      await unlink(path);
    }
  }
}

function parseRecord(payload: string): unknown {
  try {
    return JSON.parse(payload) as unknown;
  } catch {
    return undefined;
  }
}
