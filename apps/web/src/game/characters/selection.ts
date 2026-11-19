import { findWizard, type WizardClassId } from "@obsidian/game-assets";

export interface WizardSelection {
  wizardClassId: WizardClassId;
}

export function readWizardSelection(state: unknown) {
  if (
    typeof state === "object" &&
    state !== null &&
    "wizardClassId" in state &&
    typeof state.wizardClassId === "string"
  )
    return findWizard(state.wizardClassId);
  return undefined;
}
