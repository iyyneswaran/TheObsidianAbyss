export type WizardClassId =
  "fire" | "ice" | "lightning" | "earth" | "wind" | "healer" | "defense";
type WizardRole = "Damage" | "Control" | "Support" | "Tank";

export interface WizardClass {
  id: WizardClassId;
  name: string;
  role: WizardRole;
  description: string;
  primaryColor: string;
  secondaryColor: string;
  spriteKey: string;
  spritePath: string;
}

function wizard(
  id: WizardClassId,
  name: string,
  role: WizardRole,
  description: string,
  primaryColor: string,
  secondaryColor: string,
): WizardClass {
  return {
    id,
    name,
    role,
    description,
    primaryColor,
    secondaryColor,
    spriteKey: `wizard.${id}`,
    spritePath: `assets/characters/${id}.png`,
  };
}

export const wizards = {
  fire: wizard(
    "fire",
    "Fire Wizard",
    "Damage",
    "Crimson robes with gold embroidery and a flame-tipped staff.",
    "#f26451",
    "#ffcf78",
  ),
  ice: wizard(
    "ice",
    "Ice Wizard",
    "Control",
    "A frost-white mantle over royal blue and a crystal staff.",
    "#75b9ff",
    "#c9f7ff",
  ),
  lightning: wizard(
    "lightning",
    "Lightning Wizard",
    "Damage",
    "Violet robes edged with angular gold bolts.",
    "#b496f4",
    "#ffce65",
  ),
  earth: wizard(
    "earth",
    "Earth Wizard",
    "Control",
    "Forest-green robes, stone pauldrons, and an amberwood staff.",
    "#a6c473",
    "#d7ae85",
  ),
  wind: wizard(
    "wind",
    "Wind Wizard",
    "Control",
    "A feathered hat and light silver trim on teal robes.",
    "#71d7cb",
    "#d8eeea",
  ),
  healer: wizard(
    "healer",
    "Healer Wizard",
    "Support",
    "Ceremonial cream vestments with an emerald cross.",
    "#f0d9b2",
    "#73d5a2",
  ),
  defense: wizard(
    "defense",
    "Defense Wizard",
    "Tank",
    "A navy cloak with silver armor and gold-edged shields.",
    "#9baeff",
    "#e6c786",
  ),
} satisfies Record<WizardClassId, WizardClass>;

export function findWizard(id: string | null): WizardClass | undefined {
  if (id !== null && Object.hasOwn(wizards, id))
    return wizards[id as WizardClassId];
  return undefined;
}

export const wizardDirections = ["down", "up", "left", "right"] as const;
export type WizardDirection = (typeof wizardDirections)[number];

export const wizardSheet = {
  frameWidth: 32,
  frameHeight: 48,
  columns: 5,
  feetX: 16,
  feetY: 44,
} as const;

export function hasWizardFrames(hasFrame: (frame: string) => boolean) {
  for (
    let index = 0;
    index < wizardSheet.columns * wizardDirections.length;
    index++
  ) {
    if (!hasFrame(String(index))) return false;
  }
  return true;
}

export const wizardAnimations = {
  idle: { frames: [0, 1], frameRate: 2 },
  walk: { frames: [2, 3, 4, 3], frameRate: 10 },
} as const;

export type WizardMotion = keyof typeof wizardAnimations;

export function wizardAnimationKey(
  wizardClass: WizardClass,
  motion: WizardMotion,
  direction: WizardDirection,
) {
  return `${wizardClass.spriteKey}.${motion}.${direction}`;
}
