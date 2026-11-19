import { noise, painter, png, surface } from "./pixels.mjs";

const stone = {
  black: 0x13101d,
  mortar: 0x211a2c,
  shadow: 0x32283d,
  side: 0x42364e,
  face: 0x51435a,
  edge: 0x695769,
  light: 0x87717e,
  worn: 0xa28b85,
};

const floor = { terrain: "floor" };
const solid = { terrain: "solid", blocksSight: true };
const lava = { terrain: "lava" };

function slab(p, x, y, w, h, color, highlight, shade) {
  p.rect(x + 1, y, w - 2, h, shade);
  p.rect(x, y + 1, w, h - 2, shade);
  p.rect(x + 1, y + 1, w - 2, h - 3, color);
  p.rect(x + 2, y + 1, w - 4, 1, highlight);
  p.rect(x + 1, y + 2, 1, h - 5, highlight);
}

function floorTile(p, variation, shadow = false) {
  p.rect(0, 0, 32, 32, shadow ? 0x1a1525 : 0x292238);
  const faces = shadow
    ? [0x302638, 0x342a3e, 0x3a2e45]
    : [0x50445b, 0x554961, 0x5a4d63, 0x4c4158, 0x594a5c];
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 2; col++) {
      const split = row === 0 ? 15 + (variation % 3) : 15 - (variation % 3);
      const x = col === 0 ? 0 : split;
      const y = row * 16;
      const w = col === 0 ? split : 32 - split;
      const color =
        faces[Math.floor(noise(col, row, variation + 1) * faces.length)];
      slab(
        p,
        x,
        y,
        w,
        16,
        color,
        shadow ? 0x44344e : 0x736074,
        shadow ? 0x261e31 : 0x3b3147,
      );
      for (let i = 0; i < 8; i++) {
        const px =
          x + 2 + Math.floor(noise(i, 8 + col, variation + row) * (w - 4));
        const py = y + 3 + Math.floor(noise(i, 12 + row, variation + col) * 10);
        p.rect(
          px,
          py,
          i % 4 === 0 ? 2 : 1,
          1,
          i % 3 === 0
            ? shadow
              ? 0x43344c
              : 0x65546a
            : shadow
              ? 0x2b2336
              : 0x484053,
        );
      }
    }
  }
}

function paving(p, variation) {
  p.rect(0, 0, 32, 32, 0x302738);
  const color = [0x574d62, 0x5b4f64, 0x625263, 0x51475e][variation];
  slab(p, 0, 0, 32, 16, color, 0x7c6b7e, 0x44384f);
  slab(p, 0, 16, 32, 16, color, 0x7c6b7e, 0x44384f);
  for (let i = 0; i < 16; i++) {
    const x = 3 + Math.floor(noise(i, 4, variation) * 25);
    const y = 3 + Math.floor(noise(i, 0, variation) * 27);
    p.rect(x, y, i % 2 ? 1 : 2, 1, i % 3 ? 0x62526a : 0x78667b);
  }
}

function crack(p, variation) {
  const x = 6 + variation * 3;
  const y = 6 + (variation % 2) * 9;
  const segments = [
    [x, y, x + 5, y + 4],
    [x + 5, y + 4, x + 4, y + 9],
    [x + 4, y + 9, x + 11, y + 12],
    [x + 4, y + 9, x + 1, y + 14],
  ];
  for (const [x1, y1, x2, y2] of segments) {
    p.line(x1, y1 + 1, x2, y2 + 1, 0x776171);
    p.line(x1, y1, x2, y2, 0x241b30);
  }
  if (variation === 2) {
    for (let i = 0; i < 18; i++) {
      p.rect(
        4 + Math.floor(noise(i, 7) * 21),
        21 + Math.floor(noise(i, 9) * 6),
        2,
        1,
        i % 3 ? 0x46503f : 0x61644a,
      );
    }
  }
}

function wall(p, mask) {
  p.rect(0, 0, 32, 32, stone.black);
  const faces = [0x514156, 0x564559, 0x4a3b51, 0x5f4a58];
  for (let row = 0; row < 3; row++) {
    const start = row % 2 ? -5 : -1;
    for (let x = start; x < 32; x += 11) {
      const color = faces[Math.floor(noise(x, row, mask + 12) * faces.length)];
      slab(
        p,
        x,
        2 + row * 9,
        11,
        9,
        color,
        row === 0 ? 0x87717e : 0x6d596b,
        stone.shadow,
      );
      p.rect(x + 3, 6 + row * 9, 3 + ((row + mask) % 3), 1, stone.side);
    }
  }
  if (mask & 1) {
    p.rect(0, 1, 32, 2, stone.shadow);
    p.rect(0, 0, 32, 1, stone.black);
  }
  if (mask & 2) p.rect(30, 2, 2, 27, stone.mortar);
  if (mask & 4) {
    p.rect(0, 28, 32, 2, 0x2c2235);
    p.rect(0, 30, 32, 2, 0x171222);
  }
  if (mask & 8) p.rect(0, 2, 2, 27, stone.light);
}

function pier(p, broken) {
  p.rect(3, 8, 27, 24, 0x171220, 180);
  slab(p, 2, 23, 27, 8, stone.face, stone.light, stone.black);
  slab(p, 5, 20, 21, 7, stone.edge, stone.worn, stone.shadow);
  const top = broken ? 12 : 4;
  p.rect(8, top + 4, 15, 22 - top, stone.shadow);
  p.rect(9, top + 2, 11, 20 - top, stone.face);
  p.rect(10, top + 4, 2, 17 - top, stone.light);
  p.rect(14, top + 4, 2, 17 - top, stone.edge);
  p.rect(19, top + 3, 2, 19 - top, stone.side);
  p.poly(
    [
      [8, top + 2],
      [11, top],
      [19, top - 1],
      [23, top + 1],
      [24, top + 4],
      [20, top + 7],
      [11, top + 6],
      [7, top + 4],
    ],
    stone.worn,
  );
  p.line(11, top + 1, 18, top, 0xb09b92);
  p.line(13, top + 1, 15, top + 4, stone.face);
  if (broken) p.line(15, top + 4, 22, top + 3, stone.shadow);
}

function rubble(p, large) {
  for (const [x, y, s] of large
    ? [
        [4, 18, 10],
        [16, 13, 12],
        [19, 23, 9],
        [8, 25, 6],
      ]
    : [
        [6, 18, 6],
        [15, 14, 8],
        [21, 21, 7],
      ]) {
    p.rect(x + 2, y + 2, s, Math.ceil(s * 0.7), stone.black, 209);
    slab(p, x, y, s, Math.ceil(s * 0.7), stone.face, stone.light, stone.shadow);
    p.rect(x + 3, y + 2, 2, 1, stone.worn);
  }
}

function lavaTile(p, quarter, phase) {
  const tide = [0, 0.9, 0.1, -0.8][phase];
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      const u = x + (quarter % 2) * 32;
      const v = y + Math.floor(quarter / 2) * 32;
      const px = u + Math.sin((v * Math.PI) / 16) * 2.3;
      const py = v + Math.sin((u * Math.PI) / 16) * 2;
      let closest = Infinity;
      let second = Infinity;
      let cell = 0;
      const gridX = Math.floor(px / 8);
      const gridY = Math.floor(py / 8);
      for (let j = gridY - 1; j <= gridY + 1; j++) {
        for (let i = gridX - 1; i <= gridX + 1; i++) {
          const a = (i + 16) % 8;
          const b = (j + 16) % 8;
          const dx = px - (i * 8 + 1.5 + noise(a, b, 2) * 5);
          const dy = py - (j * 8 + 1.5 + noise(a, b, 4) * 5);
          const distance = dx * dx + dy * dy;
          if (distance < closest) {
            second = closest;
            closest = distance;
            cell = noise(a, b, 10);
          } else if (distance < second) second = distance;
        }
      }
      const seam = Math.sqrt(second) - Math.sqrt(closest);
      const hot = tide + Math.sin(((u + v) * Math.PI) / 16) * 0.5;
      const palette = [0xa82a22, 0xc63522, 0xde4122, 0xee5627];
      const interior =
        palette[Math.min(3, Math.floor(cell * 3 + 0.5 + hot * 0.35))] ??
        palette[0];
      const color =
        seam < 0.5 + hot * 0.17
          ? 0xffcb54
          : seam < 1.25 + hot * 0.2
            ? 0xff852a
            : seam < 2
              ? 0xf35d23
              : interior;
      p.pixel(x, y, color);
    }
  }
}

function shore(p, mask) {
  const draw = [
    (i, d, c) => p.pixel(i, d, c),
    (i, d, c) => p.pixel(31 - d, i, c),
    (i, d, c) => p.pixel(i, 31 - d, c),
    (i, d, c) => p.pixel(d, i, c),
  ];
  const rock = [0x4d3b48, 0x594453, 0x352637, 0x271924, 0x742920, 0xf47831];
  for (let side = 0; side < 4; side++) {
    if ((mask & (1 << side)) === 0) continue;
    for (let i = 0; i < 32; i++) {
      const lip = Math.floor(noise(Math.floor(i / 4), side, 7) * 2);
      for (let d = 0; d < rock.length - lip; d++) {
        draw[side](i, d, i % 8 === 0 && d < 4 ? 0x302231 : rock[d + lip]);
      }
    }
  }
}

function bridge(p, rail, end = false) {
  p.rect(0, 0, 32, 32, 0x4a3541);
  for (let row = 0; row < 4; row++) {
    for (let x = row % 2 ? -8 : 0; x < 32; x += 16) {
      slab(
        p,
        x,
        row * 8,
        16,
        8,
        row % 2 ? 0x77636a : 0x806b73,
        0xaa8d86,
        0x52434e,
      );
    }
  }
  slab(p, 0, rail === "north" ? 0 : 25, 32, 7, 0x62505e, 0xab8b85, 0x2c2234);
  for (const x of [4, 20]) {
    p.rect(x, rail === "north" ? 2 : 27, 4, 2, 0x9f837f);
  }
  if (end) {
    const y = rail === "north" ? 0 : 20;
    slab(p, 10, y, 12, 12, 0x8e6f72, 0xcfaa97, 0x4c3444);
    slab(p, 12, y + 2, 8, 7, 0x9a7a78, 0xcbab97, 0x715568);
  }
}

function torch(p, frame) {
  p.rect(13, 13, 6, 16, 0x1b1322, 230);
  p.rect(15, 15, 3, 12, 0x754638);
  p.rect(13, 17, 7, 3, 0xb9794b);
  p.rect(14, 18, 5, 2, 0x57352c);
  const tip = [15, 18, 16, 13][frame];
  p.poly(
    [
      [12, 17],
      [10, 13],
      [11, 9],
      [tip, 3 + (frame % 2) * 2],
      [19, 8],
      [21, 13],
      [18, 17],
    ],
    0xd34e27,
  );
  p.poly(
    [
      [13, 16],
      [12, 12],
      [tip, 7],
      [18, 12],
      [19, 14],
      [17, 16],
    ],
    0xffa240,
  );
  p.poly(
    [
      [14, 16],
      [14, 12],
      [16, 10],
      [17, 13],
      [18, 15],
      [16, 17],
    ],
    0xffe59c,
  );
  p.pixel(18 - frame, 3 - (frame % 2), 0xffa746);
}

function banner(p, variation) {
  p.rect(5, 1, 22, 3, 0x9e7862);
  p.poly(
    [
      [7, 4],
      [25, 4],
      [25, 24],
      [16, 32],
      [7, 24],
    ],
    0x2a1729,
  );
  p.poly(
    [
      [8, 4],
      [23, 4],
      [23, 22],
      [16, 29],
      [8, 22],
    ],
    variation ? 0x442d63 : 0x572a48,
  );
  p.line(9, 5, 9, 22, 0x976678);
  p.line(9, 22, 16, 27, 0x976678);
  p.line(16, 27, 22, 22, 0x976678);
  p.line(16, 10, 20, 15, 0xd3a17d);
  p.line(20, 15, 16, 20, 0xd3a17d);
  p.line(16, 20, 12, 15, 0xd3a17d);
  p.line(12, 15, 16, 10, 0xd3a17d);
}

function shrinePiece(p, col, row) {
  const ox = col * 32;
  const oy = row * 32;
  const x = (value) => value - ox;
  const y = (value) => value - oy;
  const rect = (left, top, w, h, c) => p.rect(x(left), y(top), w, h, c);
  const polygon = (pts, c) =>
    p.poly(
      pts.map(([px, py]) => [x(px), y(py)]),
      c,
    );
  polygon(
    [
      [6, 60],
      [12, 27],
      [27, 10],
      [40, 3],
      [56, 3],
      [70, 10],
      [84, 27],
      [90, 60],
      [86, 86],
      [10, 86],
    ],
    0x171827,
  );
  polygon(
    [
      [10, 58],
      [16, 29],
      [30, 13],
      [42, 6],
      [54, 6],
      [66, 13],
      [80, 29],
      [86, 58],
      [82, 78],
      [14, 78],
    ],
    0x495c78,
  );
  polygon(
    [
      [22, 62],
      [25, 36],
      [37, 22],
      [46, 17],
      [50, 17],
      [59, 22],
      [71, 36],
      [74, 62],
      [69, 79],
      [27, 79],
    ],
    0x152f50,
  );
  polygon(
    [
      [30, 64],
      [31, 40],
      [41, 29],
      [48, 25],
      [55, 29],
      [65, 40],
      [66, 64],
    ],
    0x133f65,
  );
  for (const [px, py] of [
    [28, 19],
    [38, 11],
    [51, 8],
    [62, 14],
    [72, 23],
    [17, 40],
    [74, 40],
  ]) {
    rect(px, py, 7, 2, 0x7f91ac);
    rect(px, py + 2, 2, 4, 0x647c9b);
  }
  for (const [left, width] of [
    [12, 16],
    [68, 16],
  ]) {
    rect(left, 46, width, 30, 0x283950);
    rect(left + 2, 46, 2, 27, 0x5d7994);
    rect(left + 4, 57, width - 8, 2, 0x5d7994);
  }
  rect(15, 73, 66, 6, 0x8196ac);
  rect(11, 79, 74, 6, 0x475d7b);
  rect(8, 85, 80, 4, 0x8ba6b4);
  rect(5, 89, 86, 4, 0x26344c);
  rect(34, 69, 28, 3, 0x67c8e3);
  rect(31, 63, 34, 4, 0x48a4cf);
}

function crystal(p, frame) {
  const dy = [1, 0, -1, 0][frame];
  p.poly(
    [
      [16, 1 + dy],
      [26, 12 + dy],
      [22, 24 + dy],
      [16, 28 + dy],
      [9, 22 + dy],
      [6, 12 + dy],
    ],
    0x1787b5,
  );
  p.poly(
    [
      [16, 1 + dy],
      [24, 12 + dy],
      [16, 24 + dy],
      [10, 13 + dy],
    ],
    0x55d8f7,
  );
  p.poly(
    [
      [16, 3 + dy],
      [18, 12 + dy],
      [16, 20 + dy],
      [13, 12 + dy],
    ],
    frame === 2 ? 0xe5ffff : 0xb6f7ff,
  );
  p.line(16, 1 + dy, 10, 13 + dy, 0xaeecff);
  p.line(25, 12 + dy, 21, 22 + dy, 0x32c5e8);
  p.pixel(4 + frame, 20 - frame * 3, 0x7ae1fa);
  p.pixel(27 - frame, 21 - frame * 4, 0x61c8ea);
}

function rune(p, corner) {
  const right = corner % 2 === 1;
  const bottom = corner >= 2;
  const mx = right ? 0 : 31;
  const my = bottom ? 0 : 31;
  const point = ([x, y]) => [right ? x : 31 - x, bottom ? y : 31 - y];
  const points = [
    [0, 26],
    [9, 24],
    [21, 19],
    [25, 11],
    [26, 0],
  ].map(point);
  for (let i = 1; i < points.length; i++)
    p.line(...points[i - 1], ...points[i], 0x4686a4, 2);
  p.line(mx, my + (bottom ? 11 : -11), mx + (right ? 11 : -11), my, 0x5aa7bd);
  p.rect(right ? 15 : 14, bottom ? 15 : 14, 2, 2, 0x82b9c8);
}

function arch(p, piece) {
  if (piece === 1) {
    p.rect(0, 1, 32, 8, stone.shadow);
    slab(p, 0, 1, 32, 7, stone.face, stone.worn, stone.shadow);
    p.line(10, 3, 16, 6, stone.light);
    p.line(16, 6, 22, 3, stone.light);
    return;
  }
  const x = piece === 0 ? 19 : 0;
  p.rect(x, 2, 13, 30, stone.black);
  for (let y = 2; y < 30; y += 7)
    slab(p, x, y, 13, 7, stone.side, stone.light, stone.shadow);
  slab(p, x - 1, 26, 15, 6, stone.face, stone.worn, stone.shadow);
}

export function paintTiles() {
  const tiles = [];
  const add = (draw, properties) => tiles.push({ draw, properties });
  const many = (length, draw, properties) =>
    Array.from({ length }, (_, i) => add((p) => draw(p, i), properties));
  function animated(draw, durations, properties) {
    const frames = durations.map((_, i) => add((p) => draw(p, i), properties));
    tiles[frames[0] - 1].animation = frames.map((gid, i) => ({
      tileid: gid - 1,
      duration: durations[i],
    }));
    return frames[0];
  }

  const ids = {
    floor: many(10, floorTile, floor),
    paving: many(4, paving, floor),
    shadow: many(4, (p, i) => floorTile(p, i, true), floor),
    crack: many(4, crack),
    wall: many(16, wall, solid),
    lava: Array.from({ length: 4 }, (_, q) =>
      animated((p, f) => lavaTile(p, q, f), [190, 160, 200, 170], lava),
    ),
    shore: many(16, shore),
    bridge: [
      add((p) => bridge(p, "north"), floor),
      add((p) => bridge(p, "south"), floor),
      add((p) => bridge(p, "north", true), floor),
      add((p) => bridge(p, "south", true), floor),
    ],
    pillar: add((p) => pier(p, false), solid),
    broken: add((p) => pier(p, true), solid),
    rubble: add((p) => rubble(p, true), solid),
    debris: add((p) => rubble(p, false)),
    torch: animated(torch, [95, 125, 80, 145], { emitter: "torch" }),
    banners: many(2, banner),
    shrine: many(9, (p, i) => shrinePiece(p, i % 3, Math.floor(i / 3)), solid),
    crystal: animated(crystal, [285, 320, 370, 345], { emitter: "shrine" }),
    runes: many(4, rune),
    arch: many(3, arch),
  };

  const columns = 16;
  const image = surface(columns * 32, Math.ceil(tiles.length / columns) * 32);
  tiles.forEach(({ draw }, i) =>
    draw(painter(image, (i % columns) * 32, Math.floor(i / columns) * 32), i),
  );
  const definition = {
    firstgid: 1,
    name: "obsidian-stone",
    image: "obsidian-stone.png",
    imagewidth: image.width,
    imageheight: image.height,
    columns,
    tilewidth: 32,
    tileheight: 32,
    tilecount: columns * (image.height / 32),
    margin: 0,
    spacing: 0,
    tiles: tiles.flatMap(({ animation, properties }, id) => {
      if (!animation && !properties) return [];
      return [
        {
          id,
          ...(animation ? { animation } : {}),
          ...(properties
            ? {
                properties: Object.entries(properties).map(([name, value]) => ({
                  name,
                  value,
                  type: typeof value === "boolean" ? "bool" : "string",
                })),
              }
            : {}),
        },
      ];
    }),
  };
  return { ids, image: png(image), definition };
}

export function lightTexture() {
  const size = 128;
  const image = surface(size, size);
  const p = painter(image, 0, 0, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const radius = Math.hypot(x - 63.5, y - 63.5) / 64;
      p.pixel(x, y, 0xffffff, Math.round(Math.max(0, 1 - radius) ** 2 * 255));
    }
  }
  return png(image);
}
