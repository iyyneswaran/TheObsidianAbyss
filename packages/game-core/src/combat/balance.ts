export const abilitySlots = [
  "BASIC",
  "SKILL_1",
  "SKILL_2",
  "SKILL_3",
  "ULTIMATE",
] as const;
export type AbilitySlot = (typeof abilitySlots)[number];
export type Ailment = "Burning" | "Frozen" | "Slowed" | "Stunned";
export type Buff = "Shielded" | "Blocking" | "Charged" | "Taunting";
export type Status = Ailment | Buff;
export type Aim = "auto" | "halo" | "enemy" | "ground" | "direction" | "self";
export type Shape =
  "direct" | "projectile" | "radius" | "cone" | "chain" | "dash";

export interface Effect {
  damage?: number;
  heal?: number;
  status?: Ailment;
  statusMs?: number;
  push?: number;
}

export interface Ability extends Effect {
  name: string;
  fx: string;
  aim: Aim;
  shape: Shape;
  mana: number;
  cooldownMs: number;
  range: number;
  radius?: number;
  speed?: number;
  delayMs?: number;
  pulseMs?: number;
  pulses?: number;
  jumps?: number;
  shield?: number;
  block?: number;
  buffMs?: number;
  charge?: number;
  taunt?: boolean;
}

function spell(
  name: string,
  fx: string,
  aim: Aim,
  shape: Shape,
  mana: number,
  cooldownMs: number,
  range: number,
  effect: Omit<
    Ability,
    "name" | "fx" | "aim" | "shape" | "mana" | "cooldownMs" | "range"
  >,
): Ability {
  return { name, fx, aim, shape, mana, cooldownMs, range, ...effect };
}

const bolt = (
  name: string,
  fx: string,
  ms: number,
  range: number,
  damage: number,
  speed: number,
) => spell(name, fx, "auto", "projectile", 0, ms, range, { damage, speed });
const kit = (
  hp: number,
  mp: number,
  ...abilities: [Ability, Ability, Ability, Ability, Ability]
) => ({
  hp,
  mp,
  abilities: Object.fromEntries(
    abilitySlots.map((slot, index) => [slot, abilities[index]!]),
  ) as Record<AbilitySlot, Ability>,
});

export const loadouts = {
  fire: kit(
    125,
    105,
    bolt("Fireball", "fire/fireball", 570, 254, 22, 410),
    spell(
      "Fire Breath",
      "fire/fire-breath",
      "direction",
      "cone",
      12,
      2300,
      110,
      { damage: 26, status: "Burning", statusMs: 2700 },
    ),
    spell(
      "Flame Pillar",
      "fire/flame-pillar",
      "ground",
      "radius",
      18,
      3500,
      210,
      { damage: 48, radius: 48, delayMs: 330 },
    ),
    spell(
      "Flamethrower",
      "fire/flamethrower",
      "direction",
      "cone",
      22,
      5200,
      133,
      { damage: 15, pulses: 4, pulseMs: 310 },
    ),
    spell("Fire Ring", "fire/fire-ring", "self", "radius", 38, 16000, 0, {
      damage: 78,
      radius: 134,
      status: "Burning",
      statusMs: 3600,
      delayMs: 280,
    }),
  ),
  ice: kit(
    123,
    113,
    bolt("Ice Lance", "ice/ice-lance", 590, 244, 19, 430),
    spell("Freeze", "ice/freeze", "enemy", "direct", 11, 2800, 220, {
      damage: 9,
      status: "Frozen",
      statusMs: 1550,
    }),
    spell(
      "Frost Breath",
      "ice/frost-breath",
      "direction",
      "cone",
      13,
      2600,
      126,
      { damage: 23, status: "Slowed", statusMs: 2400 },
    ),
    spell(
      "Blizzard Vortex",
      "ice/blizzard-vortex",
      "ground",
      "radius",
      24,
      5200,
      205,
      {
        damage: 13,
        radius: 57,
        pulses: 4,
        pulseMs: 580,
        status: "Slowed",
        statusMs: 880,
      },
    ),
    spell("Frost Nova", "ice/frost-nova", "self", "radius", 36, 15000, 0, {
      damage: 66,
      radius: 130,
      status: "Frozen",
      statusMs: 1750,
      delayMs: 240,
    }),
  ),
  lightning: kit(
    115,
    112,
    spell("Zap", "lightning/zap-hit", "auto", "direct", 0, 460, 221, {
      damage: 17,
    }),
    spell(
      "Chain Lightning",
      "lightning/chain-lightning",
      "enemy",
      "chain",
      18,
      2850,
      230,
      { damage: 37, radius: 115, jumps: 3 },
    ),
    spell(
      "Lightning Strike",
      "lightning/lightning-strike",
      "ground",
      "radius",
      19,
      3500,
      235,
      { damage: 54, radius: 40, delayMs: 420 },
    ),
    spell("Charge Up", "lightning/charge-up", "self", "direct", 12, 5000, 0, {
      charge: 20,
      buffMs: 4800,
    }),
    spell(
      "Thunderclap",
      "lightning/thunderclap",
      "self",
      "radius",
      38,
      15500,
      0,
      {
        damage: 77,
        radius: 134,
        status: "Stunned",
        statusMs: 1250,
        delayMs: 240,
      },
    ),
  ),
  earth: kit(
    145,
    102,
    bolt("Boulder", "nature/boulder", 690, 217, 25, 340),
    spell("Vine Whip", "nature/vine-whip", "direction", "cone", 11, 2400, 142, {
      damage: 32,
      status: "Slowed",
      statusMs: 1800,
    }),
    spell(
      "Earth Spike",
      "nature/earth-spike",
      "ground",
      "radius",
      18,
      3500,
      205,
      { damage: 51, radius: 43, delayMs: 420 },
    ),
    spell("Quake", "nature/quake", "self", "radius", 21, 4600, 0, {
      damage: 47,
      radius: 107,
    }),
    spell("Thorns", "nature/thorns", "ground", "radius", 34, 14500, 185, {
      damage: 22,
      radius: 105,
      pulses: 4,
      pulseMs: 610,
      status: "Slowed",
      statusMs: 850,
    }),
  ),
  wind: kit(
    118,
    110,
    bolt("Wind Dart", "nature/leaf-storm", 500, 237, 18, 520),
    spell(
      "Wind Dash",
      "nature/leaf-storm",
      "direction",
      "dash",
      12,
      2250,
      94,
      {},
    ),
    spell("Tornado", "nature/tornado", "ground", "radius", 19, 3450, 219, {
      damage: 38,
      push: 54,
      radius: 48,
    }),
    spell(
      "Wind Sweep",
      "nature/leaf-storm",
      "direction",
      "cone",
      16,
      3000,
      143,
      { damage: 30, push: 62 },
    ),
    spell("Tempest", "nature/tornado", "ground", "radius", 35, 16000, 209, {
      damage: 19,
      radius: 110,
      pulses: 5,
      pulseMs: 480,
      push: 18,
      status: "Slowed",
      statusMs: 780,
    }),
  ),
  healer: kit(
    130,
    126,
    spell("Halo", "holy/halo", "halo", "direct", 0, 630, 228, {
      damage: 17,
      heal: 7,
    }),
    spell("Holy Smite", "holy/smite", "enemy", "direct", 11, 1800, 237, {
      damage: 45,
    }),
    spell("Healing Ring", "holy/heal-aoe", "self", "radius", 19, 3850, 0, {
      heal: 32,
      radius: 112,
    }),
    spell(
      "Divine Shield",
      "holy/divine-shield",
      "self",
      "direct",
      16,
      6100,
      0,
      { shield: 35, buffMs: 3900 },
    ),
    spell("Divine Sanctuary", "holy/heal", "self", "radius", 39, 16600, 0, {
      heal: 68,
      radius: 155,
    }),
  ),
  defense: kit(
    170,
    99,
    spell("Shield Strike", "impacts/blunt-hit", "auto", "direct", 0, 510, 82, {
      damage: 27,
    }),
    spell("Force Field", "scifi/force-field", "self", "direct", 14, 5000, 0, {
      shield: 42,
      buffMs: 3900,
    }),
    spell(
      "Shield Block",
      "impacts/shield-block",
      "self",
      "direct",
      11,
      3200,
      0,
      { block: 0.65, buffMs: 2200 },
    ),
    spell("Ground Slam", "impacts/ground-slam", "self", "radius", 19, 3400, 0, {
      damage: 43,
      radius: 96,
      status: "Stunned",
      statusMs: 1000,
    }),
    spell(
      "Guardian's Bulwark",
      "scifi/force-field",
      "self",
      "direct",
      33,
      15500,
      0,
      { shield: 73, block: 0.45, taunt: true, radius: 246, buffMs: 5150 },
    ),
  ),
} as const;
export type CombatClass = keyof typeof loadouts;

const mob = (
  hp: number,
  speed: number,
  damage: number,
  range: number,
  detection: number,
  windupMs: number,
  recoveryMs: number,
) => ({ hp, speed, damage, range, detection, windupMs, recoveryMs });
export const enemies = {
  shadow: mob(103, 84, 8, 46, 218, 590, 2300),
  lava: mob(144, 73, 12, 76, 226, 750, 2400),
  mage: mob(124, 63, 9, 185, 240, 850, 2500),
  servant: mob(40, 78, 5, 42, 210, 680, 2050),
  illusion: mob(28, 57, 5, 104, 300, 730, 2800),
  overlord: mob(720, 66, 14, 270, 680, 950, 2000),
} as const;
export type EnemyKind = keyof typeof enemies;

export const guardAppearances = [
  "shadow-guard",
  "soul-drainer",
  "flying-skull",
  "shadow-bat",
] as const;
export const enemyAppearances = [
  "shadow",
  "lava",
  "mage",
  "servant",
  "illusion",
  "overlord",
  "ghost-wisp",
  "eye-beast",
  ...guardAppearances,
] as const satisfies readonly string[];
export type EnemyAppearance = (typeof enemyAppearances)[number];

export const combatBalance = {
  lava: { damage: 8, intervalMs: 950 },
  shrinePerSecond: 20,
  burn: { damage: 4, intervalMs: 600 },
  slowMultiplier: 0.56,
  bossPhases: [0.7, 0.35],
  boss: {
    summons: 4,
    illusions: 2,
    summonLifeMs: 22000,
    illusionLifeMs: 8000,
    phaseOne: { shadowSpeed: 260, burstRadius: 76, recoverMs: 2050 },
    phaseTwo: { tendrilRadius: 72, floorRadius: 62, recoverMs: 1550 },
    phaseThree: {
      beamWidth: 30,
      beamRange: 525,
      blastRadius: 87,
      recoverMs: 1180,
    },
  },
  limit: { monsters: 28, shots: 64, areas: 48, castsPerSecond: 9, events: 96 },
} as const;
