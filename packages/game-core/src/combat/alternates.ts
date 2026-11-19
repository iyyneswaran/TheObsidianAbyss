import {
  loadouts,
  type Ability,
  type AbilitySlot,
  type CombatClass,
} from "./balance.js";

export type AlternateSlot = "SKILL_3" | "ULTIMATE";
export interface Equipment {
  skill3: string | null;
  ultimate: string | null;
}
export const defaultEquipment: Equipment = Object.freeze({
  skill3: null,
  ultimate: null,
});
export const progressionBalance = { skillCoins: 180, ultimateGems: 6 } as const;

interface Alternate extends Ability {
  id: string;
  wizard: CombatClass;
  slot: AlternateSlot;
  description: string;
}

const item = (
  wizard: CombatClass,
  slot: AlternateSlot,
  id: string,
  description: string,
  ability: Ability,
): Alternate => ({ wizard, slot, id, description, ...ability });

const skill = (
  wizard: CombatClass,
  id: string,
  description: string,
  ability: Ability,
) => item(wizard, "SKILL_3", id, description, ability);
const ultimate = (
  wizard: CombatClass,
  id: string,
  description: string,
  ability: Ability,
) => item(wizard, "ULTIMATE", id, description, ability);

export const alternatives = [
  skill("fire", "meteor", "Call down a delayed impact that burns enemies.", {
    name: "Meteor",
    fx: "fire/flame-pillar",
    aim: "ground",
    shape: "radius",
    range: 215,
    radius: 62,
    mana: 27,
    cooldownMs: 5400,
    damage: 67,
    status: "Burning",
    statusMs: 2400,
    delayMs: 420,
  }),
  ultimate(
    "fire",
    "inferno-core",
    "Ignite a ring that pulses around your casting position.",
    {
      name: "Inferno Core",
      fx: "fire/fire-ring",
      aim: "self",
      shape: "radius",
      range: 0,
      radius: 145,
      mana: 43,
      cooldownMs: 16700,
      damage: 24,
      pulses: 5,
      pulseMs: 475,
    },
  ),
  skill(
    "ice",
    "ice-spikes",
    "Send a narrow line of frost that damages and slows.",
    {
      name: "Ice Spikes",
      fx: "ice/frost-breath",
      aim: "direction",
      shape: "line",
      range: 175,
      width: 47,
      mana: 19,
      cooldownMs: 3800,
      damage: 42,
      status: "Slowed",
      statusMs: 2500,
    },
  ),
  ultimate("ice", "glacial-prison", "Freeze enemies in a wide targeted area.", {
    name: "Glacial Prison",
    fx: "ice/frost-nova",
    aim: "ground",
    shape: "radius",
    range: 185,
    radius: 126,
    mana: 41,
    cooldownMs: 17200,
    damage: 58,
    status: "Frozen",
    statusMs: 2600,
    delayMs: 350,
  }),
  skill(
    "lightning",
    "static-field",
    "Leave a field of four electrical pulses.",
    {
      name: "Static Field",
      fx: "lightning/lightning-strike",
      aim: "ground",
      shape: "radius",
      range: 178,
      radius: 71,
      mana: 21,
      cooldownMs: 4800,
      damage: 16,
      pulses: 4,
      pulseMs: 520,
    },
  ),
  ultimate(
    "lightning",
    "storm-surge",
    "Strike a target and chain to up to four more enemies.",
    {
      name: "Storm Surge",
      fx: "lightning/chain-lightning",
      aim: "enemy",
      shape: "chain",
      range: 248,
      radius: 140,
      mana: 43,
      cooldownMs: 15800,
      damage: 91,
      jumps: 5,
    },
  ),
  skill(
    "earth",
    "stone-guard",
    "Raise a finite shell of stone around yourself.",
    {
      name: "Stone Guard",
      fx: "scifi/force-field",
      aim: "self",
      shape: "direct",
      range: 0,
      mana: 19,
      cooldownMs: 5300,
      shield: 54,
      buffMs: 3700,
    },
  ),
  ultimate(
    "earth",
    "seismic-cataclysm",
    "Telegraph three damaging ground shockwaves.",
    {
      name: "Seismic Cataclysm",
      fx: "nature/quake",
      aim: "ground",
      shape: "radius",
      range: 180,
      radius: 120,
      mana: 42,
      cooldownMs: 16700,
      damage: 36,
      delayMs: 380,
      pulses: 3,
      pulseMs: 470,
    },
  ),
  skill(
    "wind",
    "cyclone",
    "Pull eligible enemies toward the center of a damaging vortex.",
    {
      name: "Cyclone",
      fx: "nature/tornado",
      aim: "ground",
      shape: "radius",
      range: 213,
      radius: 80,
      mana: 21,
      cooldownMs: 4300,
      damage: 35,
      push: -41,
    },
  ),
  ultimate(
    "wind",
    "hurricane",
    "Drive back enemies inside a broad, pulsing storm.",
    {
      name: "Hurricane",
      fx: "nature/leaf-storm",
      aim: "ground",
      shape: "radius",
      range: 205,
      radius: 141,
      mana: 39,
      cooldownMs: 17000,
      damage: 22,
      pulses: 4,
      pulseMs: 520,
      push: 29,
    },
  ),
  skill(
    "healer",
    "healing-bloom",
    "Restore missing HP to living allies over time in a targeted circle.",
    {
      name: "Healing Bloom",
      fx: "holy/heal-aoe",
      aim: "ground",
      shape: "radius",
      range: 188,
      radius: 98,
      mana: 24,
      cooldownMs: 4900,
      heal: 14,
      pulses: 4,
      pulseMs: 560,
    },
  ),
  ultimate(
    "healer",
    "radiant-renewal",
    "Restore missing HP to the living team in five pulses.",
    {
      name: "Radiant Renewal",
      fx: "holy/heal",
      aim: "self",
      shape: "radius",
      range: 0,
      radius: 184,
      mana: 47,
      cooldownMs: 17100,
      heal: 21,
      pulses: 5,
      pulseMs: 540,
    },
  ),
  skill(
    "defense",
    "iron-guard",
    "Reduce incoming damage while the guard holds.",
    {
      name: "Iron Guard",
      fx: "impacts/shield-block",
      aim: "self",
      shape: "direct",
      range: 0,
      mana: 18,
      cooldownMs: 4700,
      block: 0.72,
      buffMs: 2600,
    },
  ),
  ultimate(
    "defense",
    "obsidian-ward",
    "Taunt nearby enemies and raise a finite protective ward.",
    {
      name: "Obsidian Ward",
      fx: "scifi/force-field",
      aim: "self",
      shape: "direct",
      range: 0,
      radius: 280,
      mana: 39,
      cooldownMs: 16700,
      shield: 98,
      block: 0.42,
      taunt: true,
      buffMs: 5200,
    },
  ),
] as const;

export const catalog = alternatives.map(
  ({ id, wizard, slot, name, description, mana, cooldownMs }) => ({
    id,
    wizard,
    slot,
    name,
    description,
    mana,
    cooldownMs,
    currency: slot === "SKILL_3" ? ("COINS" as const) : ("GEMS" as const),
    price:
      slot === "SKILL_3"
        ? progressionBalance.skillCoins
        : progressionBalance.ultimateGems,
  }),
);

export function alternate(
  wizard: CombatClass,
  slot: AlternateSlot,
  id: string | null,
) {
  return alternatives.find(
    (item) => item.id === id && item.slot === slot && item.wizard === wizard,
  );
}

export function equippedAbilities(
  wizard: CombatClass,
  equipment: Equipment,
): Record<AbilitySlot, Ability> {
  const defaults = loadouts[wizard].abilities;
  return {
    ...defaults,
    SKILL_3: alternate(wizard, "SKILL_3", equipment.skill3) ?? defaults.SKILL_3,
    ULTIMATE:
      alternate(wizard, "ULTIMATE", equipment.ultimate) ?? defaults.ULTIMATE,
  };
}
