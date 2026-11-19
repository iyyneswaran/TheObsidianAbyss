import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import {
  findWizard,
  hasWizardFrames,
  wizardAnimationKey,
  wizardAnimations,
  wizardDirections,
  wizards,
  wizardSheet,
} from "@obsidian/game-assets";
import { readWizardSelection } from "../src/game/characters/selection.js";

it("defines seven unique selectable classes and their distinct registered PNGs", () => {
  const classes = Object.values(wizards);
  expect(classes.map(({ id }) => id)).toEqual([
    "fire",
    "ice",
    "lightning",
    "earth",
    "wind",
    "healer",
    "defense",
  ]);
  expect(new Set(classes.map(({ spriteKey }) => spriteKey)).size).toBe(7);
  const sheets = classes.map((wizard) => {
    const png = readFileSync(
      new URL(`../public/${wizard.spritePath}`, import.meta.url),
    );
    expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    expect(png.readUInt32BE(16)).toBe(
      wizardSheet.frameWidth * wizardSheet.columns,
    );
    expect(png.readUInt32BE(20)).toBe(
      wizardSheet.frameHeight * wizardDirections.length,
    );
    return png.toString("base64");
  });
  expect(new Set(sheets).size).toBe(7);
});

it("resolves unique idle and walk animation keys for every class and direction", () => {
  const keys = Object.values(wizards).flatMap((wizard) =>
    wizardDirections.flatMap((direction) =>
      (["idle", "walk"] as const).map((motion) =>
        wizardAnimationKey(wizard, motion, direction),
      ),
    ),
  );
  expect(new Set(keys).size).toBe(56);
  expect(keys).toContain("wizard.fire.walk.left");
  expect(new Set(wizardAnimations.idle.frames).size).toBe(2);
  expect(new Set(wizardAnimations.walk.frames).size).toBe(3);
});

it("guards unknown selections and missing registry entries", () => {
  expect(readWizardSelection({ wizardClassId: "ice" })).toBe(wizards.ice);
  expect(readWizardSelection({ wizardClassId: "__proto__" })).toBeUndefined();
  expect(readWizardSelection(undefined)).toBeUndefined();
  expect(findWizard("missing")).toBeUndefined();
});

it("rejects an absent or incomplete sheet before registering animations", () => {
  const frames = new Set(
    Array.from({ length: 20 }, (_, index) => String(index)),
  );
  expect(hasWizardFrames((frame) => frames.has(frame))).toBe(true);
  frames.delete("14");
  expect(hasWizardFrames((frame) => frames.has(frame))).toBe(false);
  expect(hasWizardFrames(() => false)).toBe(false);
});
