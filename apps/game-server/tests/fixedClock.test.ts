import { it, expect, vi } from "vitest";
import { fixedClock } from "../src/party/fixedClock.js";
it("delivers thirty fixed steps per second with irregular callbacks", () => {
  const step = vi.fn(),
    tick = fixedClock(1000 / 30, step);
  for (let i = 0; i < 10; i++) {
    tick(17);
    tick(83);
  }
  expect(step).toHaveBeenCalledTimes(30);
});
it("bounds recovery work and ignores invalid time", () => {
  const step = vi.fn(),
    tick = fixedClock(10, step);
  expect(tick(5000)).toBe(4);
  expect(tick(NaN)).toBe(0);
  expect(tick(-10)).toBe(0);
  expect(tick(9)).toBe(0);
  expect(tick(1)).toBe(1);
});
