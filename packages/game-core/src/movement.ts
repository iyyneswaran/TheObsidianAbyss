import type { DungeonMap } from "./dungeon.js";

export const playerSpeed = 144;
export const playerFootprint = { width: 14, height: 10 } as const;

export type Facing = "up" | "down" | "left" | "right";

export interface WorldPoint {
  x: number;
  y: number;
}

export interface PlayerTransform extends WorldPoint {
  facing: Facing;
  moving: boolean;
}

type TerrainGrid = Pick<DungeonMap, "tileWidth" | "tileHeight" | "atTile">;
type Axis = keyof WorldPoint;

const halfWidth = playerFootprint.width / 2;
const halfHeight = playerFootprint.height / 2;

export function normalizeMovement(input: WorldPoint): WorldPoint {
  const length = Math.hypot(input.x, input.y);
  return Number.isFinite(length) && length > 0
    ? { x: input.x / length, y: input.y / length }
    : { x: 0, y: 0 };
}

/** A diagonal uses its vertical direction when both axes have the same magnitude. */
export function playerFacing(input: WorldPoint, previous: Facing): Facing {
  if (!input.x && !input.y) return previous;
  if (Math.abs(input.y) >= Math.abs(input.x))
    return input.y < 0 ? "up" : "down";
  return input.x < 0 ? "left" : "right";
}

export function playerTerrain(map: TerrainGrid, position: WorldPoint) {
  const maxX = Math.ceil((position.x + halfWidth) / map.tileWidth);
  const maxY = Math.ceil((position.y + halfHeight) / map.tileHeight);
  let solid = false;
  let hazardous = false;
  for (
    let y = Math.floor((position.y - halfHeight) / map.tileHeight);
    y < maxY;
    y++
  ) {
    for (
      let x = Math.floor((position.x - halfWidth) / map.tileWidth);
      x < maxX;
      x++
    ) {
      const cell = map.atTile(x, y);
      solid ||= cell.solid;
      hazardous ||= cell.hazardous;
    }
  }
  return { solid, hazardous };
}

function sweepAxis(
  map: TerrainGrid,
  point: WorldPoint,
  axis: Axis,
  distance: number,
) {
  if (!distance) return point[axis];

  const horizontal = axis === "x";
  const size = horizontal ? map.tileWidth : map.tileHeight;
  const crossSize = horizontal ? map.tileHeight : map.tileWidth;
  const radius = horizontal ? halfWidth : halfHeight;
  const crossRadius = horizontal ? halfHeight : halfWidth;
  const across = horizontal ? point.y : point.x;
  const minCross = Math.floor((across - crossRadius) / crossSize);
  const maxCross = Math.ceil((across + crossRadius) / crossSize);
  const sign = distance > 0 ? 1 : -1;

  // Scan every tile newly intersected by the leading edge. The footprint is half-open.
  const leading = point[axis] + sign * radius;
  const end = leading + distance;
  const first =
    sign === 1 ? Math.ceil(leading / size) : Math.floor(leading / size) - 1;
  const last = sign === 1 ? Math.ceil(end / size) - 1 : Math.floor(end / size);

  for (let tile = first; sign * tile <= sign * last; tile += sign) {
    for (let cross = minCross; cross < maxCross; cross++) {
      const cell = horizontal
        ? map.atTile(tile, cross)
        : map.atTile(cross, tile);
      if (cell.solid) return (tile + (sign < 0 ? 1 : 0)) * size - sign * radius;
    }
  }
  return point[axis] + distance;
}

export function movePlayer(
  map: TerrainGrid,
  previous: PlayerTransform,
  input: WorldPoint,
  milliseconds: number,
): PlayerTransform {
  const direction = normalizeMovement(input);
  const distance = Number.isFinite(milliseconds)
    ? (playerSpeed * Math.max(0, milliseconds)) / 1000
    : 0;
  const x = sweepAxis(map, previous, "x", direction.x * distance);
  const y = sweepAxis(map, { x, y: previous.y }, "y", direction.y * distance);
  return {
    x,
    y,
    facing: playerFacing(direction, previous.facing),
    moving: x !== previous.x || y !== previous.y,
  };
}

export function resolvePlayerSpawn(
  map: TerrainGrid & Pick<DungeonMap, "zones">,
): PlayerTransform {
  const markers = map.zones
    .filter(({ kind }) => kind === "player_spawn")
    .sort((a, b) => a.objectId - b.objectId);
  for (const zone of markers) {
    const center = { x: zone.x + zone.width / 2, y: zone.y + zone.height / 2 };
    const minX = zone.x + halfWidth;
    const maxX = zone.x + zone.width - halfWidth;
    const minY = zone.y + halfHeight;
    const maxY = zone.y + zone.height - halfHeight;
    function isValid(point: WorldPoint) {
      if (point.x < minX || point.x > maxX || point.y < minY || point.y > maxY)
        return false;
      const { solid, hazardous } = playerTerrain(map, point);
      return !solid && !hazardous;
    }

    if (isValid(center)) return { ...center, facing: "down", moving: false };

    let best: WorldPoint | undefined;
    let distance = Infinity;
    for (
      let y = Math.floor(zone.y / map.tileHeight);
      y < Math.ceil((zone.y + zone.height) / map.tileHeight);
      y++
    ) {
      for (
        let x = Math.floor(zone.x / map.tileWidth);
        x < Math.ceil((zone.x + zone.width) / map.tileWidth);
        x++
      ) {
        const point = {
          x: (x + 0.5) * map.tileWidth,
          y: (y + 0.5) * map.tileHeight,
        };
        const offset = (point.x - center.x) ** 2 + (point.y - center.y) ** 2;
        if (offset < distance && isValid(point)) {
          best = point;
          distance = offset;
        }
      }
    }
    if (best) return { ...best, facing: "down", moving: false };
  }

  throw new Error("The dungeon has no safe player spawn.");
}
