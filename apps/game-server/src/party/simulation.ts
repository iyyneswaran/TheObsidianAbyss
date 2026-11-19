import {
  movePlayer,
  playerFootprint,
  playerTerrain,
  resolvePlayerSpawn,
  type DungeonMap,
  type PlayerTransform,
} from "@obsidian/game-core";
import {
  INPUT_LEASE_MS,
  PARTY_SIZE,
  SIMULATION_HZ,
  type MoveInput,
} from "@obsidian/shared/coop";

export function partySpawns(map: DungeonMap): PlayerTransform[] {
  const home = resolvePlayerSpawn(map);
  const marker = map
    .zonesAt(home.x, home.y)
    .find(({ kind }) => kind === "player_spawn");
  if (!marker) throw new Error("The canonical spawn marker is missing.");
  const candidates = [home];
  for (
    let y = Math.floor(marker.y / map.tileHeight);
    y * map.tileHeight < marker.y + marker.height;
    y++
  ) {
    for (
      let x = Math.floor(marker.x / map.tileWidth);
      x * map.tileWidth < marker.x + marker.width;
      x++
    ) {
      candidates.push({
        ...home,
        x: (x + 0.5) * map.tileWidth,
        y: (y + 0.5) * map.tileHeight,
      });
    }
  }
  candidates.sort(
    (a, b) =>
      Math.hypot(a.x - home.x, a.y - home.y) -
      Math.hypot(b.x - home.x, b.y - home.y),
  );
  const result: PlayerTransform[] = [];
  for (const point of candidates) {
    const halfWidth = playerFootprint.width / 2;
    const halfHeight = playerFootprint.height / 2;
    if (
      point.x - halfWidth < marker.x ||
      point.x + halfWidth > marker.x + marker.width ||
      point.y - halfHeight < marker.y ||
      point.y + halfHeight > marker.y + marker.height
    )
      continue;
    const { solid, hazardous } = playerTerrain(map, point);
    if (
      solid ||
      hazardous ||
      result.some((seat) => footprintsOverlap(seat, point))
    )
      continue;
    result.push(point);
    if (result.length === PARTY_SIZE) return result;
  }
  throw new Error(
    "The spawn marker needs four safe, non-overlapping footprints.",
  );
}

export function footprintsOverlap(a: PlayerTransform, b: PlayerTransform) {
  return (
    Math.abs(a.x - b.x) < playerFootprint.width &&
    Math.abs(a.y - b.y) < playerFootprint.height
  );
}

export const stepMs = 1000 / SIMULATION_HZ;
export interface InputState {
  lastSequence: number;
  input: MoveInput | undefined;
  receivedAt: number;
  rateStart: number;
  rateCount: number;
}

export function emptyInput(): InputState {
  return {
    lastSequence: 0,
    input: undefined,
    receivedAt: 0,
    rateStart: 0,
    rateCount: 0,
  };
}

export function acceptInput(state: InputState, input: MoveInput, now: number) {
  if (input.sequence <= state.lastSequence) return false;
  if (now - state.rateStart >= 1000) {
    state.rateStart = now;
    state.rateCount = 0;
  }
  if (state.rateCount >= 32) return false;
  state.rateCount++;
  state.input = input;
  state.lastSequence = input.sequence;
  state.receivedAt = now;
  return true;
}

const idle = { x: 0, y: 0 };
export function simulatePlayer(
  map: DungeonMap,
  previous: PlayerTransform,
  input: InputState,
  now: number,
  speed = 1,
) {
  const sample =
    input.input && now - input.receivedAt < INPUT_LEASE_MS
      ? input.input
      : undefined;
  return movePlayer(
    map,
    previous,
    sample ? { x: sample.horizontal, y: sample.vertical } : idle,
    stepMs * speed,
  );
}
