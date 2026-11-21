import {
  preferences,
  subscribe,
  levels,
  type Bus,
} from "../settings/preferences.js";

import type { CombatEvent } from "@obsidian/game-core";
export function combatCue(event: CombatEvent) {
  const detail =
    event.kind === "phase"
      ? String(event.amount)
      : (event.sound ?? event.fx ?? event.kind);
  return event.kind + ":" + detail;
}
export const scoreNames = [
  "forsaken-entrance",
  "molten-passages",
  "forgotten-crypt",
  "corrupted-sanctum",
  "throne-of-the-shadow-overlord",
  "overlord",
];
// Original four-bar motifs. Each row has its own pulse, register and interval pattern.
const motifs = [
  [0, 7, 3, 10, 7, 2, 5, 3],
  [0, 0, 3, 7, 1, 0, 6, 3],
  [0, 12, 7, 2, 10, 5, 3, 7],
  [0, 6, 7, 1, 8, 3, 6, 1],
  [0, 3, 7, 10, 12, 7, 6, 3],
  [0, 7, 1, 6, 0, 10, 3, 6],
];
const roots = [110, 98, 130.81, 103.83, 82.41, 73.42];
const beats = [0.64, 0.43, 0.81, 0.52, 0.57, 0.34];
export function attenuation(distance: number) {
  return Math.max(0, 1 - distance / 720) ** 2;
}
export function soundBuffer(ctx: AudioContext, id: string, loop: boolean) {
  const [family, name] = id.split(":");
  const zone = Math.max(0, scoreNames.indexOf(name ?? ""));
  const beat = beats[zone]!;
  const duration = loop
    ? beat * 16
    : /phase|outcome|death/.test(id)
      ? 0.9
      : /cast|impact/.test(id)
        ? 0.32
        : 0.17;
  const rate = 22050;
  const buffer = ctx.createBuffer(1, Math.ceil(duration * rate), rate);
  const out = buffer.getChannelData(0);
  let seed = 2166136261;
  for (const c of id) seed = Math.imul(seed ^ c.charCodeAt(0), 16777619);
  const timbres: [RegExp, number][] = [
    [/fire|flame|lava/, 125],
    [/ice|frost|blizzard/, 530],
    [/lightning|thunder|zap/, 335],
    [/earth|rock|nature|quake/, 82],
    [/wind|tornado/, 250],
    [/heal|holy|sanctuary/, 440],
    [/shield|force|block/, 165],
  ];
  const pitch =
    (timbres.find(([pattern]) => pattern.test(id))?.[1] ?? 190) *
    (1 + ((seed >>> 0) % 230) / 1000);
  const tau = 2 * Math.PI;
  const bright = /lightning|ice|heal|ui/.test(id);
  for (let i = 0; i < out.length; i++) {
    const t = i / rate;
    if (family === "music") {
      const n = Math.floor(t / beat),
        phase = t % beat,
        root = roots[zone]!;
      const freq = root * 2 ** (motifs[zone]![n % 8]! / 12);
      const envelope = Math.min(1, phase * 22) * Math.exp(-phase * 4.8);
      out[i] =
        (0.32 * Math.sin(tau * freq * phase) +
          0.08 * Math.sin(tau * freq * 2 * phase)) *
          envelope +
        0.17 *
          Math.sin(tau * root * 0.5 * t) *
          Math.sin((Math.PI * t) / duration) ** 2;
    } else if (family === "ambience") {
      const base = (340 + zone * 73) / duration;
      out[i] =
        (0.24 * Math.sin(tau * base * t) +
          0.12 * Math.sin(tau * base * 3 * t)) *
        (0.4 + 0.6 * Math.sin((Math.PI * t) / duration) ** 2);
    } else {
      seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
      const env = Math.min(1, t * 110) * Math.exp((-5 * t) / duration);
      out[i] =
        env *
        (0.55 *
          Math.sin(
            tau * pitch * t * (bright ? 1 + t : 1 - (0.45 * t) / duration),
          ) +
          0.15 * Math.sin(tau * pitch * (bright ? 2.5 : 1.5) * t) +
          (0.14 * seed) / 2147483648);
    }
  }
  return buffer;
}
type Voice = {
  source: AudioBufferSourceNode;
  gain: GainNode;
  priority: number;
};
export class Soundscape {
  private ctx?: AudioContext;
  private buses = new Map<Bus, GainNode>();
  private cache = new Map<string, AudioBuffer>();
  private loops: Voice[] = [];
  private voices = new Set<Voice>();
  private last = new Map<string, number>();
  private zone = "";
  private playing = "";
  private hidden = false;
  constructor(private create = () => new AudioContext()) {}
  async unlock() {
    if (!preferences().enabled || this.hidden) return;
    try {
      if (!this.ctx) {
        const ctx = this.create();
        this.ctx = ctx;
        for (const bus of Object.keys(levels) as Bus[]) {
          const node = ctx.createGain();
          node.connect(
            bus === "master" ? ctx.destination : this.buses.get("master")!,
          );
          this.buses.set(bus, node);
        }
      }
      if (this.ctx.state === "suspended") await this.ctx.resume();
      this.sync();
    } catch {
      /* Browsers may deny audio until another activation. */
    }
  }
  sync() {
    const ctx = this.ctx;
    if (!ctx) return;
    const prefs = preferences();
    for (const [bus, gain] of this.buses)
      gain.gain.setTargetAtTime(
        bus === "master" && (!prefs.enabled || prefs.muted || this.hidden)
          ? 0
          : prefs.volume[bus],
        ctx.currentTime,
        0.025,
      );
    const target =
      prefs.enabled && !prefs.muted && !this.hidden ? this.zone : "";
    if (target === this.playing) return;
    this.stopLoops();
    this.playing = target;
    if (target)
      for (const bus of ["music", "ambience"] as const) {
        const voice = this.start(bus + ":" + target, bus, true, 1, 0);
        if (voice) this.loops.push(voice);
      }
  }
  scene(zone: string) {
    if (zone === this.zone) return;
    this.zone = zone;
    this.sync();
  }
  visibility(hidden: boolean) {
    this.hidden = hidden;
    this.sync();
    if (hidden) this.clearVoices();
  }
  private stopLoops() {
    for (const voice of this.loops) {
      const now = this.ctx!.currentTime;
      voice.gain.gain.cancelScheduledValues(now);
      voice.gain.gain.setTargetAtTime(0, now, 0.075);
      voice.source.stop(now + 0.35);
    }
    this.loops = [];
  }
  private clearVoices() {
    for (const v of this.voices) v.source.stop();
    this.voices.clear();
    this.last.clear();
  }
  leave() {
    this.scene("");
    this.clearVoices();
  }
  private start(
    id: string,
    bus: Bus,
    loop: boolean,
    volume: number,
    priority: number,
  ) {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== "running") return;
    let buffer = this.cache.get(id);
    if (!buffer) {
      buffer = soundBuffer(ctx, id, loop);
      if (this.cache.size >= 80)
        this.cache.delete(this.cache.keys().next().value!);
      this.cache.set(id, buffer);
    }
    const source = ctx.createBufferSource(),
      gain = ctx.createGain();
    source.buffer = buffer;
    source.loop = loop;
    source.connect(gain);
    gain.connect(this.buses.get(bus)!);
    gain.gain.value = loop ? 0 : volume;
    if (loop) gain.gain.setTargetAtTime(volume, ctx.currentTime, 0.15);
    const voice = { source, gain, priority };
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
      this.voices.delete(voice);
    };
    source.start();
    return voice;
  }
  cue(id: string, bus: "sfx" | "ui" = "sfx", distance = 0, priority = 1) {
    const prefs = preferences(),
      ctx = this.ctx;
    const volume = attenuation(distance);
    if (
      !ctx ||
      ctx.state !== "running" ||
      !prefs.enabled ||
      prefs.muted ||
      this.hidden ||
      !volume
    )
      return;
    if (
      ctx.currentTime - (this.last.get(id) ?? -Infinity) <
      (id === "step" ? 0.26 : 0.09)
    )
      return;
    if (this.voices.size >= 12) {
      const old = [...this.voices].find((v) => v.priority < priority);
      if (!old) return;
      old.source.stop();
      this.voices.delete(old);
    }
    const v = this.start(id, bus, false, volume, priority);
    if (v) {
      this.voices.add(v);
      this.last.set(id, ctx.currentTime);
    }
  }
  get diagnostics() {
    return {
      state: this.ctx?.state ?? "locked",
      loops: this.loops.length,
      voices: this.voices.size,
      cached: this.cache.size,
      score: this.playing,
    };
  }
}
export const audio = new Soundscape();
export function mountSound() {
  function unlock(e: Event) {
    if (e.isTrusted) void audio.unlock();
  }
  function click(e: MouseEvent) {
    if (e.target instanceof Element && e.target.closest("button,a"))
      audio.cue("ui:select", "ui");
  }
  const visibility = () => audio.visibility(document.hidden);
  document.addEventListener("pointerdown", unlock);
  document.addEventListener("keydown", unlock);
  document.addEventListener("click", click);
  document.addEventListener("visibilitychange", visibility);
  const off = subscribe(() => audio.sync());
  return () => {
    off();
    audio.leave();
    document.removeEventListener("pointerdown", unlock);
    document.removeEventListener("keydown", unlock);
    document.removeEventListener("click", click);
    document.removeEventListener("visibilitychange", visibility);
  };
}
