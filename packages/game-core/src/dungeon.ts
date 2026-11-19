type TiledProperty = { name: string; value: string | number | boolean };

export interface TiledTile {
  id: number;
  properties?: TiledProperty[];
  animation?: { tileid: number; duration: number }[];
}

export interface TiledTileset {
  name: string;
  image: string;
  firstgid: number;
  tilecount: number;
  tilewidth: number;
  tileheight: number;
  tiles?: TiledTile[];
}

interface TiledTileLayer {
  name: string;
  type: "tilelayer";
  x: number;
  y: number;
  width: number;
  height: number;
  data: number[];
}

interface TiledObjectLayer {
  name: string;
  type: "objectgroup";
  objects: {
    id: number;
    name: string;
    type?: string;
    class?: string;
    x: number;
    y: number;
    width: number;
    height: number;
    properties?: TiledProperty[];
  }[];
}

export interface TiledDungeonMap {
  orientation: string;
  infinite: boolean;
  width: number;
  height: number;
  tilewidth: number;
  tileheight: number;
  layers: (TiledTileLayer | TiledObjectLayer)[];
  tilesets: TiledTileset[];
}

export const dungeonLayerDepths = {
  Ground: 0,
  GroundDetails: 10,
  Lava: 20,
  LavaEdges: 30,
  Walls: 40,
  Obstacles: 50,
  Decorations: 60,
  Overhead: 80,
} as const;

export interface DungeonZone {
  id: string;
  objectId: number;
  kind: string;
  x: number;
  y: number;
  width: number;
  height: number;
  properties: Readonly<Record<string, TiledProperty["value"]>>;
}

export type DungeonTerrain = "floor" | "lava" | "solid" | "void";
export interface DungeonCell {
  terrain: DungeonTerrain;
  /** Safe ground for route planning. Lava is separately enterable by future mechanics. */
  walkable: boolean;
  solid: boolean;
  hazardous: boolean;
  blocksSight: boolean;
}

const emptyCell: DungeonCell = {
  terrain: "void",
  walkable: false,
  solid: true,
  hazardous: false,
  blocksSight: true,
};

function describeCell(
  terrain: DungeonTerrain,
  blocksSight: boolean,
): DungeonCell {
  if (terrain === "void") return emptyCell;
  return {
    terrain,
    walkable: terrain === "floor",
    solid: terrain === "solid",
    hazardous: terrain === "lava",
    blocksSight,
  };
}

export function readDungeonMap(map: TiledDungeonMap) {
  const { width, height, tilewidth: tileWidth, tileheight: tileHeight } = map;
  if (
    map.infinite ||
    map.orientation !== "orthogonal" ||
    ![width, height, tileWidth, tileHeight].every(
      (n) => Number.isInteger(n) && n > 0,
    )
  ) {
    throw new Error("Expected a finite orthogonal Tiled map.");
  }

  const metadata = new Map<number, DungeonCell>();
  for (const tileset of map.tilesets) {
    if (
      tileset.tilewidth !== tileWidth ||
      tileset.tileheight !== tileHeight ||
      !tileset.image
    ) {
      throw new Error(
        `Expected an embedded grid tileset matching the map. Check ${tileset.name}.`,
      );
    }
    for (const tile of tileset.tiles ?? []) {
      const terrain = tile.properties?.find(
        ({ name }) => name === "terrain",
      )?.value;
      if (terrain === "floor" || terrain === "solid" || terrain === "lava") {
        const blocksSight =
          tile.properties?.some(
            ({ name, value }) => name === "blocksSight" && value === true,
          ) ?? false;
        metadata.set(
          tileset.firstgid + tile.id,
          describeCell(terrain, blocksSight),
        );
      }
    }
  }

  const precedence = { void: 0, floor: 1, lava: 2, solid: 3 };
  const cells = Array.from({ length: width * height }, () => emptyCell);
  const tileLayers = new Map(
    map.layers
      .filter((layer) => layer.type === "tilelayer")
      .map((layer) => [layer.name, layer]),
  );
  for (const name of Object.keys(dungeonLayerDepths)) {
    const layer = tileLayers.get(name);
    if (
      !layer ||
      layer.x !== 0 ||
      layer.y !== 0 ||
      layer.width !== width ||
      layer.height !== height ||
      !Array.isArray(layer.data) ||
      layer.data.length !== cells.length
    ) {
      throw new Error(`Missing or invalid dungeon layer ${name}.`);
    }
  }
  for (const layer of tileLayers.values()) {
    if (
      layer.x !== 0 ||
      layer.y !== 0 ||
      layer.width !== width ||
      layer.height !== height ||
      !Array.isArray(layer.data) ||
      layer.data.length !== cells.length
    ) {
      throw new Error(
        `Expected an aligned, uncompressed grid for ${layer.name}.`,
      );
    }
    layer.data.forEach((raw, i) => {
      const gid = raw & 0x0fffffff; // Clear Tiled's rotation and flip flags.
      const cell = metadata.get(gid);
      if (cell && precedence[cell.terrain] > precedence[cells[i]!.terrain])
        cells[i] = cell;
    });
  }

  const zoneLayer = map.layers.find(
    (layer) => layer.type === "objectgroup" && layer.name === "ObjectZones",
  );
  if (zoneLayer?.type !== "objectgroup")
    throw new Error("Missing ObjectZones layer.");

  const zones: DungeonZone[] = zoneLayer.objects.map((object) => ({
    id: object.name,
    objectId: object.id,
    kind: object.class || object.type || "",
    x: object.x,
    y: object.y,
    width: object.width,
    height: object.height,
    properties: Object.fromEntries(
      (object.properties ?? []).map(({ name, value }) => [name, value]),
    ),
  }));

  const worldWidth = width * tileWidth;
  const worldHeight = height * tileHeight;
  if (
    new Set(zones.map(({ id }) => id)).size !== zones.length ||
    new Set(zones.map(({ objectId }) => objectId)).size !== zones.length ||
    zones.some(
      (z) =>
        !z.id ||
        !z.kind ||
        z.x < 0 ||
        z.y < 0 ||
        z.width <= 0 ||
        z.height <= 0 ||
        z.x + z.width > worldWidth ||
        z.y + z.height > worldHeight,
    )
  )
    throw new Error(
      "ObjectZones requires uniquely named, typed rectangles inside the map.",
    );

  function atTile(x: number, y: number): DungeonCell {
    if (
      !Number.isInteger(x) ||
      !Number.isInteger(y) ||
      x < 0 ||
      x >= width ||
      y < 0 ||
      y >= height
    )
      return emptyCell;
    return cells[y * width + x]!;
  }

  function worldToTile(x: number, y: number) {
    return { x: Math.floor(x / tileWidth), y: Math.floor(y / tileHeight) };
  }

  return {
    width,
    height,
    tileWidth,
    tileHeight,
    worldWidth,
    worldHeight,
    zones,
    atTile,
    worldToTile,
    atWorld(x: number, y: number) {
      const tile = worldToTile(x, y);
      return atTile(tile.x, tile.y);
    },
    zonesAt(x: number, y: number) {
      return zones.filter(
        (zone) =>
          x >= zone.x &&
          x < zone.x + zone.width &&
          y >= zone.y &&
          y < zone.y + zone.height,
      );
    },
  };
}

export type DungeonMap = ReturnType<typeof readDungeonMap>;
