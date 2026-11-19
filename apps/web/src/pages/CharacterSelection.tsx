import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { wizardDirections, wizards, wizardSheet } from "@obsidian/game-assets";
import {
  readWizardSelection,
  type WizardSelection,
} from "../game/characters/selection";

export function CharacterSelection() {
  const location = useLocation();
  const [selected, setSelected] = useState(() =>
    readWizardSelection(location.state),
  );
  const navigate = useNavigate();

  function enterDungeon() {
    if (selected) {
      navigate("/dungeon/play", {
        state: { wizardClassId: selected.id } satisfies WizardSelection,
      });
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-5 py-7 sm:px-8">
      <header className="mb-5">
        <Link
          className="text-sm text-iris underline-offset-4 hover:underline"
          to="/"
        >
          The Obsidian Abyss
        </Link>
        <h1 className="mt-2 font-serif text-4xl font-semibold sm:text-5xl">
          Select Wizard
        </h1>
      </header>

      <fieldset className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <legend className="sr-only">Wizard class</legend>
        {Object.values(wizards).map((wizard) => (
          <label
            key={wizard.id}
            className="group relative flex min-w-0 cursor-pointer flex-col overflow-hidden rounded-lg border border-gold/35 bg-panel transition-colors hover:border-gold has-checked:border-gold has-checked:ring-1 has-checked:ring-gold has-focus-visible:outline-2 has-focus-visible:outline-offset-4 has-focus-visible:outline-iris"
          >
            <input
              className="sr-only"
              type="radio"
              name="wizard"
              value={wizard.id}
              aria-label={wizard.name}
              checked={selected?.id === wizard.id}
              onChange={() => setSelected(wizard)}
            />
            <div
              className="relative grid h-32 place-items-center border-b border-gold/15 bg-[#121023]"
              style={{
                backgroundImage: `radial-gradient(ellipse at 50% 60%, ${wizard.primaryColor}28, transparent 72%)`,
              }}
            >
              <span
                aria-hidden="true"
                data-testid={`wizard-preview-${wizard.id}`}
                style={{
                  display: "block",
                  width: wizardSheet.frameWidth * 2,
                  height: wizardSheet.frameHeight * 2,
                  backgroundImage: `url(${import.meta.env.BASE_URL}${wizard.spritePath})`,
                  backgroundSize: `${100 * wizardSheet.columns}% ${100 * wizardDirections.length}%`,
                  backgroundRepeat: "no-repeat",
                  imageRendering: "pixelated",
                }}
              />
              {selected?.id === wizard.id && (
                <span className="absolute right-2 top-2 rounded bg-[#312539] px-2 py-0.5 text-xs text-[#ffe4ac]">
                  Selected
                </span>
              )}
            </div>
            <div className="space-y-1 px-3 py-2.5 sm:px-4">
              <h2 className="font-serif text-lg font-semibold leading-tight">
                {wizard.name}
              </h2>
              <p
                className="text-xs font-medium"
                style={{ color: wizard.primaryColor }}
              >
                {wizard.role}
              </p>
              <p className="text-xs leading-relaxed text-slate-300">
                {wizard.description}
              </p>
            </div>
          </label>
        ))}
      </fieldset>
      <footer className="mt-5 flex justify-end border-t border-gold/30 pt-4">
        <button className="action" disabled={!selected} onClick={enterDungeon}>
          Enter Dungeon
        </button>
      </footer>
    </main>
  );
}
