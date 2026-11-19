import type { CombatClass, ProgressMetric } from "@obsidian/game-core";

export const dayMs = 86_400_000;
export const questGraceMs = dayMs;
export const rotationVersion = 1;
const classes = [
  "fire",
  "ice",
  "lightning",
  "earth",
  "wind",
  "healer",
  "defense",
] as const;
type Period = "daily" | "weekly";
interface Definition {
  key: string;
  title: string;
  detail: string;
  metric: ProgressMetric;
  target: number;
  coins: number;
  wizard?: CombatClass;
}
export interface Quest extends Definition {
  id: string;
  period: Period;
  start: number;
  end: number;
  claimUntil: number;
}

const daily: Definition[] = [
  {
    key: "hunt",
    title: "Monster Hunter",
    detail: "Defeat or assist against required dungeon enemies.",
    metric: "kill",
    target: 2,
    coins: 30,
  },
  {
    key: "offense",
    title: "Arcane Offense",
    detail: "Deal actual damage to encounter enemies or the boss.",
    metric: "damage",
    target: 160,
    coins: 35,
  },
  {
    key: "mana",
    title: "Mana Seeker",
    detail: "Restore missing mana at a dungeon shrine.",
    metric: "mana",
    target: 40,
    coins: 25,
  },
  {
    key: "explore",
    title: "Dungeon Explorer",
    detail: "Finish one qualifying dungeon run.",
    metric: "run",
    target: 1,
    coins: 35,
  },
];
const weekly: Definition[] = [
  {
    key: "overlord",
    title: "End of the Eclipse",
    detail: "Defeat the Shadow Overlord with your party.",
    metric: "victory",
    target: 2,
    coins: 170,
  },
  {
    key: "hunt",
    title: "Clear the Halls",
    detail: "Defeat or assist against required enemies.",
    metric: "kill",
    target: 12,
    coins: 110,
  },
  {
    key: "offense",
    title: "Arcane Onslaught",
    detail: "Deal actual damage to encounter enemies or the boss.",
    metric: "damage",
    target: 1800,
    coins: 145,
  },
  {
    key: "runs",
    title: "Into the Abyss",
    detail: "Finish qualifying dungeon runs.",
    metric: "run",
    target: 5,
    coins: 125,
  },
  {
    key: "healer",
    title: "Keeper of the Flame",
    detail: "Restore missing teammate HP as a Healer Wizard.",
    metric: "heal",
    target: 220,
    coins: 160,
    wizard: "healer",
  },
  {
    key: "defense",
    title: "Unbroken Ward",
    detail: "Prevent real monster damage as a Defense Wizard.",
    metric: "mitigate",
    target: 200,
    coins: 160,
    wizard: "defense",
  },
];
const challenge: Record<
  CombatClass,
  Pick<Definition, "title" | "detail" | "metric" | "target">
> = {
  fire: {
    title: "Living Cinders",
    detail: "Apply Burning to encounter enemies as the Fire Wizard.",
    metric: "burn",
    target: 3,
  },
  ice: {
    title: "Still as Ice",
    detail: "Freeze encounter enemies as the Ice Wizard.",
    metric: "freeze",
    target: 3,
  },
  lightning: {
    title: "Linked Sparks",
    detail:
      "Hit multiple encounter enemies with a chain as the Lightning Wizard.",
    metric: "chain",
    target: 4,
  },
  earth: {
    title: "Roots of Stone",
    detail: "Slow encounter enemies as the Earth Wizard.",
    metric: "slow",
    target: 3,
  },
  wind: {
    title: "Against the Gale",
    detail: "Displace encounter enemies as the Wind Wizard.",
    metric: "push",
    target: 3,
  },
  healer: {
    title: "Hands of Light",
    detail: "Restore actual missing teammate HP as the Healer Wizard.",
    metric: "heal",
    target: 50,
  },
  defense: {
    title: "Hold the Line",
    detail: "Prevent real monster damage as the Defense Wizard.",
    metric: "mitigate",
    target: 45,
  },
};

export function questsAt(time: number): Quest[] {
  const day = Math.floor(time / dayMs);
  const mod = (value: number, divisor: number) =>
    ((value % divisor) + divisor) % divisor;
  const monday = day - mod(day + 3, 7);
  function expand(
    period: Period,
    date: number,
    base: Definition[],
    wizard: CombatClass,
  ) {
    const { target, ...role } = challenge[wizard];
    const start = date * dayMs;
    const end = start + (period === "daily" ? dayMs : dayMs * 7);
    const roleQuest = {
      ...role,
      wizard,
      key: "class",
      target: target * (period === "daily" ? 1 : 4),
      coins: period === "daily" ? 40 : 150,
    };
    return [...base, roleQuest].map((quest) => ({
      ...quest,
      period,
      start,
      end,
      claimUntil: end + questGraceMs,
      id: `v${rotationVersion}:${period}:${new Date(start).toISOString().slice(0, 10)}:${quest.key}`,
    }));
  }
  return [
    ...expand("daily", day, daily, classes[mod(day, classes.length)]!),
    ...expand(
      "weekly",
      monday,
      weekly,
      classes[mod(Math.floor((monday + 3) / 7), 5)]!,
    ),
  ];
}

export function findQuest(id: string): Quest | undefined {
  const date = /^v1:(?:daily|weekly):(\d{4}-\d{2}-\d{2}):[a-z]+$/.exec(id)?.[1];
  if (!date) return undefined;
  const time = Date.parse(date + "T00:00:00.000Z");
  return Number.isFinite(time)
    ? questsAt(time).find((q) => q.id === id)
    : undefined;
}

export function staticQuestCatalog() {
  return [
    ...daily.map((q) => ({ ...q, key: "daily-" + q.key })),
    ...weekly.map((q) => ({ ...q, key: "weekly-" + q.key })),
    ...classes.map((wizard) => ({
      ...challenge[wizard],
      wizard,
      key: "class-" + wizard,
    })),
  ];
}
