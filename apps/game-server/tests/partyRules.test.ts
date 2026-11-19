import { expect, it } from "vitest";
import { playerTerrain } from "@obsidian/game-core";
import {
  movementSchema,
  needsIncompleteConfirmation,
  partyRequestSchema,
  teamCodeSchema,
  wizardClassSchema,
} from "@obsidian/shared/coop";
import { generateTeamCode } from "../src/party/directory.js";
import {
  acceptInput,
  emptyInput,
  footprintsOverlap,
  partySpawns,
  simulatePlayer,
  stepMs,
} from "../src/party/simulation.js";
import { loadCanonicalMap } from "../src/server.js";

it("generates a valid private code and retries collisions", () => {
  expect(teamCodeSchema.safeParse(generateTeamCode(() => false)).success).toBe(
    true,
  );
  let queries = 0;
  const code = generateTeamCode(
    () => ++queries === 1,
    () => queries,
  );
  expect(queries).toBe(2);
  expect(code).toBe("333333");
  expect(() => generateTeamCode(() => true)).toThrow();
});

it("validates seven classes, normalized codes, and exact request shapes", () => {
  expect(wizardClassSchema.options).toHaveLength(7);
  expect(
    partyRequestSchema.parse({
      action: "join",
      code: " ab7k92 ",
      wizard: "ice",
    }),
  ).toMatchObject({ code: "AB7K92" });
  expect(
    partyRequestSchema.safeParse({ action: "create", wizard: "unknown" })
      .success,
  ).toBe(false);
  expect(
    partyRequestSchema.safeParse({
      action: "reconnect",
      code: "AB7K92",
      playerId: "forged",
    }).success,
  ).toBe(false);
});

it("requires confirmation for one, two or three connected players and permits a full team", () => {
  expect([1, 2, 3, 4].map(needsIncompleteConfirmation)).toEqual([
    true,
    true,
    true,
    false,
  ]);
});

it("rejects invalid directions, nonfinite sequences, elapsed time, and position fields", () => {
  const valid = { horizontal: -1, vertical: 1, sequence: 1 };
  expect(movementSchema.safeParse(valid).success).toBe(true);
  for (const payload of [
    { ...valid, horizontal: 2 },
    { ...valid, sequence: Infinity },
    { ...valid, sequence: -1 },
    { ...valid, x: 2000 },
    { ...valid, dt: 10000 },
  ]) {
    expect(movementSchema.safeParse(payload).success).toBe(false);
  }
});

it("keeps only the latest input, ignores duplicates and old sequences, and bounds floods", () => {
  const recent = emptyInput();
  const movement = { horizontal: 1, vertical: 0, sequence: 5 } as const;
  expect(acceptInput(recent, movement, 100)).toBe(true);
  expect(acceptInput(recent, { ...movement, sequence: 3 }, 101)).toBe(false);
  expect(acceptInput(recent, movement, 102)).toBe(false);
  for (let i = 6; i <= 36; i++)
    expect(acceptInput(recent, { ...movement, sequence: i }, 150)).toBe(true);
  expect(acceptInput(recent, { ...movement, sequence: 37 }, 151)).toBe(false);
  expect(recent.input?.sequence).toBe(36);
  expect(acceptInput(recent, { ...movement, sequence: 37 }, 1151)).toBe(true);
});

const map = loadCanonicalMap();
it("assigns four safe deterministic footprints in the canonical marker", () => {
  const seats = partySpawns(map);
  expect(seats).toHaveLength(4);
  expect(partySpawns(map)).toEqual(seats);
  seats.forEach((seat, i) => {
    expect(
      map.zonesAt(seat.x, seat.y).some(({ kind }) => kind === "player_spawn"),
    ).toBe(true);
    expect(playerTerrain(map, seat)).toEqual({
      solid: false,
      hazardous: false,
    });
    expect(
      seats.slice(i + 1).some((other) => footprintsOverlap(seat, other)),
    ).toBe(false);
  });
});

it("advances fixed-size normalized movement and lets stale keys expire", () => {
  const seat = partySpawns(map)[0]!;
  const input = emptyInput();
  acceptInput(input, { horizontal: 1, vertical: 1, sequence: 1 }, 1000);
  const after = simulatePlayer(map, seat, input, 1010);
  expect(Math.hypot(after.x - seat.x, after.y - seat.y)).toBeCloseTo(
    (144 * stepMs) / 1000,
  );
  expect(simulatePlayer(map, after, input, 1301)).toMatchObject({
    x: after.x,
    y: after.y,
    moving: false,
  });
});
