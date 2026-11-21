export const defaultKeys = {
  up: "W",
  left: "A",
  down: "S",
  right: "D",
  BASIC: "Space",
  SKILL_1: "Q",
  SKILL_2: "E",
  SKILL_3: "R",
  ULTIMATE: "F",
  interact: "G",
  map: "M",
};
export type Action = keyof typeof defaultKeys;
export const levels = {
  master: 0.65,
  music: 0.45,
  ambience: 0.4,
  sfx: 0.8,
  ui: 0.55,
};
export type Bus = keyof typeof levels;
export const defaults = {
  enabled: true,
  muted: false,
  reducedMotion: false,
  shake: true,
  numbers: true,
  contrast: false,
  hudScale: 1,
  volume: levels,
  keys: defaultKeys,
};
export type Preferences = typeof defaults;
const storageKey = "obsidian.preferences.v1";
const clamp = (n: unknown, fallback: number, min = 0, max = 1) =>
  typeof n === "number" && Number.isFinite(n)
    ? Math.min(max, Math.max(min, n))
    : fallback;
export function validKey(value: unknown): value is string {
  return typeof value === "string" && /^(Space|[A-Z0-9])$/.test(value);
}
export function decodePreferences(
  raw: string | null,
  reduce = false,
): Preferences {
  const result = {
    ...defaults,
    reducedMotion: reduce,
    volume: { ...levels },
    keys: { ...defaultKeys },
  };
  try {
    const value = JSON.parse(raw ?? "{}");
    for (const k of [
      "enabled",
      "muted",
      "reducedMotion",
      "shake",
      "numbers",
      "contrast",
    ] as const)
      if (typeof value[k] === "boolean") result[k] = value[k];
    result.hudScale = clamp(value.hudScale, 1, 0.85, 1.35);
    for (const k of Object.keys(levels) as Bus[])
      result.volume[k] = clamp(value.volume?.[k], levels[k]);
    const keys = { ...defaultKeys, ...value.keys };
    if (
      Object.keys(defaultKeys).every((k) => validKey(keys[k])) &&
      new Set(Object.values(keys)).size === Object.keys(defaultKeys).length
    )
      result.keys = keys;
  } catch {
    /* Malformed or unavailable storage uses defaults. */
  }
  return result;
}
function read() {
  try {
    return decodePreferences(
      localStorage.getItem(storageKey),
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    );
  } catch {
    return decodePreferences(null);
  }
}
let current = read();
const listeners = new Set<() => void>();
export const preferences = () => current;
export function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
export function save(next: Preferences) {
  current = decodePreferences(JSON.stringify(next));
  try {
    localStorage.setItem(storageKey, JSON.stringify(current));
  } catch {
    /* Session settings still apply. */
  }
  listeners.forEach((fn) => fn());
}
export function keyName(e: KeyboardEvent) {
  return e.code === "Space" ? "Space" : e.code.replace(/^(Key|Digit)/, "");
}
export function gameInput(e: KeyboardEvent) {
  return (
    !e.repeat &&
    !e.ctrlKey &&
    !e.altKey &&
    !e.metaKey &&
    !(
      e.target instanceof Element &&
      e.target.closest(
        "input,select,textarea,[contenteditable=true],[role=dialog],dialog[open]",
      )
    ) &&
    !document.querySelector("[aria-modal=true]")
  );
}
