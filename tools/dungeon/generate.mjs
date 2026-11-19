import { mkdirSync, writeFileSync } from "node:fs";
import { noise } from "./pixels.mjs";
import { lightTexture, paintTiles } from "./tiles.mjs";

const width = 80;
const height = 64;
const size = 32;
const combat = process.argv.includes("--combat");
const { ids, image, definition } = paintTiles();
const names = [
  "Ground",
  "GroundDetails",
  "Lava",
  "LavaEdges",
  "Walls",
  "Obstacles",
  "Decorations",
  "Overhead",
];
const layers = Object.fromEntries(
  names.map((name) => [name, Array(width * height).fill(0)]),
);
const index = (x, y) => y * width + x;
const set = (name, x, y, gid) => (layers[name][index(x, y)] = gid);
const get = (name, x, y) =>
  x >= 0 &&
  x < width &&
  y >= 0 &&
  y < height &&
  layers[name][index(x, y)] !== 0;

function area(rect, visit) {
  const [left, top, w, h] = rect;
  for (let y = top; y < top + h; y++) {
    for (let x = left; x < left + w; x++) visit(x, y);
  }
}

function pick(list, x, y, seed = 1) {
  return list[Math.floor(noise(x, y, seed) * list.length)];
}

const objects = [];
function zone(name, type, rect, properties = {}) {
  const [x, y, w, h] = rect.map((value) => value * size);
  objects.push({
    id: objects.length + 1,
    name,
    type,
    x,
    y,
    width: w,
    height: h,
    rotation: 0,
    visible: true,
    properties: Object.entries(properties).map(([name, value]) => ({
      name,
      value,
      type:
        typeof value === "boolean"
          ? "bool"
          : typeof value === "number"
            ? "int"
            : "string",
    })),
  });
}

function stoneFloor(rect, art = ids.floor) {
  area(rect, (x, y) => set("Ground", x, y, pick(art, x, y)));
}

function lavaPool(rect, name) {
  area(rect, (x, y) => {
    set("Ground", x, y, 0);
    set("Lava", x, y, ids.lava[(x % 2) + 2 * (y % 2)]);
  });
  zone(name, "lava_hazard", rect);
}

function hideout(name, rect) {
  stoneFloor(rect, ids.shadow);
  zone(name, "hiding_area", rect);
}

// Step the room silhouettes in and out like the original concept sketch.
const rooms = [
  {
    id: "room_a",
    title: "Forsaken Entrance",
    bounds: [7, 6, 25, 21],
    focus: [18, 16],
    floor: [
      [10, 8, 19, 19],
      [7, 11, 25, 13],
      [8, 24, 22, 3],
      [13, 6, 5, 4],
    ],
  },
  {
    id: "room_b",
    title: "Molten Guard Chamber",
    bounds: [44, 7, 29, 22],
    focus: [63, 17.5],
    floor: [
      [47, 7, 22, 22],
      [44, 11, 29, 15],
      [46, 9, 25, 18],
    ],
  },
  {
    id: "room_c",
    title: "Sanctuary of the Azure Flame",
    bounds: [25, 39, 31, 18],
    focus: [41, 46],
    floor: [
      [29, 39, 23, 18],
      [25, 43, 31, 11],
      [27, 41, 27, 15],
    ],
  },
];

for (const room of rooms) {
  room.floor.forEach((rect) => stoneFloor(rect));
  zone(room.id, "room", room.bounds, {
    title: room.title,
    cameraX: (room.focus[0] + 0.5) * size,
    cameraY: (room.focus[1] + 0.5) * size,
  });
}

const corridors = [
  {
    name: "entrance_to_guard",
    from: "room_a",
    to: "room_b",
    rects: [
      [31, 13, 8, 4],
      [36, 15, 7, 4],
      [40, 17, 6, 4],
    ],
  },
  {
    name: "entrance_to_sanctuary",
    from: "room_a",
    to: "room_c",
    rects: [
      [18, 26, 4, 8],
      [18, 31, 22, 4],
      [36, 33, 4, 8],
    ],
  },
];
for (const { name, from, to, rects } of corridors) {
  rects.forEach((rect, i) => {
    stoneFloor(rect);
    zone(name + "_" + (i + 1), "room_connection", rect, {
      from,
      to,
      segment: i + 1,
    });
  });
}

for (const rect of [
  [14, 6, 3, 7],
  [44, 17, 28, 2],
  [36, 39, 4, 4],
  [37, 45, 9, 5],
]) {
  area(rect, (x, y) => {
    if (get("Ground", x, y)) set("Ground", x, y, pick(ids.paving, x, y));
  });
}

lavaPool([7, 18, 3, 6], "lava_entrance_west");
lavaPool([8, 24, 6, 2], "lava_entrance_bend");
lavaPool([8, 26, 10, 2], "lava_entrance_south");
lavaPool([60, 6, 5, 6], "lava_guard_head");
lavaPool([62, 12, 4, 5], "lava_guard_north");
lavaPool([62, 19, 4, 5], "lava_guard_south");
lavaPool([60, 24, 6, 6], "lava_guard_tail");
lavaPool([29, 54, 8, 3], "lava_sanctuary_west");
lavaPool([37, 55, 8, 3], "lava_sanctuary_center");
lavaPool([45, 54, 7, 3], "lava_sanctuary_east");
area([62, 17, 4, 2], (x, y) => {
  const end = x === 62 || x === 65;
  set("Ground", x, y, ids.bridge[y - 17 + (end ? 2 : 0)]);
});
zone("bridge", "bridge", [62, 17, 4, 2]);

hideout("hiding_entrance", [10, 14, 3, 3]);
hideout("hiding_guard", [48, 9, 4, 3]);
hideout("hiding_sanctuary", [51, 43, 3, 3]);
zone("player_spawn", "player_spawn", [13, 9, 5, 3]);
zone("monster_patrol_zone", "monster_patrol_zone", [55, 19, 5, 3]);
zone("mana_shrine", "mana_shrine", [40, 42, 3, 3]);
zone("mana_restoration_zone", "mana_restoration_zone", [38, 45, 7, 4], {
  safe: true,
});
zone("shrine_safe_area", "safe_area", [37, 45, 9, 5], { safe: true });

if (combat) {
  for (const [id, title, region, spawn, enemy] of [
    ["entrance", "Forsaken Entrance", [10, 8, 19, 19], [15, 14], "shadow"],
    ["guard", "Molten Guard Chamber", [47, 8, 22, 19], [56, 21], "lava"],
    ["approach", "Sanctuary Approach", [34, 39, 6, 6], [34, 42], "mage"],
  ]) {
    zone(id, "combat_region", region, { title });
    zone(id + "_spawn", "combat_spawn", [...spawn, 1, 1], {
      encounter: id,
      enemy,
    });
  }
  zone("shadow_gate", "boss_gate", [47, 46, 1, 1]);
  zone("eclipse_arena", "boss_arena", [56, 35, 21, 21]);
  zone("overlord_dais", "boss_spawn", [67, 43, 1, 1]);
  area([57, 36, 19, 19], (x, y) => {
    const distance = Math.hypot(x - 66, y - 45);
    if (distance > 9.15) return;
    if (distance > 7.7 && Math.abs(x - 66) > 4 && Math.abs(y - 45) > 4) {
      set("Lava", x, y, ids.lava[(x % 2) + 2 * (y % 2)]);
      return;
    }
    const ground = distance < 4.4 ? ids.paving : ids.shadow;
    set("Ground", x, y, pick(ground, x, y, 54));
  });
  for (const [i, x, y] of [
    [0, 64, 51],
    [1, 65, 51],
    [2, 66, 51],
    [3, 67, 51],
  ])
    zone("arena_entry_" + i, "arena_entry", [x, y, 1, 1]);
  for (const [i, x, y] of [
    [0, 65, 40],
    [1, 71, 44],
    [2, 68, 49],
    [3, 61, 46],
    [4, 64, 45],
    [5, 69, 41],
  ])
    zone("shadow_anchor_" + i, "boss_anchor", [x, y, 1, 1]);
  zone("eclipse_mana_circle", "mana_restoration_zone", [66, 52, 2, 1]);
}

const faces = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];
const neighbors = [...faces, [-1, -1], [1, -1], [1, 1], [-1, 1]];
const occupied = (x, y) => get("Ground", x, y) || get("Lava", x, y);
const atBridge = (x, y) => x >= 62 && x <= 65 && (y === 17 || y === 18);

area([0, 0, width, height], (x, y) => {
  if (
    !occupied(x, y) &&
    neighbors.some(([dx, dy]) => occupied(x + dx, y + dy))
  ) {
    const edges = faces.reduce(
      (mask, [dx, dy], i) => mask | (occupied(x + dx, y + dy) ? 1 << i : 0),
      0,
    );
    set("Walls", x, y, ids.wall[edges]);
  }
  if (get("Lava", x, y)) {
    const edges = faces.reduce(
      (mask, [dx, dy], i) =>
        mask |
        (!get("Lava", x + dx, y + dy) && !atBridge(x + dx, y + dy)
          ? 1 << i
          : 0),
      0,
    );
    if (edges) set("LavaEdges", x, y, ids.shore[edges]);
  }
  if (get("Ground", x, y) && !atBridge(x, y)) {
    const detail = noise(x, y, 32);
    if (detail < 0.16) set("GroundDetails", x, y, pick(ids.crack, x, y, 15));
    if (detail > 0.982) set("GroundDetails", x, y, ids.debris);
  }
});

for (const [x, y, w, h] of [
  [13, 14, 1, 3],
  [19, 13, 4, 1],
  [24, 21, 4, 1],
  [48, 12, 4, 1],
  [50, 23, 4, 1],
  [67, 12, 3, 1],
  [51, 46, 3, 1],
  [29, 48, 3, 1],
]) {
  area([x, y, w, h], (col, row) => set("Walls", col, row, ids.wall[5]));
}

for (const [gid, locations] of [
  [
    ids.pillar,
    [
      [18, 17],
      [25, 15],
      [19, 22],
      [49, 15],
      [57, 14],
      [58, 24],
      [69, 15],
      [34, 44],
      [49, 49],
    ],
  ],
  [
    ids.broken,
    [
      [11, 13],
      [23, 22],
      [28, 12],
      [48, 21],
      [57, 22],
      [70, 22],
      [30, 45],
      [33, 51],
      [48, 43],
      [53, 51],
    ],
  ],
  [
    ids.rubble,
    [
      [10, 11],
      [11, 12],
      [18, 18],
      [28, 24],
      [47, 14],
      [51, 24],
      [69, 22],
      [30, 50],
      [49, 50],
    ],
  ],
]) {
  for (const [x, y] of locations) set("Obstacles", x, y, gid);
}

for (const [x, y] of [
  [12, 8],
  [18, 8],
  [7, 13],
  [30, 13],
  [16, 23],
  [23, 26],
  [34, 13],
  [39, 16],
  [21, 33],
  [35, 32],
  [46, 12],
  [54, 8],
  [59, 10],
  [67, 9],
  [71, 13],
  [57, 25],
  [69, 26],
  [35, 40],
  [40, 40],
  [27, 43],
  [26, 47],
  [54, 48],
  [50, 53],
  [30, 52],
])
  set("Decorations", x, y, ids.torch);

for (const [x, y] of [
  [20, 8],
  [22, 8],
  [51, 8],
  [55, 8],
  [32, 40],
  [45, 40],
  [48, 40],
]) {
  set("Decorations", x, y, ids.banners[(x + y) % 2]);
}

for (let i = 0; i < 3; i++) set("Overhead", 14 + i, 8, ids.arch[i]);
area([40, 42, 3, 3], (x, y) =>
  set("Obstacles", x, y, ids.shrine[(y - 42) * 3 + x - 40]),
);
set("Decorations", 41, 43, ids.crystal);
area([40, 46, 2, 2], (x, y) =>
  set("GroundDetails", x, y, ids.runes[(y - 46) * 2 + x - 40]),
);

if (combat) {
  for (const [x, y] of [
    [63, 42],
    [69, 46],
    [62, 49],
    [71, 47],
  ])
    set("Obstacles", x, y, ids.broken);
  for (const [x, y] of [
    [64, 38],
    [69, 39],
    [59, 46],
    [73, 45],
    [70, 51],
    [63, 52],
  ])
    set("Decorations", x, y, ids.torch);
  set("GroundDetails", 47, 46, ids.runes[2]);
  set("GroundDetails", 66, 52, ids.runes[2]);
  set("GroundDetails", 67, 52, ids.runes[3]);
}

const tileLayers = names.map((name, i) => ({
  id: i + 1,
  name,
  type: "tilelayer",
  x: 0,
  y: 0,
  width,
  height,
  opacity: 1,
  visible: true,
  data: layers[name],
}));
const map = {
  type: "map",
  version: "1.10",
  tiledversion: "1.11.0",
  orientation: "orthogonal",
  renderorder: "right-down",
  width,
  height,
  tilewidth: size,
  tileheight: size,
  infinite: false,
  backgroundcolor: "#130e1c",
  nextlayerid: tileLayers.length + 2,
  nextobjectid: objects.length + 1,
  layers: [
    ...tileLayers,
    {
      id: tileLayers.length + 1,
      name: "ObjectZones",
      type: "objectgroup",
      x: 0,
      y: 0,
      opacity: 1,
      visible: true,
      draworder: "topdown",
      objects,
    },
  ],
  tilesets: [definition],
};

const folder = new URL(
  "../../apps/web/public/assets/dungeon/",
  import.meta.url,
);
mkdirSync(folder, { recursive: true });
// Keep each grid row on one line so terrain changes are readable in Git.
const json = JSON.stringify(
  map,
  (key, value) => (key === "data" ? "TILE_ROWS:" + value.join(",") : value),
  2,
).replace(/"TILE_ROWS:([0-9,]+)"/g, (_, data) => {
  const values = data.split(",");
  const rows = Array.from({ length: height }, (_, y) =>
    values.slice(y * width, (y + 1) * width).join(", "),
  );
  return "[\n        " + rows.join(",\n        ") + "\n      ]";
});
writeFileSync(
  new URL(combat ? "obsidian-combat.tmj" : "obsidian-dungeon.tmj", folder),
  json + "\n",
);
writeFileSync(new URL(definition.image, folder), image);
writeFileSync(new URL("light.png", folder), lightTexture());
