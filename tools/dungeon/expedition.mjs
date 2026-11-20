import { readFileSync, writeFileSync } from "node:fs";
import { paintTiles } from "./tiles.mjs";
import { noise } from "./pixels.mjs";

const folder = new URL(
  "../../apps/web/public/assets/dungeon/",
  import.meta.url,
);
const classic = JSON.parse(
  readFileSync(new URL("obsidian-combat.tmj", folder), "utf8"),
);
const { ids } = paintTiles();
const zones = [
  ["Forsaken Entrance", ["Ruined Gateway", "Fallen Barracks", "Hall of Ashes"]],
  [
    "Molten Passages",
    [
      "Burning Corridor",
      "Molten Guard Chamber",
      "Furnace Vault",
      "Bridge of Embers",
    ],
  ],
  [
    "Forgotten Crypt",
    [
      "Crypt Entrance",
      "Chamber of Echoes",
      "Hall of the Restless",
      "The Sealed Tomb",
      "Ossuary of Names",
    ],
  ],
  [
    "Corrupted Sanctum",
    [
      "Corrupted Passage",
      "Hall of Broken Seals",
      "Sanctuary of the Azure Flame",
      "Shadow Gate Chamber",
      "The Violet Archive",
    ],
  ],
  [
    "Throne of the Shadow Overlord",
    ["Obsidian Antechamber", "Court of Lost Souls", "Shadow Throne"],
  ],
];
const slug = (name) => name.toLowerCase().replaceAll(" ", "-");
const tileNames = classic.layers
  .filter((l) => l.type === "tilelayer")
  .map((l) => l.name);
const sectionWidth = 92,
  sectionHeight = 55;
function blank(w, h) {
  const map = structuredClone(classic);
  Object.assign(map, { width: w, height: h });
  for (const l of map.layers) {
    if (l.type === "tilelayer")
      Object.assign(l, { width: w, height: h, data: Array(w * h).fill(0) });
    else l.objects = [];
  }
  return map;
}
function save(map, name) {
  map.nextobjectid = map.layers.at(-1).objects.length + 1;
  writeFileSync(
    new URL(name + ".tmj", folder),
    JSON.stringify(
      map,
      (k, v) => (k === "data" ? "@grid:" + v.join(",") : v),
      2,
    ).replace(/"@grid:([0-9,]+)"/g, (_, grid) => {
      const cells = grid.split(","),
        rows = [];
      for (let i = 0; i < cells.length; i += map.width)
        rows.push(cells.slice(i, i + map.width).join(","));
      return "[\n" + rows.join(",\n") + "\n]";
    }) + "\n",
  );
}
const merged = blank(sectionWidth * 3, sectionHeight * 2);
for (const [zi, [title, names]] of zones.entries()) {
  if (process.argv.includes("--pack")) break;
  const section = blank(sectionWidth, sectionHeight);
  const layers = Object.fromEntries(
    section.layers.filter((l) => l.data).map((l) => [l.name, l.data]),
  );
  const put = (layer, x, y, gid) => {
    layers[layer][y * sectionWidth + x] = gid;
  };
  const at = (l, x, y) => layers[l][y * sectionWidth + x] || 0;
  const objects = section.layers.at(-1).objects;
  const zone = slug(title);
  function obj(name, type, x, y, w = 1, h = 1, props = {}) {
    objects.push({
      id: objects.length + 1,
      name,
      type,
      x: x * 32,
      y: y * 32,
      width: w * 32,
      height: h * 32,
      rotation: 0,
      visible: true,
      properties: Object.entries({ zone, ...props }).map(([name, value]) => ({
        name,
        value,
        type:
          typeof value === "number"
            ? "int"
            : typeof value === "boolean"
              ? "bool"
              : "string",
      })),
    });
  }
  obj(zone, "world_zone", 0, 0, sectionWidth, sectionHeight, {
    title,
    index: zi,
  });
  const centers = [
    [18, 14],
    [51, 14],
    [18, 40],
    [51, 40],
    [79, 40],
  ];
  const rooms = names.map(slug);
  const floor = (x, y, art) =>
    put("Ground", x, y, art[Math.floor(noise(x, y, zi + 25) * art.length)]);
  const tileRect = (x, y, w, h, fn) => {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) fn(i, j);
  };
  // The throne and the two concealed wings have no physical corridor. Their doors relocate only after validation.
  let edges =
    names.length === 3
      ? [
          [0, 1],
          [0, 2],
          [1, 2],
        ]
      : [
          [0, 1],
          [0, 2],
          [1, 3],
          [2, 3],
        ];
  if (zi === 4) edges = [[0, 1]];
  for (const [a, b] of edges) {
    const [ax, ay] = centers[a],
      [bx, by] = centers[b];
    for (let x = Math.min(ax, bx); x <= Math.max(ax, bx); x++)
      tileRect(x, (a === 1 && b === 2 ? by : ay) - 1, 1, 3, (i, j) =>
        floor(i, j, ids.paving),
      );
    for (let y = Math.min(ay, by); y <= Math.max(ay, by); y++)
      tileRect((a === 1 && b === 2 ? ax : bx) - 1, y, 3, 1, (i, j) =>
        floor(i, j, ids.paving),
      );
    obj(rooms[a] + "_to_" + rooms[b], "room_connection", ax, ay, 1, 1, {
      from: rooms[a],
      to: rooms[b],
    });
  }
  for (const [ri, name] of names.entries()) {
    const [x, y] = centers[ri],
      room = rooms[ri],
      secret = ri === 4;
    const art = zi >= 2 ? ids.shadow : ids.floor;
    const w = secret ? 8 : ri % 2 === 1 ? 13 : 12,
      h = ri === 2 && zi === 4 ? 10 : 9;
    const landing = zi > 0 && ri === 0 ? 5 : 0;
    obj(room, "room", x - w - landing, y - h, 2 * w + 1 + landing, 2 * h + 1, {
      title: name,
      cameraX: (x + 0.5) * 32,
      cameraY: (y + 0.5) * 32,
      secret,
    });
    const marker = (id, kind, dx, dy, props = {}, width = 1, height = 1) =>
      obj(id, kind, x + dx, y + dy, width, height, { room, ...props });
    for (let j = -h; j <= h; j++)
      for (let i = -w; i <= w; i++) {
        if (Math.abs(i) + Math.abs(j) > w + h - 3) continue;
        floor(
          x + i,
          y + j,
          Math.abs(i) <= 1 || Math.abs(j) <= 1 ? ids.paving : art,
        );
        if (noise(x + i, y + j, 18) < 0.13)
          put(
            "GroundDetails",
            x + i,
            y + j,
            ids.crack[Math.abs(i + j) % ids.crack.length],
          );
      }
    // Reuse the masonry from the original three rooms at its original scale.
    const legacy = {
      "ruined-gateway": [18, 16],
      "molten-guard-chamber": [58, 18],
      "sanctuary-of-the-azure-flame": [41, 46],
    }[room];
    if (legacy) {
      for (const l of ["GroundDetails", "Decorations", "Overhead"]) {
        const source = classic.layers.find((t) => t.name === l);
        tileRect(-w + 1, -h + 1, 2 * w - 1, 2 * h - 1, (dx, dy) => {
          const gid =
            source.data[(legacy[1] + dy) * classic.width + legacy[0] + dx];
          if (gid && gid !== ids.crystal && at("Ground", x + dx, y + dy))
            put(l, x + dx, y + dy, gid);
        });
      }
    }
    // Broken partitions offer cover and leave alternating flanking lanes.
    const ruins = {
      "fallen-barracks": [
        [-7, -4, 5, 1],
        [2, 3, 5, 1],
        [7, -3, 1, 4],
      ],
      "hall-of-ashes": [
        [-8, -3, 1, 4],
        [6, 3, 1, 3],
      ],
      "furnace-vault": [
        [-7, -5, 3, 2],
        [6, 4, 3, 2],
      ],
      "crypt-entrance": [
        [-8, -4, 3, 1],
        [6, -4, 3, 1],
        [-8, 4, 3, 1],
        [6, 4, 3, 1],
      ],
      "chamber-of-echoes": [
        [-7, -4, 1, 2],
        [7, -4, 1, 2],
        [-7, 4, 1, 2],
        [7, 4, 1, 2],
      ],
      "hall-of-the-restless": [
        [-8, -4, 7, 1],
        [2, 3, 6, 1],
        [5, -3, 1, 4],
      ],
      "hall-of-broken-seals": [
        [-8, -3, 1, 4],
        [4, -5, 4, 1],
        [-5, 5, 6, 1],
      ],
      "obsidian-antechamber": [
        [-7, -5, 1, 3],
        [7, -5, 1, 3],
        [-7, 3, 1, 3],
        [7, 3, 1, 3],
      ],
      "the-violet-archive": [
        [-5, -5, 3, 1],
        [3, -5, 3, 1],
      ],
    };
    for (const [dx, dy, rw, rh] of ruins[room] ?? [])
      tileRect(x + dx, y + dy, rw, rh, (i, j) =>
        put("Obstacles", i, j, noise(i, j, 12) < 0.3 ? ids.rubble : ids.broken),
      );
    // Authored silhouettes, cover, torch pairs, columns and royal hangings.
    for (const [dx, dy] of [
      [-w + 2, -4],
      [w - 2, -4],
      [-w + 3, 5],
      [w - 3, 5],
    ]) {
      put("Obstacles", x + dx, y + dy, (ri + dy) % 2 ? ids.broken : ids.pillar);
      put("Decorations", x + dx, y + dy - 1, ids.torch);
    }
    for (const dx of [-4, 4])
      put("Decorations", x + dx, y - h + 1, ids.banners[zi % 2]);
    for (let i = 0; i < 3; i++)
      put("Overhead", x + i - 1, y - h + 1, ids.arch[i]);
    if (zi === 1 || room === "hall-of-ashes" || room === "shadow-throne") {
      const river = zi === 1 && ri !== 2;
      tileRect(
        x + 4,
        y - h + 1,
        river ? 3 : 4,
        river ? 2 * h - 1 : 3,
        (i, j) => {
          if (river && (Math.abs(j - y) <= 1 || j === y + 5)) {
            put("Ground", i, j, ids.bridge[(j + y) % 4]);
            return;
          }
          put("Ground", i, j, 0);
          put("Lava", i, j, ids.lava[(i % 2) + 2 * (j % 2)]);
        },
      );
      marker(room + "_lava", "lava_hazard", 4, -h + 1, {}, 3, 2);
      if (river) marker(room + "_bridge", "bridge", 4, -1, {}, 3, 3);
    }
    if (zi === 0 && ri === 0)
      marker("player_spawn", "player_spawn", -5, 2, {}, 4, 2);
    if (!ri) {
      if (landing)
        tileRect(x - 17, y + 3, 9, 5, (i, j) => floor(i, j, ids.paving));
      for (let s = 0; s < 4; s++)
        marker(
          zone + "_arrival_" + s,
          "zone_entry",
          (landing ? -16 : -5) + s,
          landing ? 5 : 2,
          { slot: s },
        );
    }
    if (
      (zi === 1 && ri === 1) ||
      (zi === 3 && ri === 2) ||
      (ri === 0 && zi === 0) ||
      (ri === 1 && zi === 4) ||
      (zi === 2 && ri === 0)
    ) {
      tileRect(x - 1, y - 6, 3, 3, (i, j) =>
        put("Obstacles", i, j, ids.shrine[(j - y + 6) * 3 + i - x + 1]),
      );
      put("Decorations", x, y - 5, ids.crystal);
      marker(room + "_shrine", "mana_restoration_zone", -2, -3, {}, 5, 2);
      tileRect(x - 1, y - 3, 2, 2, (i, j) =>
        put("GroundDetails", i, j, ids.runes[(j - y + 3) * 2 + i - x + 1]),
      );
    }
    if ((zi === 1 || zi === 3) && !secret && !(zi === 3 && ri === 2)) {
      marker(
        room + "_trap",
        zi === 1 ? "flame_vent" : "arcane_trap",
        1,
        3,
        { offset: ri * 530 },
        2,
        2,
      );
      tileRect(x + 1, y + 3, 2, 2, (i, j) =>
        put("GroundDetails", i, j, ids.runes[(i + j) % 4]),
      );
    }
    const mobs = [
      [
        ["shadow", "ghost-wisp"],
        ["servant", "shadow-guard"],
        ["shadow", "shadow-bat"],
      ],
      [
        ["lava", "lava"],
        ["lava", "lava"],
        ["lava", "lava", "Infernal Warden"],
        ["servant", "flying-skull"],
      ],
      [
        ["shadow", "ghost-wisp"],
        ["shadow", "flying-skull"],
        ["servant", "servant"],
        ["mage", "soul-drainer", "Crypt Reaper"],
        ["illusion", "eye-beast"],
      ],
      [
        ["mage", "mage"],
        ["shadow", "eye-beast"],
        null,
        ["mage", "shadow-guard"],
        ["illusion", "shadow-bat"],
      ],
      [["servant", "shadow-guard"], ["mage", "soul-drainer"], null],
    ][zi][ri];
    if (mobs) {
      const [enemy, appearance, elite] = mobs;
      marker(
        room + "_battle",
        "combat_region",
        -w + 1,
        -h + 1,
        { title: elite ?? name, optional: secret || (zi === 4 && ri === 1) },
        2 * w - 1,
        2 * h - 1,
      );
      marker(room + "_foe", "combat_spawn", -3, -2, {
        encounter: room + "_battle",
        enemy,
        appearance,
        ...(elite ? { elite } : {}),
      });
      const patrols = {
        "hall-of-ashes": ["servant", "shadow-bat"],
        "molten-guard-chamber": ["servant", "shadow-guard"],
        "chamber-of-echoes": ["shadow", "ghost-wisp"],
        "shadow-gate-chamber": ["servant", "soul-drainer"],
      };
      const patrol = patrols[room];
      if (patrol)
        marker(room + "_flank", "combat_spawn", 8, 2, {
          encounter: room + "_battle",
          enemy: patrol[0],
          appearance: patrol[1],
        });
    }
    if (
      (zi === 0 && ri === 1) ||
      (zi === 1 && ri === 2) ||
      (zi === 2 && ri === 3) ||
      (zi === 3 && ri === 1)
    ) {
      const labels = [
        "Barracks seal",
        "Furnace mechanism",
        "Crypt sigil",
        "Western seal",
      ];
      marker(room + "_seal", "mechanism", -5, 0, {
        title: labels[zi],
        requires: room + "_battle",
      });
      put("GroundDetails", x - 5, y, ids.runes[2]);
      if (zi === 3) {
        marker("eastern_seal", "mechanism", 7, 1, {
          title: "Eastern seal",
          requires: room + "_battle",
        });
        put("GroundDetails", x + 7, y + 1, ids.runes[3]);
      }
    }
    if (zi < 4 && ri === (zi === 0 ? 2 : 3)) {
      marker(zone + "_gate", "zone_gate", 2, -4, {
        destination: slug(zones[zi + 1][0]),
        title: "Passage to " + zones[zi + 1][0],
      });
      put("GroundDetails", x + 2, y - 4, ids.runes[0]);
    }
    if ((zi === 2 || zi === 3) && ri === 2) {
      marker(zone + "_hidden", "secret_door", -7, 2, {
        destination: rooms[4],
        title: "Inspect the fractured relief",
      });
      put("GroundDetails", x - 7, y + 2, ids.debris);
      obj(zone + "_secret_link", "room_connection", x - 7, y + 2, 1, 1, {
        from: room,
        to: rooms[4],
        hidden: true,
      });
    }
    if (secret) {
      marker(zone + "_return", "secret_return", 0, 3, {
        destination: rooms[2],
        title: "Return to passage",
      });
      put("Decorations", x, y - 2, ids.crystal);
    }
    if (zi === 4 && ri === 1) {
      marker("shadow_gate", "boss_gate", 2, 3, {
        title: "Enter Shadow Throne",
      });
      obj("throne_link", "room_connection", x + 2, y + 3, 1, 1, {
        from: room,
        to: rooms[2],
      });
    }
    if (zi === 4 && ri === 2) {
      // Transplant the original Eclipse arena, including its escape lanes, cover and mana circle.
      tileRect(x - w, y - h, w * 2 + 1, h * 2 + 1, (i, j) => {
        for (const l of tileNames) put(l, i, j, 0);
      });
      tileRect(x - 10, y - 10, 21, 21, (i, j) => {
        if (Math.hypot(i - x, j - y) > 10.5) return;
        for (const l of tileNames)
          put(
            l,
            i,
            j,
            classic.layers.find((t) => t.name === l).data[
              (j - y + 45) * classic.width + i - x + 66
            ] || 0,
          );
      });
      for (const o of classic.layers
        .at(-1)
        .objects.filter(
          (o) =>
            ["boss_arena", "boss_spawn", "boss_anchor", "arena_entry"].includes(
              o.type,
            ) || o.name === "eclipse_mana_circle",
        ))
        obj(
          o.name,
          o.type,
          o.x / 32 + x - 66,
          o.y / 32 + y - 45,
          o.width / 32,
          o.height / 32,
          { room },
        );
    }
  }
  const dirs = [
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0],
    ],
    occupied = (x, y) => at("Ground", x, y) || at("Lava", x, y);
  for (let y = 1; y < sectionHeight - 1; y++)
    for (let x = 1; x < sectionWidth - 1; x++) {
      if (
        !occupied(x, y) &&
        dirs.some(([dx, dy]) => occupied(x + dx, y + dy))
      ) {
        put(
          "Walls",
          x,
          y,
          ids.wall[
            dirs.reduce(
              (m, [dx, dy], i) => m | (occupied(x + dx, y + dy) ? 1 << i : 0),
              0,
            )
          ],
        );
      }
      if (at("Lava", x, y))
        put(
          "LavaEdges",
          x,
          y,
          ids.shore[
            dirs.reduce(
              (m, [dx, dy], i) =>
                m | (!at("Lava", x + dx, y + dy) ? 1 << i : 0),
              0,
            )
          ],
        );
    }
  save(section, zone);
}

for (const [zi, [title]] of zones.entries()) {
  const section = JSON.parse(
    readFileSync(new URL(slug(title) + ".tmj", folder), "utf8"),
  );
  const ox = (zi % 3) * sectionWidth,
    oy = Math.floor(zi / 3) * sectionHeight;
  for (const [li, layer] of section.layers.entries()) {
    const target = merged.layers[li];
    if (layer.data)
      for (let y = 0; y < sectionHeight; y++)
        for (let x = 0; x < sectionWidth; x++)
          target.data[(y + oy) * merged.width + x + ox] =
            layer.data[y * sectionWidth + x];
    else
      for (const source of layer.objects) {
        const o = structuredClone(source);
        o.x += 32 * ox;
        o.y += 32 * oy;
        o.id = target.objects.length + 1;
        for (const p of o.properties) {
          if (p.name === "cameraX") p.value += 32 * ox;
          if (p.name === "cameraY") p.value += 32 * oy;
        }
        target.objects.push(o);
      }
  }
}
save(merged, "expedition");
