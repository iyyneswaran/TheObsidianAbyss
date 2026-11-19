import type {
  CombatClass,
  ProgressMetric,
  RunResult,
} from "@obsidian/game-core";
import type {
  PrismaClient,
  ParticipantStatus,
} from "../generated/client/index.js";
import { transaction, type Transaction } from "./db.js";
import { changeBalance } from "./economy.js";
import { questsAt } from "./quests.js";

export const rewardVersion = 1;
export const rewards = {
  victoryCoins: 240,
  defeatCoins: 24,
  victoryGems: 3,
  victoryXp: 100,
  defeatXp: 20,
} as const;

export interface QuestEvent {
  id: string;
  runId: string;
  profileId: string;
  time: number;
  wizard: CombatClass;
  metric: ProgressMetric;
  amount: number;
}

export interface Settlement {
  version: typeof rewardVersion;
  partyId: string;
  started: number;
  ended: number;
  result: RunResult;
  profiles: Record<string, string>;
}

async function recordProgress(tx: Transaction, event: QuestEvent) {
  if (!Number.isSafeInteger(event.amount) || event.amount <= 0) return;
  const inserted = await tx.processedGameEvent.createMany({
    data: {
      id: event.id,
      runId: event.runId,
      profileId: event.profileId,
      kind: event.metric,
    },
    skipDuplicates: true,
  });
  if (!inserted.count) return;
  for (const quest of questsAt(event.time)) {
    if (
      quest.metric !== event.metric ||
      (quest.wizard && quest.wizard !== event.wizard)
    )
      continue;
    const where = {
      profileId_instanceId: {
        profileId: event.profileId,
        instanceId: quest.id,
      },
    };
    const previous = await tx.questProgress.findUnique({
      where,
      select: { progress: true },
    });
    const progress = Math.min(
      quest.target,
      (previous?.progress ?? 0) + event.amount,
    );
    if (progress === previous?.progress) continue;
    await tx.questProgress.upsert({
      where,
      create: {
        profileId: event.profileId,
        instanceId: quest.id,
        deadline: new Date(quest.claimUntil),
        progress,
      },
      update: { progress },
    });
  }
}

export async function recordEvents(db: PrismaClient, events: QuestEvent[]) {
  await transaction(db, async (tx) => {
    for (const event of events) await recordProgress(tx, event);
  });
}

export async function settleRun(db: PrismaClient, settlement: Settlement) {
  const { result, started, ended, profiles, partyId, version } = settlement;
  const count = result.participants.length;
  if (version !== rewardVersion || count < 1 || count > 4 || ended < started)
    throw new Error("Invalid authoritative run settlement.");
  const won = result.outcome === "VICTORY";
  const qualifies = won || result.qualifies;
  await transaction(db, async (tx) => {
    if (
      await tx.runResult.findUnique({
        where: { id: result.id },
        select: { id: true },
      })
    )
      return;
    await tx.runResult.create({
      data: {
        id: result.id,
        partyId,
        outcome: result.outcome,
        rosterSize: count,
        rewardVersion: version,
        qualifies,
        monsters: result.monsters,
        startedAt: new Date(started),
        endedAt: new Date(ended),
      },
    });
    for (const participant of [...result.participants].sort((a, b) =>
      (profiles[a.id] ?? "").localeCompare(profiles[b.id] ?? ""),
    )) {
      const profileId = profiles[participant.id];
      const eligible = Boolean(
        profileId && qualifies && participant.status !== "Forfeited",
      );
      const coins = eligible
        ? (won ? rewards.victoryCoins : rewards.defeatCoins) / count
        : 0;
      const gems = eligible && won ? rewards.victoryGems : 0;
      const xp = eligible ? (won ? rewards.victoryXp : rewards.defeatXp) : 0;
      await tx.runParticipant.create({
        data: {
          runId: result.id,
          slot: participant.slot,
          profileId: profileId ?? null,
          wizard: participant.wizard,
          eligible,
          status: participant.status.toUpperCase() as ParticipantStatus,
          damage: participant.damage,
          healing: participant.healing,
          mitigation: participant.mitigation,
          kills: participant.kills,
          coins,
          gems,
          xp,
        },
      });
      if (!eligible || !profileId) continue;
      await changeBalance(
        tx,
        profileId,
        "COINS",
        coins,
        won ? "RUN_VICTORY_COINS" : "RUN_DEFEAT_COINS",
        result.id,
      );
      if (gems)
        await changeBalance(
          tx,
          profileId,
          "GEMS",
          gems,
          "RUN_VICTORY_GEMS",
          result.id,
        );
      await tx.playerProfile.update({
        where: { id: profileId },
        data: {
          wizard: participant.wizard,
          xp: { increment: xp },
          victories: { increment: Number(won) },
          defeats: { increment: Number(!won) },
          monsters: { increment: participant.kills },
          damage: { increment: BigInt(participant.damage) },
          healing: { increment: BigInt(participant.healing) },
          mitigation: { increment: BigInt(participant.mitigation) },
        },
      });
      if (!participant.protectedAtEnd) {
        for (const metric of won
          ? (["run", "victory"] as const)
          : (["run"] as const)) {
          await recordProgress(tx, {
            id: `${result.id}:${participant.slot}:${metric}`,
            runId: result.id,
            profileId,
            time: ended,
            wizard: participant.wizard,
            metric,
            amount: 1,
          });
        }
      }
    }
  });
}
