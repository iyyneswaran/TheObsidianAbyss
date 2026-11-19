import { z } from "zod";
import { wizardClassSchema } from "@obsidian/shared/coop";

const count = z.int().nonnegative();
const wallet = z.object({ coins: count, gems: count });
const currency = z.enum(["COINS", "GEMS"]);
const session = z.object({ displayName: z.string(), permanent: z.boolean() });
const item = z.object({
  id: z.string(),
  wizard: wizardClassSchema,
  slot: z.enum(["SKILL_3", "ULTIMATE"]),
  name: z.string(),
  description: z.string(),
  mana: count,
  cooldownMs: count,
  currency,
  price: count,
  owned: z.boolean(),
});
const store = z.object({ wallet, items: z.array(item) });
const vault = z.object({
  owned: z.array(z.string()),
  loadouts: z.array(
    z.object({
      wizard: wizardClassSchema,
      revision: count,
      skill3: z.string().nullable(),
      ultimate: z.string().nullable(),
    }),
  ),
});
const quest = z.object({
  id: z.string(),
  key: z.string(),
  title: z.string(),
  detail: z.string(),
  metric: z.string(),
  target: count,
  coins: count,
  wizard: wizardClassSchema.optional(),
  period: z.enum(["daily", "weekly"]),
  start: count,
  end: count,
  claimUntil: count,
  progress: count,
  status: z.enum(["In Progress", "Completed", "Claimed", "Expired"]),
});
const board = z.object({
  now: count,
  daily: z.array(quest).length(5),
  weekly: z.array(quest).length(7),
  past: z.array(quest),
});
const profile = session.extend({
  wallet,
  createdAt: z.iso.datetime(),
  wizard: wizardClassSchema,
  xp: count,
  level: count,
  levelXp: count,
  levelTarget: count,
  victories: count,
  defeats: count,
  monsters: count,
  damage: z.string().regex(/^\d+$/),
  healing: z.string().regex(/^\d+$/),
  mitigation: z.string().regex(/^\d+$/),
});
const history = wallet.extend({
  ledger: z.array(
    z.object({
      id: z.uuid(),
      currency,
      amount: z.int(),
      reason: z.string(),
      createdAt: z.date(),
    }),
  ),
  runs: z.array(
    z.object({
      runId: z.uuid(),
      wizard: wizardClassSchema,
      status: z.string(),
      coins: count,
      gems: count,
      xp: count,
      run: z.object({
        outcome: z.enum(["VICTORY", "DEFEAT"]),
        endedAt: z.date(),
      }),
    }),
  ),
});
export const progressionContracts: Record<string, z.ZodType> = {
  "/health/database": z.object({
    status: z.literal("ok"),
    service: z.literal("obsidian-progression"),
  }),
  "/auth/session": session.nullable(),
  "/auth/register": session,
  "/auth/login": session,
  "/profile": profile,
  "/wallet": history,
  "/store": store,
  "/store/purchase": store,
  "/vault": vault,
  "/vault/equip": vault,
  "/quests": board,
  "/quests/claim": z.object({
    wallet,
    board,
    code: z.enum(["CLAIMED", "QUEST_ALREADY_CLAIMED"]),
  }),
};
