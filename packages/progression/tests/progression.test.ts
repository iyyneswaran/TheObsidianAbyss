import { randomUUID } from "node:crypto";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterAll, describe, expect, it } from "vitest";
import type { RunResult } from "@obsidian/game-core";
import { isolatedTestDatabase } from "../../../tests/fixtures/progression.js";
import {
  accountCookie,
  ProgressionOutbox,
  claimQuest,
  createDatabase,
  equip,
  getQuestBoard,
  getStore,
  getVault,
  lockedEquipment,
  loginAccount,
  profileSummary,
  purchase,
  questsAt,
  recordEvents,
  registerAccount,
  resolveProfile,
  revokeSession,
  rewardVersion,
  sessionAccount,
  settleRun,
  wallet,
  walletHistory,
  type QuestEvent,
} from "../src/index.js";

const url = isolatedTestDatabase();

describe.skipIf(!url)(
  "PostgreSQL progression constraints and transactions",
  () => {
    const db = () => (client ??= createDatabase(url!));
    let client: ReturnType<typeof createDatabase> | undefined;
    const password = "deterministic-secret-passphrase";
    const name = () => "wizard_" + randomUUID().slice(0, 8);
    const guest = async () =>
      (await resolveProfile(db(), undefined, randomUUID()))!.id;

    it("replays a durably queued outcome after the database and game writer return", async () => {
      const id = await guest();
      const outcome = result([id], "VICTORY");
      const directory = await mkdtemp(join(tmpdir(), "obsidian-retry-"));
      const disconnected = new URL(url!);
      disconnected.hostname = "127.0.0.1";
      disconnected.port = "1";
      disconnected.searchParams.set("connect_timeout", "1");
      const unavailable = createDatabase(disconnected.href);
      const first = new ProgressionOutbox(unavailable, directory);
      try {
        first.enqueue({ type: "settlement", value: outcome });
        await first.flush();
        await first.close();
        expect(
          (await readdir(directory)).some((file) => file.endsWith(".json")),
        ).toBe(true);
        const recovered = new ProgressionOutbox(db(), directory);
        try {
          recovered.enqueue({ type: "settlement", value: outcome });
          await recovered.flush();
          await recovered.flush();
          expect(await wallet(db(), id)).toEqual({ coins: 240, gems: 3 });
          expect((await walletHistory(db(), id)).ledger).toHaveLength(2);
        } finally {
          await recovered.close();
        }
      } finally {
        await first.close();
        await unavailable.$disconnect();
        await rm(directory, { recursive: true, force: true });
      }
    });

    it("quarantines unreadable jobs and drains valid jobs behind them", async () => {
      const id = await guest();
      const directory = await mkdtemp(join(tmpdir(), "obsidian-quarantine-"));
      const corrupt = join(directory, `0000000000000-${randomUUID()}.json`);
      const invalid = join(directory, `0000000000001-${randomUUID()}.json`);
      await writeFile(corrupt, "{");
      await writeFile(invalid, JSON.stringify({ type: "settlement" }));
      const outbox = new ProgressionOutbox(db(), directory);
      try {
        outbox.enqueue({ type: "settlement", value: result([id], "VICTORY") });
        await outbox.flush();
        await outbox.flush();
        expect(await wallet(db(), id)).toEqual({ coins: 240, gems: 3 });
        expect(await readFile(corrupt + ".quarantine", "utf8")).toBe("{");
        expect(await readdir(directory)).toHaveLength(2);
      } finally {
        await outbox.close();
        await rm(directory, { recursive: true, force: true });
      }
    });

    it("saves each party member's discovery once without completing a weekly run or changing wallets", async () => {
      const profiles = await Promise.all([guest(), guest()]);
      const time = Date.now(),
        runId = randomUUID();
      const events: QuestEvent[] = profiles.map((profileId) => ({
        id: runId + ":" + profileId + ":ossuary",
        profileId,
        runId,
        time,
        metric: "discovery",
        amount: 1,
        wizard: "ice",
      }));
      await recordEvents(db(), events);
      await recordEvents(db(), events);
      expect(await db().processedGameEvent.count({ where: { runId } })).toBe(2);
      for (const profile of profiles) {
        const board = await getQuestBoard(db(), profile, time);
        expect(board.daily.find((q) => q.key === "explore")?.progress).toBe(1);
        expect(board.weekly.find((q) => q.key === "runs")?.progress).toBe(0);
        expect(await wallet(db(), profile)).toEqual({ coins: 0, gems: 0 });
      }
    });

    it("keeps weekly rotations stable through Sunday and rotates the daily class through all seven wizards", () => {
      const monday = Date.parse("2026-11-16T00:00:00Z");
      const day = 86400000;
      const week = (at: number) =>
        questsAt(at)
          .filter((q) => q.period === "weekly")
          .map((q) => q.id);
      expect(week(monday)).toEqual(week(monday + 7 * day - 1));
      expect(week(monday)).not.toEqual(week(monday + 7 * day));
      const classes = new Set(
        Array.from(
          { length: 7 },
          (_, i) =>
            questsAt(monday + i * day).find(
              (q) => q.period === "daily" && q.wizard,
            )?.wizard,
        ),
      );
      expect(classes.size).toBe(7);
    });

    it("measures a committed four-player settlement, purchase, quest claim and profile read", async () => {
      const ids = await Promise.all(Array.from({ length: 4 }, guest));
      const id = ids[0]!;
      await settleRun(db(), result([id], "VICTORY"));
      const timings: Record<string, number> = {};
      async function measure(key: string, task: () => Promise<unknown>) {
        const start = performance.now();
        await task();
        timings[key] = Math.round((performance.now() - start) * 10) / 10;
      }
      await measure("fourSeatSettlementMs", () =>
        settleRun(db(), result(ids, "VICTORY")),
      );
      await measure("purchaseMs", () =>
        purchase(db(), id, "meteor", randomUUID()),
      );
      const quest = questsAt(Date.now()).find(
        (q) => q.period === "daily" && q.metric === "run",
      )!;
      await measure("claimMs", () => claimQuest(db(), id, quest.id));
      await measure("profileMs", () => profileSummary(db(), id));
      expect(await wallet(db(), id)).toEqual({
        coins: 240 + 60 - 180 + quest.coins,
        gems: 6,
      });
      console.info(
        "Loopback PostgreSQL timing sample (ms)",
        JSON.stringify(timings),
      );
    });

    afterAll(async () => {
      await client?.$disconnect();
    });

    function result(
      profileIds: string[],
      outcome: RunResult["outcome"],
      mode?: "forfeit" | "inactive",
    ): import("../src/index.js").Settlement {
      const now = Date.now();
      return {
        version: rewardVersion,
        started: now - 5000,
        ended: now,
        partyId: "test-party",
        profiles: Object.fromEntries(profileIds.map((id) => [id, id])),
        result: {
          id: randomUUID(),
          outcome,
          qualifies: mode !== "inactive",
          bossDefeated: outcome === "VICTORY",
          monsters: 3,
          durationMs: 5000,
          participants: profileIds.map((id, slot) => ({
            id,
            slot,
            name: "Wizard",
            wizard: "fire" as const,
            status:
              slot === 0
                ? ("Dead" as const)
                : mode === "forfeit"
                  ? ("Forfeited" as const)
                  : ("Survived" as const),
            damage: 165,
            healing: 2,
            kills: 1,
            mitigation: 5,
            protectedAtEnd: slot === 2,
          })),
        },
      };
    }

    it("hashes passwords, links one guest profile in place, rotates credentials and rejects revoked or expired sessions", async () => {
      const guestId = randomUUID();
      const original = (await resolveProfile(db(), undefined, guestId))!;
      const authoritative = result([original.id], "VICTORY");
      await settleRun(db(), authoritative);
      const username = name();
      const token = await registerAccount(
        db(),
        username,
        password,
        undefined,
        guestId,
      );
      const cookie = accountCookie(token, false);
      const row = await db().playerAccount.findUniqueOrThrow({
        where: { username },
      });
      expect(row.passwordHash).toMatch(
        /^scrypt-32768:[a-f0-9]{32}:[a-f0-9]{128}$/,
      );
      expect(row.passwordHash).not.toContain(password);
      expect(await resolveProfile(db(), cookie, guestId)).toMatchObject({
        id: original.id,
        username,
      });
      expect(await wallet(db(), original.id)).toEqual({ coins: 240, gems: 3 });
      await expect(loginAccount(db(), username, "wrong")).rejects.toMatchObject(
        { code: "INVALID_CREDENTIALS" },
      );
      await expect(
        registerAccount(db(), username, password),
      ).rejects.toMatchObject({ code: "USERNAME_UNAVAILABLE" });
      const another = await loginAccount(db(), username, password, cookie);
      expect(await sessionAccount(db(), cookie)).toBeNull();
      await revokeSession(db(), accountCookie(another, false));
      expect(
        await sessionAccount(db(), accountCookie(another, false)),
      ).toBeNull();
      const active = await loginAccount(db(), username, password);
      await db().playerSession.updateMany({
        where: { accountId: row.id },
        data: { expiresAt: new Date(0) },
      });
      expect(
        await sessionAccount(db(), accountCookie(active, false)),
      ).toBeNull();
      const newGuest = await resolveProfile(db(), undefined, guestId);
      expect(newGuest?.id).not.toBe(original.id);
      expect(await wallet(db(), newGuest!.id)).toEqual({ coins: 0, gems: 0 });
      expect((await walletHistory(db(), original.id)).runs[0]!.runId).toBe(
        authoritative.result.id,
      );
    }, 20000);

    for (const size of [1, 2, 3, 4])
      it(`pays a ${size}-seat victory exactly once including dead and protected seats`, async () => {
        const ids = await Promise.all(Array.from({ length: size }, guest));
        const receipt = result(ids, "VICTORY");
        await Promise.all([
          settleRun(db(), receipt),
          settleRun(db(), receipt),
          settleRun(db(), receipt),
        ]);
        for (const profileId of ids) {
          expect(await wallet(db(), profileId)).toEqual({
            coins: 240 / size,
            gems: 3,
          });
          const profile = await profileSummary(db(), profileId);
          expect(profile).toMatchObject({
            level: 2,
            xp: 100,
            victories: 1,
            damage: "165",
            healing: "2",
            mitigation: "5",
          });
          expect((await walletHistory(db(), profileId)).ledger).toHaveLength(2);
        }
      }, 12000);

    it("settles legitimate defeats without redistributing forfeited shares and with no gems for a defeat", async () => {
      const ids = await Promise.all(Array.from({ length: 4 }, guest));
      await settleRun(db(), result(ids, "DEFEAT", "forfeit"));
      expect(await wallet(db(), ids[0]!)).toEqual({ coins: 6, gems: 0 });
      expect(await wallet(db(), ids[1]!)).toEqual({ coins: 0, gems: 0 });
      const solo = await guest();
      await settleRun(db(), result([solo], "DEFEAT", "inactive"));
      expect(await wallet(db(), solo)).toEqual({ coins: 0, gems: 0 });
      await settleRun(db(), result([solo], "DEFEAT"));
      expect(await wallet(db(), solo)).toEqual({ coins: 24, gems: 0 });
      expect((await profileSummary(db(), solo)).xp).toBe(20);
      await expect(
        db().wallet.update({ where: { profileId: solo }, data: { coins: -1 } }),
      ).rejects.toBeTruthy();
    });

    it("serializes store purchases, rejects replay mismatches, persists equip and rejects wrong class or slot", async () => {
      const id = await guest();
      await expect(
        purchase(db(), id, "meteor", randomUUID()),
      ).rejects.toMatchObject({ code: "INSUFFICIENT_COINS" });
      await expect(
        purchase(db(), id, "inferno-core", randomUUID()),
      ).rejects.toMatchObject({ code: "INSUFFICIENT_GEMS" });
      await settleRun(db(), result([id], "VICTORY"));
      const key = randomUUID();
      const race = await Promise.allSettled([
        purchase(db(), id, "meteor", key),
        purchase(db(), id, "ice-spikes", randomUUID()),
      ]);
      expect(race.filter(({ status }) => status === "fulfilled")).toHaveLength(
        1,
      );
      expect(await wallet(db(), id)).toEqual({ coins: 60, gems: 3 });
      const owned = (await getStore(db(), id)).items.find(
        (item) => item.owned,
      )!;
      if (owned.id !== "meteor") {
        await settleRun(db(), result([id], "VICTORY"));
        await purchase(db(), id, "meteor", key);
      } else await settleRun(db(), result([id], "VICTORY"));
      const once = await wallet(db(), id);
      await Promise.all([
        purchase(db(), id, "meteor", key),
        purchase(db(), id, "meteor", key),
      ]);
      expect(await wallet(db(), id)).toEqual(once);
      await expect(
        purchase(db(), id, "stone-guard", key),
      ).rejects.toMatchObject({ code: "REUSED_REQUEST" });
      const gemKey = randomUUID();
      await Promise.all([
        purchase(db(), id, "inferno-core", gemKey),
        purchase(db(), id, "inferno-core", gemKey),
      ]);
      await expect(
        equip(db(), id, "ice", { skill3: "meteor", ultimate: null }),
      ).rejects.toMatchObject({ code: "UNAUTHORIZED_EQUIP" });
      await expect(
        equip(db(), id, "fire", { skill3: "inferno-core", ultimate: "meteor" }),
      ).rejects.toMatchObject({ code: "UNAUTHORIZED_EQUIP" });
      await expect(
        equip(db(), id, "fire", { skill3: null, ultimate: "storm-surge" }),
      ).rejects.toMatchObject({ code: "UNAUTHORIZED_EQUIP" });
      const beforeRestore = { skill3: "meteor", ultimate: "inferno-core" };
      await equip(db(), id, "fire", beforeRestore);
      const locked = await lockedEquipment(db(), id, "fire");
      const restarted = createDatabase(url!);
      try {
        expect(await lockedEquipment(restarted, id, "fire")).toEqual(
          beforeRestore,
        );
        expect((await getVault(restarted, id)).owned).toContain("meteor");
        expect((await wallet(restarted, id)).gems).toBe(0);
      } finally {
        await restarted.$disconnect();
      }
      await equip(db(), id, "fire", { skill3: null, ultimate: null });
      expect(locked).toEqual(beforeRestore);
    }, 20000);

    it("attributes UTC progress to the original day, caps actual events, and only pays one concurrent claim", async () => {
      const id = await guest();
      const another = await guest();
      const time = Date.parse("2026-11-16T23:59:59Z");
      const qa = questsAt(time).find(
        (q) => q.period === "daily" && q.metric === "damage",
      )!;
      const abandonedRun = randomUUID();
      const event: QuestEvent = {
        id: randomUUID(),
        runId: abandonedRun,
        profileId: id,
        wizard: "fire",
        time,
        metric: "damage",
        amount: qa.target,
      };
      await Promise.all([
        recordEvents(db(), [event]),
        recordEvents(db(), [event, event]),
      ]);
      expect(
        await db().processedGameEvent.count({ where: { id: event.id } }),
      ).toBe(1);
      const board = await getQuestBoard(db(), id, time);
      expect(board.daily).toHaveLength(5);
      expect(board.weekly).toHaveLength(7);
      expect(board.daily.filter((q) => q.wizard)).toHaveLength(1);
      expect(board.weekly.filter((q) => q.wizard)).toHaveLength(3);
      expect(board.daily.find((q) => q.id === qa.id)?.progress).toBe(qa.target);
      const next = await getQuestBoard(db(), id, time + 1000);
      expect(next.daily.find((q) => q.metric === "damage")?.progress).toBe(0);
      expect(next.past.find((q) => q.id === qa.id)?.status).toBe("Completed");
      await expect(
        claimQuest(db(), another, qa.id, time + 1000),
      ).rejects.toMatchObject({ code: "QUEST_NOT_COMPLETE" });
      await expect(
        claimQuest(db(), id, qa.id, qa.claimUntil),
      ).rejects.toMatchObject({ code: "QUEST_EXPIRED" });
      await Promise.all([
        claimQuest(db(), id, qa.id, time + 1000),
        claimQuest(db(), id, qa.id, time + 1000),
      ]);
      expect(await wallet(db(), id)).toEqual({ coins: qa.coins, gems: 0 });
    }, 12000);
  },
);
