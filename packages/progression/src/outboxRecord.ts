import { z } from "zod";
import { rewardVersion } from "./settlement.js";

const wizard = z.enum([
  "fire",
  "ice",
  "lightning",
  "earth",
  "wind",
  "healer",
  "defense",
]);
const identifier = z.string().min(1).max(256);
const count = z.number().int().nonnegative();
const time = z.number().int().nonnegative().max(8_640_000_000_000_000);

const participant = z.object({
  id: identifier,
  name: z.string(),
  wizard,
  status: z.enum(["Survived", "Dead", "Forfeited"]),
  damage: count,
  healing: count,
  mitigation: count,
  kills: count,
  slot: count.max(3),
  protectedAtEnd: z.boolean(),
});

export const outboxRecord = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("events"),
    events: z.array(
      z.object({
        id: identifier,
        runId: identifier,
        profileId: identifier,
        time,
        wizard,
        metric: z.enum([
          "damage",
          "heal",
          "mitigate",
          "kill",
          "mana",
          "burn",
          "freeze",
          "chain",
          "slow",
          "push",
          "run",
          "discovery",
          "victory",
        ]),
        amount: z.number().int(),
      }),
    ),
  }),
  z.object({
    type: z.literal("settlement"),
    value: z
      .object({
        version: z.literal(rewardVersion),
        partyId: identifier,
        started: time,
        ended: time,
        profiles: z.record(identifier, identifier),
        result: z.object({
          id: identifier,
          outcome: z.enum(["VICTORY", "DEFEAT"]),
          participants: z.array(participant).min(1).max(4),
          monsters: count,
          bossDefeated: z.boolean(),
          durationMs: z.number().nonnegative(),
          qualifies: z.boolean(),
        }),
      })
      .refine(
        ({ started, ended, result }) =>
          ended >= started &&
          new Set(result.participants.map(({ slot }) => slot)).size ===
            result.participants.length,
      ),
  }),
]);
