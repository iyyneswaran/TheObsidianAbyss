import { readFileSync } from "node:fs";
import { effects, type PixelFxAtlas } from "@obsidian/game-assets";
import { gameViewport } from "@obsidian/game-core";
import { localPorts, TEST_ROOM } from "@obsidian/shared";
import { expect, it } from "vitest";

it("resolves shared contracts and the logical game viewport from the web workspace", () => {
  expect(localPorts.web).toBe(5173);
  expect(TEST_ROOM).toBe("test_room");
  expect(gameViewport).toEqual({ width: 640, height: 360 });
});

it("provides a PNG and compatible Aseprite frame metadata for each registered effect", () => {
  for (const effect of Object.values(effects)) {
    const asset = (path: string) =>
      new URL(`../public/${path}`, import.meta.url);
    const image = readFileSync(asset(effect.texturePath));
    const atlas = JSON.parse(
      readFileSync(asset(effect.metadataPath), "utf8"),
    ) as PixelFxAtlas;
    const { pixelfx, size } = atlas.meta;
    const [width, height] = pixelfx.frameSize;

    expect(image.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    expect(image.readUInt32BE(16)).toBe(size.w);
    expect(image.readUInt32BE(20)).toBe(size.h);
    expect(effect.texturePath.endsWith(`/${atlas.meta.image}`)).toBe(true);
    expect(pixelfx.id).toBe(effect.id);
    expect(pixelfx.fps).toBeGreaterThan(0);
    expect(atlas.frames.length).toBe(pixelfx.frames);
    expect(atlas.frames.length).toBeGreaterThan(1);
    expect(new Set(atlas.frames.map(({ filename }) => filename)).size).toBe(
      atlas.frames.length,
    );
    expect(pixelfx.pivot[0]).toBeGreaterThanOrEqual(0);
    expect(pixelfx.pivot[0]).toBeLessThan(width);
    expect(pixelfx.pivot[1]).toBeGreaterThanOrEqual(0);
    expect(pixelfx.pivot[1]).toBeLessThan(height);

    for (const { filename, duration, frame } of atlas.frames) {
      expect(filename).toBeTruthy();
      expect(duration).toBeGreaterThan(0);
      expect(frame.w).toBe(width);
      expect(frame.h).toBe(height);
      expect(frame.x).toBeGreaterThanOrEqual(0);
      expect(frame.y).toBeGreaterThanOrEqual(0);
      expect(frame.x + frame.w).toBeLessThanOrEqual(size.w);
      expect(frame.y + frame.h).toBeLessThanOrEqual(size.h);
    }
  }
});
