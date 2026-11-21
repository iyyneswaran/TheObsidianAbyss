import { loadouts, alternatives } from "@obsidian/game-core";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  defaults,
  decodePreferences,
  save,
  defaultKeys,
} from "../src/settings/preferences.js";
import {
  attenuation,
  combatCue,
  scoreNames,
  soundBuffer,
  Soundscape,
} from "../src/audio/sound.js";
function engine() {
  const voices: {
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
  }[] = [];
  const ctx = {
    state: "running",
    currentTime: 1,
    destination: {},
    resume: vi.fn(),
    createGain: () => ({
      gain: {
        value: 0,
        setTargetAtTime: vi.fn(),
        cancelScheduledValues: vi.fn(),
      },
      connect: vi.fn(),
      disconnect: vi.fn(),
    }),
    createBuffer: (_channels: number, len: number) => {
      const data = new Float32Array(len);
      return { getChannelData: () => data };
    },
    createBufferSource: () => {
      const source = {
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      };
      voices.push(source);
      return source;
    },
  };
  return { ctx: ctx as unknown as AudioContext, voices };
}
afterEach(() => save(defaults));
describe("local settings", () => {
  it("recovers from partial, corrupt and duplicate bindings", () => {
    expect(decodePreferences("{", true).reducedMotion).toBe(true);
    expect(decodePreferences('{"keys":{"map":"W"}}').keys).toEqual(defaultKeys);
    expect(
      decodePreferences('{"volume":{"master":5,"music":-1},"hudScale":99}'),
    ).toMatchObject({ volume: { master: 1, music: 0 }, hudScale: 1.35 });
  });
  it("preserves legitimate settings", () =>
    expect(
      decodePreferences(
        JSON.stringify({
          ...defaults,
          muted: true,
          keys: { ...defaultKeys, map: "N" },
        }),
      ),
    ).toMatchObject({ muted: true, keys: { map: "N" } }));
});
describe("Web Audio mixer", () => {
  it("maps every standard and alternate skill to its authoritative cast cue", () => {
    const effects = [
      ...Object.values(loadouts).flatMap((kit) =>
        Object.values(kit.abilities).map((ability) => ability.fx),
      ),
      ...alternatives.map((item) => item.fx),
    ];
    expect(effects.length).toBe(49);
    for (const fx of effects)
      expect(combatCue({ id: 1, kind: "cast", sound: fx, x: 0, y: 0 })).toBe(
        "cast:" + fx,
      );
    expect(combatCue({ id: 2, kind: "phase", amount: 3, x: 0, y: 0 })).toBe(
      "phase:3",
    );
  });
  it("assigns an authored score to every published world zone", () => {
    const map = JSON.parse(
      readFileSync(
        new URL("../public/assets/dungeon/expedition.tmj", import.meta.url),
        "utf8",
      ),
    ) as {
      layers: { objects?: { name: string; type?: string; class?: string }[] }[];
    };
    const zones = map.layers
      .flatMap((layer) => layer.objects ?? [])
      .filter((o) => (o.type || o.class) === "world_zone")
      .map((o) => o.name);
    expect(zones).toHaveLength(5);
    expect(scoreNames).toEqual([...zones, "overlord"]);
  });
  it("attenuates and silences distant sources", () => {
    expect(attenuation(0)).toBe(1);
    expect(attenuation(360)).toBe(0.25);
    expect(attenuation(900)).toBe(0);
  });
  it("generates six distinct scores and repeatable bounded PCM", () => {
    const { ctx } = engine();
    const samples = scoreNames.map(
      (zone) => soundBuffer(ctx, "music:" + zone, true).getChannelData(0)[2000],
    );
    expect(new Set(samples).size).toBe(6);
    const a = soundBuffer(ctx, "cast:fire", false).getChannelData(0);
    expect(a.every((v) => Number.isFinite(v) && Math.abs(v) <= 1)).toBe(true);
    expect(a).toEqual(soundBuffer(ctx, "cast:fire", false).getChannelData(0));
  });
  it("defers context creation, owns one score pair, fades changes and cleans up", async () => {
    const { ctx, voices } = engine(),
      create = vi.fn(() => ctx),
      audio = new Soundscape(create);
    audio.scene(scoreNames[0]!);
    expect(create).not.toHaveBeenCalled();
    await audio.unlock();
    await audio.unlock();
    audio.scene(scoreNames[0]!);
    expect(create).toHaveBeenCalledTimes(1);
    expect(voices).toHaveLength(2);
    audio.scene("overlord");
    expect(voices[0]!.stop).toHaveBeenCalled();
    expect(audio.diagnostics.loops).toBe(2);
    audio.visibility(true);
    expect(audio.diagnostics.loops).toBe(0);
    audio.visibility(false);
    audio.leave();
    expect(audio.diagnostics.loops).toBe(0);
  });
  it("suppresses duplicates, caps low-priority voices, honors mute and enable", async () => {
    const { ctx, voices } = engine(),
      audio = new Soundscape(() => ctx);
    save({ ...defaults, enabled: false });
    await audio.unlock();
    expect(audio.diagnostics.state).toBe("locked");
    save(defaults);
    await audio.unlock();
    audio.cue("one");
    audio.cue("one");
    expect(voices).toHaveLength(1);
    for (let i = 0; i < 20; i++) audio.cue("cast" + i);
    expect(audio.diagnostics.voices).toBe(12);
    audio.cue("phase", "sfx", 0, 5);
    expect(voices).toHaveLength(13);
    save({ ...defaults, muted: true });
    audio.cue("ui", "ui");
    expect(voices).toHaveLength(13);
  });
});
