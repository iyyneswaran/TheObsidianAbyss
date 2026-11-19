import { expect, it } from "vitest";
import { createDungeonCamera } from "../src/game/dungeon/camera.js";

const view = { width: 640, height: 360 };
const world = { width: 2560, height: 2048 };
const home = { x: 640, y: 528 };

it("initializes centered at the entrance and restores home and zoom", () => {
  const camera = createDungeonCamera(view, world, home);
  expect(camera.state).toEqual({ ...home, zoom: 0.5 });
  camera.zoomBy(1);
  camera.zoomBy(1);
  camera.focus({ x: 1328, y: 1488 });
  expect(camera.state).toEqual({ x: 1328, y: 1488, zoom: 2 });
  camera.reset();
  expect(camera.state).toEqual({ ...home, zoom: 0.5 });
});

it("moves by elapsed time with normalized diagonal speed", () => {
  const camera = createDungeonCamera(view, world, home);
  camera.pan(1, -1, 250);
  expect(
    Math.hypot(camera.state.x - home.x, camera.state.y - home.y),
  ).toBeCloseTo(110);
  const once = camera.state;
  camera.reset();
  for (let frame = 0; frame < 25; frame++) camera.pan(1, -1, 10);
  expect(camera.state.x).toBeCloseTo(once.x);
  expect(camera.state.y).toBeCloseTo(once.y);
});

it("limits zoom steps and clamps the visible viewport to every map edge", () => {
  const camera = createDungeonCamera(view, world, home);
  camera.zoomBy(-1);
  camera.zoomBy(-1);
  camera.zoomBy(-1);
  expect(camera.state.zoom).toBe(0.25);
  camera.pan(-1, -1, 10_000);
  expect(camera.state).toEqual({ x: 1280, y: 720, zoom: 0.25 });
  camera.pan(1, 1, 10_000);
  expect(camera.state).toEqual({ x: 1280, y: 1328, zoom: 0.25 });

  for (let i = 0; i < 5; i++) camera.zoomBy(1);
  expect(camera.state.zoom).toBe(2);
  camera.pan(1, 1, 30_000);
  expect(camera.state).toEqual({ x: 2400, y: 1958, zoom: 2 });
});

it("follows smoothly with equivalent elapsed time and clamps its follow target", () => {
  const camera = createDungeonCamera(view, world, home, 1);
  const target = { x: 900, y: 720 };
  camera.follow(target, 160);
  const once = camera.state;
  expect(once.x).toBeGreaterThan(home.x);
  expect(once.x).toBeLessThan(target.x);
  camera.reset();
  for (let i = 0; i < 10; i++) camera.follow(target, 16);
  expect(camera.state.x).toBeCloseTo(once.x);
  expect(camera.state.y).toBeCloseTo(once.y);
  camera.follow({ x: -15, y: -10 }, 10_000);
  expect(camera.state).toEqual({ x: 320, y: 180, zoom: 1 });
});
