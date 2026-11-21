import { useEffect, useState, useSyncExternalStore } from "react";
import { useLocation } from "react-router-dom";
import { audio, mountSound } from "../audio/sound";
import { PageShell, panel } from "../progression/common";
import {
  defaults,
  defaultKeys,
  preferences,
  subscribe,
  save,
  keyName,
  validKey,
  type Action,
  type Bus,
} from "./preferences";
export const usePreferences = () =>
  useSyncExternalStore(subscribe, preferences, preferences);
export const labels: Record<Action, string> = {
  up: "Move up",
  left: "Move left",
  down: "Move down",
  right: "Move right",
  BASIC: "Basic attack",
  SKILL_1: "Skill 1",
  SKILL_2: "Skill 2",
  SKILL_3: "Skill 3",
  ULTIMATE: "Ultimate",
  interact: "Interact",
  map: "Minimap",
};
export function PlayerPreferences() {
  const p = usePreferences(),
    location = useLocation();
  useEffect(mountSound, []);
  useEffect(() => {
    document.documentElement.dataset.contrast = String(p.contrast);
    document.documentElement.dataset.motion = p.reducedMotion
      ? "reduced"
      : "full";
    document.documentElement.style.setProperty(
      "--hud-scale",
      String(p.hudScale),
    );
  }, [p]);
  useEffect(() => {
    return () => audio.leave();
  }, [location.pathname]);
  return null;
}
const names = {
  master: "Master",
  music: "Music",
  ambience: "Ambience",
  sfx: "Sound effects",
  ui: "Interface",
};
export function Settings() {
  const p = usePreferences(),
    [listening, setListening] = useState<Action | null>(null),
    [message, status] = useState("");
  return (
    <PageShell
      title="Settings"
      detail="Sound, controls and display preferences are saved on this device."
    >
      <div className="settings-grid">
        <section className={panel} aria-labelledby="mix">
          <h2 id="mix">Audio mixer</h2>
          <label>
            <input
              type="checkbox"
              checked={p.enabled}
              onChange={(e) => {
                save({ ...p, enabled: e.target.checked });
                if (e.target.checked) void audio.unlock();
              }}
            />{" "}
            Enable audio
          </label>
          <label>
            <input
              type="checkbox"
              checked={p.muted}
              onChange={(e) => save({ ...p, muted: e.target.checked })}
            />{" "}
            Mute all
          </label>
          {(Object.keys(names) as Bus[]).map((bus) => (
            <label className="slider" key={bus}>
              {names[bus]} <output>{Math.round(p.volume[bus] * 100)}%</output>
              <input
                aria-label={names[bus] + " volume"}
                type="range"
                min="0"
                max="100"
                value={Math.round(p.volume[bus] * 100)}
                onChange={(e) =>
                  save({
                    ...p,
                    volume: {
                      ...p.volume,
                      [bus]: Number(e.target.value) / 100,
                    },
                  })
                }
              />
            </label>
          ))}
          <button
            className="action"
            onClick={() => {
              void audio.unlock().then(() => audio.cue("ui:preview", "ui"));
            }}
          >
            Preview sound
          </button>
        </section>
        <section className={panel} aria-labelledby="controls">
          <h2 id="controls">Controls</h2>
          <p className="text-sm text-slate-300">
            Choose a binding, then press a letter, number or Space. Escape
            cancels.
          </p>
          {(Object.keys(defaultKeys) as Action[]).map((action) => (
            <div className="binding" key={action}>
              <span>{labels[action]}</span>
              <button
                className="action"
                aria-label={"Rebind " + labels[action]}
                onClick={() => {
                  setListening(action);
                  status("");
                }}
                onBlur={() => setListening(null)}
                onKeyDown={(e) => {
                  if (listening !== action || e.key === "Tab") return;
                  e.preventDefault();
                  e.stopPropagation();
                  if (e.key === "Escape") {
                    setListening(null);
                    return;
                  }
                  const key = keyName(e.nativeEvent);
                  if (!validKey(key)) {
                    status("Choose a letter, number or Space.");
                    return;
                  }
                  if (
                    Object.entries(p.keys).some(
                      ([a, k]) => a !== action && k === key,
                    )
                  ) {
                    status(key + " is already assigned.");
                    return;
                  }
                  save({ ...p, keys: { ...p.keys, [action]: key } });
                  status(labels[action] + " assigned to " + key + ".");
                  setListening(null);
                }}
              >
                {listening === action ? "Press a key" : p.keys[action]}
              </button>
            </div>
          ))}
          <p role="status">{message}</p>
        </section>
        <section className={panel} aria-labelledby="display">
          <h2 id="display">Display & accessibility</h2>
          {(
            [
              ["reducedMotion", "Reduced motion"],
              ["shake", "Camera shake"],
              ["numbers", "Floating combat numbers"],
              ["contrast", "High contrast"],
            ] as const
          ).map(([key, label]) => (
            <label key={key}>
              <input
                type="checkbox"
                checked={p[key]}
                onChange={(e) => save({ ...p, [key]: e.target.checked })}
              />{" "}
              {label}
            </label>
          ))}
          <label className="slider">
            HUD scale <output>{Math.round(p.hudScale * 100)}%</output>
            <input
              type="range"
              min="85"
              max="135"
              step="5"
              value={Math.round(p.hudScale * 100)}
              onChange={(e) =>
                save({ ...p, hudScale: Number(e.target.value) / 100 })
              }
            />
          </label>
          <button
            className="action"
            onClick={() => {
              save({
                ...defaults,
                reducedMotion: matchMedia("(prefers-reduced-motion: reduce)")
                  .matches,
              });
              status("Defaults restored.");
            }}
          >
            Restore defaults
          </button>
        </section>
      </div>
    </PageShell>
  );
}
