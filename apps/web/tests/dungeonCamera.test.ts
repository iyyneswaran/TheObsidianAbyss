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
