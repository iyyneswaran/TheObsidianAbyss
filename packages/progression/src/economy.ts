import {
  alternate,
  catalog,
  defaultEquipment,
  type CombatClass,
  type Equipment,
} from "@obsidian/game-core";
import type {
  Currency,
  LedgerReason,
  PrismaClient,
} from "../generated/client/index.js";
import { ProgressionError, transaction, type Transaction } from "./db.js";
import {
  dayMs,
  findQuest,
  questsAt,
  questGraceMs,
  type Quest,
} from "./quests.js";

export async function changeBalance(
  tx: Transaction,
  profileId: string,
  currency: Currency,
  amount: number,
  reason: LedgerReason,
  source: string,
) {
  const field = currency === "COINS" ? "coins" : "gems";
  const changed = await tx.wallet.updateMany({
    where: { profileId, ...(amount < 0 ? { [field]: { gte: -amount } } : {}) },
    data: { [field]: { increment: amount } },
  });
  if (!changed.count)
    throw new ProgressionError(
      currency === "COINS" ? "INSUFFICIENT_COINS" : "INSUFFICIENT_GEMS",
      "Your wallet has insufficient " + field + ".",
    );
  return tx.walletTransaction.create({
    data: { profileId, currency, amount, reason, source },
  });
}

export async function wallet(db: PrismaClient, profileId: string) {
  return db.wallet.findUniqueOrThrow({
    where: { profileId },
    select: { coins: true, gems: true },
  });
}

export async function profileSummary(db: PrismaClient, profileId: string) {
  const profile = await db.playerProfile.findUniqueOrThrow({
    where: { id: profileId },
    select: {
      displayName: true,
      accountId: true,
      createdAt: true,
      xp: true,
      wizard: true,
      victories: true,
      defeats: true,
      monsters: true,
      damage: true,
      healing: true,
      mitigation: true,
      account: { select: { createdAt: true } },
      wallet: { select: { coins: true, gems: true } },
    },
  });
  const { accountId, account, ...summary } = profile;
  return {
    ...summary,
    permanent: Boolean(accountId),
    createdAt: (account?.createdAt ?? profile.createdAt).toISOString(),
    damage: profile.damage.toString(),
    healing: profile.healing.toString(),
    mitigation: profile.mitigation.toString(),
    level: Math.floor(profile.xp / 100) + 1,
    levelXp: profile.xp % 100,
    levelTarget: 100,
  };
}

export async function walletHistory(db: PrismaClient, profileId: string) {
  const [balance, ledger, runs] = await Promise.all([
    wallet(db, profileId),
    db.walletTransaction.findMany({
      where: { profileId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 30,
      select: {
        id: true,
        currency: true,
        amount: true,
        reason: true,
        createdAt: true,
      },
    }),
    db.runParticipant.findMany({
      where: { profileId },
      orderBy: { run: { endedAt: "desc" } },
      take: 12,
      select: {
        runId: true,
        wizard: true,
        status: true,
        coins: true,
        gems: true,
        xp: true,
        run: { select: { outcome: true, endedAt: true } },
      },
    }),
  ]);
  return { ...balance, ledger, runs };
}

export async function getStore(db: PrismaClient, profileId: string) {
  const [balance, owned] = await Promise.all([
    wallet(db, profileId),
    db.ownedAbility.findMany({
      where: { profileId },
      select: { abilityId: true },
    }),
  ]);
  const ids = new Set(owned.map(({ abilityId }) => abilityId));
  return {
    wallet: balance,
    items: catalog.map((item) => ({ ...item, owned: ids.has(item.id) })),
  };
}

export async function purchase(
  db: PrismaClient,
  profileId: string,
  abilityId: string,
  requestKey: string,
) {
  const item = catalog.find(({ id }) => id === abilityId);
  if (!item)
    throw new ProgressionError(
      "ITEM_NOT_FOUND",
      "That ability is unavailable.",
      404,
    );
  await transaction(db, async (tx) => {
    const replay = await tx.storePurchase.findUnique({
      where: { profileId_requestKey: { profileId, requestKey } },
    });
    if (replay) {
      if (replay.abilityId !== abilityId)
        throw new ProgressionError(
          "REUSED_REQUEST",
          "That purchase request already belongs to another item.",
        );
      return;
    }
    if (
      await tx.ownedAbility.findUnique({
        where: { profileId_abilityId: { profileId, abilityId } },
      })
    )
      throw new ProgressionError(
        "ALREADY_OWNED",
        "That ability is already in your Vault.",
      );
    const ledger = await changeBalance(
      tx,
      profileId,
      item.currency,
      -item.price,
      "STORE_PURCHASE",
      item.id,
    );
    await tx.ownedAbility.create({ data: { profileId, abilityId } });
    await tx.storePurchase.create({
      data: {
        profileId,
        abilityId,
        requestKey,
        currency: item.currency,
        price: item.price,
        ledgerId: ledger.id,
      },
    });
  });
  return getStore(db, profileId);
}

function verifyEquipment(
  wizard: CombatClass,
  equipment: Equipment,
  owned: ReadonlySet<string>,
): Equipment {
  return {
    skill3:
      equipment.skill3 &&
      owned.has(equipment.skill3) &&
      alternate(wizard, "SKILL_3", equipment.skill3)
        ? equipment.skill3
        : null,
    ultimate:
      equipment.ultimate &&
      owned.has(equipment.ultimate) &&
      alternate(wizard, "ULTIMATE", equipment.ultimate)
        ? equipment.ultimate
        : null,
  };
}

export async function getVault(db: PrismaClient, profileId: string) {
  const [records, owned] = await Promise.all([
    db.equippedLoadout.findMany({
      where: { profileId },
      select: { wizard: true, skill3: true, ultimate: true, revision: true },
    }),
    db.ownedAbility.findMany({
      where: { profileId },
      select: { abilityId: true },
    }),
  ]);
  const ids = new Set(owned.map(({ abilityId }) => abilityId));
  return {
    owned: [...ids],
    loadouts: records.map((row) => ({
      wizard: row.wizard,
      revision: row.revision,
      ...verifyEquipment(row.wizard as CombatClass, row, ids),
    })),
  };
}

export async function lockedEquipment(
  db: PrismaClient,
  profileId: string,
  wizard: CombatClass,
): Promise<Equipment> {
  const { loadouts } = await getVault(db, profileId);
  const item = loadouts.find((candidate) => candidate.wizard === wizard);
  return item
    ? { skill3: item.skill3, ultimate: item.ultimate }
    : { ...defaultEquipment };
}

export async function equip(
  db: PrismaClient,
  profileId: string,
  wizard: CombatClass,
  equipment: Equipment,
) {
  await transaction(db, async (tx) => {
    const owned = new Set(
      (
        await tx.ownedAbility.findMany({
          where: { profileId },
          select: { abilityId: true },
        })
      ).map((entry) => entry.abilityId),
    );
    const verified = verifyEquipment(wizard, equipment, owned);
    if (
      verified.skill3 !== equipment.skill3 ||
      verified.ultimate !== equipment.ultimate
    )
      throw new ProgressionError(
        "UNAUTHORIZED_EQUIP",
        "You can only equip owned abilities in the matching class and slot.",
        403,
      );
    await tx.equippedLoadout.upsert({
      where: { profileId_wizard: { profileId, wizard } },
      update: { ...verified, revision: { increment: 1 } },
      create: { profileId, wizard, ...verified },
    });
  });
  return getVault(db, profileId);
}

export async function getQuestBoard(
  db: PrismaClient,
  profileId: string,
  now = Date.now(),
) {
  const active = questsAt(now);
  const [progress, claims] = await Promise.all([
    db.questProgress.findMany({
      where: { profileId, deadline: { gte: new Date(now - dayMs) } },
    }),
    db.questClaim.findMany({
      where: { profileId, createdAt: { gte: new Date(now - 9 * dayMs) } },
      select: { instanceId: true },
    }),
  ]);
  const values = new Map(progress.map((p) => [p.instanceId, p.progress]));
  const claimed = new Set(claims.map((q) => q.instanceId));
  function show(q: Quest) {
    const count = values.get(q.id) ?? 0;
    const status = claimed.has(q.id)
      ? "Claimed"
      : now >= q.claimUntil
        ? "Expired"
        : count >= q.target
          ? "Completed"
          : "In Progress";
    return { ...q, progress: count, status };
  }
  const past = progress.flatMap((p) => {
    const q = findQuest(p.instanceId);
    return q && q.end <= now && p.progress >= q.target ? [show(q)] : [];
  });
  return {
    now,
    daily: active.filter((q) => q.period === "daily").map(show),
    weekly: active.filter((q) => q.period === "weekly").map(show),
    past,
  };
}

export async function claimQuest(
  db: PrismaClient,
  profileId: string,
  instanceId: string,
  now = Date.now(),
) {
  const quest = findQuest(instanceId);
  if (!quest || quest.start > now)
    throw new ProgressionError(
      "INVALID_QUEST",
      "Quest instance not found.",
      404,
    );
  const code = await transaction(db, async (tx) => {
    if (
      await tx.questClaim.findUnique({
        where: { profileId_instanceId: { profileId, instanceId } },
      })
    )
      return "QUEST_ALREADY_CLAIMED";
    if (now >= quest.end + questGraceMs)
      throw new ProgressionError(
        "QUEST_EXPIRED",
        "The quest claim window ended.",
        410,
      );
    const progress = await tx.questProgress.findUnique({
      where: { profileId_instanceId: { profileId, instanceId } },
    });
    if (!progress || progress.progress < quest.target)
      throw new ProgressionError(
        "QUEST_NOT_COMPLETE",
        "Complete the quest before claiming its reward.",
      );
    const ledger = await changeBalance(
      tx,
      profileId,
      "COINS",
      quest.coins,
      "QUEST_REWARD",
      instanceId,
    );
    await tx.questClaim.create({
      data: { profileId, instanceId, ledgerId: ledger.id },
    });
    return "CLAIMED";
  });
  return {
    code,
    wallet: await wallet(db, profileId),
    board: await getQuestBoard(db, profileId, now),
  };
}
