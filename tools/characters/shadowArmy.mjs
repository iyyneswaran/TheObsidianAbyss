const ink = 0x160e28;
const violet = 0x432768;
const velvet = 0x7040a4;
const orchid = 0xac62e7;
const gem = 0xe3a8ff;
const steelShadow = 0x705978;
const steel = 0xc5aabf;
const ivory = 0xf4d6b7;

function pose(dir, step) {
  return {
    x: dir === 2 ? 21 : dir === 3 ? 27 : 24,
    reverse: dir === 2,
    back: dir === 1,
    y: step,
  };
}

function diamond(p, x, y, r, color) {
  p.poly(
    [
      [x, y - r],
      [x + r, y],
      [x, y + r],
      [x - r, y],
    ],
    color,
  );
}

export function drawOverlordRegalia(p, dir, step) {
  const { x, y, reverse, back } = pose(dir, step);
  const s = reverse ? 8 : 39;
  // The staff swings to the far hand when the boss changes facing.
  p.line(s + 2, 12 + y, s - 3, 44, ink, 3);
  p.line(s + 2, 12 + y, s - 3, 44, steelShadow);
  p.line(s + 1, 13 + y, s - 2, 39, steel);
  diamond(p, s + 1, 9 + y, 8, ink);
  diamond(p, s + 1, 9 + y, 7, steelShadow);
  diamond(p, s + 1, 9 + y, 6, steel);
  diamond(p, s + 1, 9 + y, 5, violet);
  p.line(s - 1, 7 + y, s + 3, 7 + y, orchid);
  p.line(s + 4, 8 + y, s + 4, 11 + y, orchid);
  p.line(s + 3, 12 + y, s, 12 + y, orchid);
  p.line(s - 1, 11 + y, s, 9 + y, gem);
  p.pixel(s + 1, 9 + y, ivory);

  p.line(x - 9, 4 + y, x - 5, 12 + y, steel);
  p.line(x + 9, 4 + y, x + 5, 12 + y, steel);
  p.line(x - 6, 11 + y, x, 5 + y, ivory);
  p.line(x, 5 + y, x + 6, 11 + y, ivory);
  diamond(p, x, 6 + y, 3, orchid);
  p.pixel(x, 5 + y, gem);
  p.line(13, 20 + y, 20, 25 + y, steel);
  p.line(35, 20 + y, 28, 25 + y, steel);
  p.line(16, 22 + y, 21, 25 + y, steelShadow);
  p.line(32, 22 + y, 27, 25 + y, steelShadow);
  p.line(22, 28 + y, 17, 40 + y, orchid);
  p.line(26, 28 + y, 31, 40 + y, orchid);
  diamond(p, 24, 27 + y, back ? 2 : 4, back ? steelShadow : steel);
  if (!back) {
    diamond(p, 24, 27 + y, 2, orchid);
    p.pixel(x - 3, 15 + y, gem);
    p.pixel(x + 3, 15 + y, gem);
  }
}

export function drawShadowGuard(p, dir, step) {
  const { x, y, reverse, back } = pose(dir, step);
  const blade = reverse ? 40 : 8;
  const shield = reverse ? 12 : 35;
  p.rect(9, 42, 31, 3, ink, 170);
  p.poly(
    [
      [x, 8 + y],
      [13, 15],
      [9, 29],
      [12, 38],
      [19, 36],
      [25, 43],
      [30, 38],
      [39, 41],
      [36, 23],
      [32, 13],
    ],
    violet,
  );
  p.poly(
    [
      [x, 8 + y],
      [14, 16],
      [17, 30],
      [30, 30],
      [35, 17],
    ],
    ink,
  );
  p.poly(
    [
      [x, 9 + y],
      [16, 17],
      [17, 24],
      [22, 28],
      [29, 25],
      [33, 17],
    ],
    steelShadow,
  );
  p.line(14, 17, 12, 11 + y, ivory, 2);
  p.line(34, 17, 36, 11 + y, ivory, 2);
  p.line(17, 25, 15, 34 + y, steelShadow, 3);
  p.line(29, 24, 31, 35 + y, steel, 3);
  p.rect(17 + step, 36, 5, 7, ink);
  p.rect(27 - step, 36, 5, 7, ink);
  p.poly(
    [
      [x - 7, 12 + y],
      [x - 8, 5 + y],
      [x - 3, 10 + y],
      [x, 6 + y],
      [x + 3, 10 + y],
      [x + 7, 5 + y],
      [x + 7, 16 + y],
      [x, 20 + y],
    ],
    steel,
  );
  p.poly(
    [
      [x - 4, 12 + y],
      [x, 10 + y],
      [x + 4, 12 + y],
      [x + 3, 16 + y],
      [x - 3, 16 + y],
    ],
    ink,
  );
  if (!back) {
    p.pixel(x - 2, 13 + y, gem);
    p.pixel(x + 2, 13 + y, gem);
  }
  p.line(blade, 39 - y, blade + (reverse ? 4 : -4), 20 + y, ink, 4);
  p.line(blade, 37 - y, blade + (reverse ? 4 : -4), 20 + y, orchid, 2);
  p.poly(
    [
      [shield, 18 + y],
      [shield + 7, 22 + y],
      [shield + 5, 32 + y],
      [shield, 38 + y],
      [shield - 5, 32 + y],
      [shield - 7, 22 + y],
    ],
    steel,
  );
  p.poly(
    [
      [shield, 21 + y],
      [shield + 5, 24 + y],
      [shield + 3, 32 + y],
      [shield, 35 + y],
      [shield - 4, 30 + y],
      [shield - 5, 24 + y],
    ],
    violet,
  );
  diamond(p, shield, 27 + y, 4, orchid);
  p.pixel(shield, 26 + y, ivory);
}

export function drawSoulDrainer(p, dir, step) {
  const { x, y, reverse, back } = pose(dir, step);
  const lantern = reverse ? 10 : 39;
  p.rect(13, 42, 25, 2, ink, 160);
  p.poly(
    [
      [x, 7 + y],
      [12, 12],
      [13, 22],
      [10, 27],
      [8, 39],
      [14, 43],
      [18, 39],
      [24, 44],
      [28, 39],
      [35, 43],
      [40, 39],
      [35, 29],
      [35, 19],
      [32, 10],
    ],
    ink,
  );
  p.poly(
    [
      [x, 9 + y],
      [15, 15],
      [15, 24],
      [12, 30],
      [10, 39],
      [18, 38],
      [23, 42],
      [28, 37],
      [36, 40],
      [33, 26],
      [31, 16],
    ],
    violet,
  );
  p.line(15, 19, 13, 35 + y, velvet, 2);
  p.line(33, 20, 36, 34 + y, orchid);
  p.poly(
    [
      [x - 7, 11 + y],
      [x, 7 + y],
      [x + 7, 11 + y],
      [x + 5, 19 + y],
      [x, 23 + y],
      [x - 5, 19 + y],
    ],
    steelShadow,
  );
  if (!back) {
    p.poly(
      [
        [x - 5, 12 + y],
        [x + 5, 12 + y],
        [x + 4, 17 + y],
        [x + 2, 18 + y],
        [x + 1, 23 + y],
        [x - 2, 22 + y],
        [x - 3, 18 + y],
      ],
      ivory,
    );
    p.rect(x - 4, 14 + y, 3, 2, ink);
    p.rect(x + 1, 14 + y, 3, 2, ink);
    p.pixel(x - 1, 17 + y, ink);
  }
  for (const i of [0, 1, 2, 3]) p.pixel(x + 1, 24 + y + i * 3, steel);
  p.line(lantern - 3, 16, lantern + 1, 21 + y, steelShadow);
  p.line(lantern + 1, 21 + y, lantern + 1, 25 + y, ivory);
  p.rect(lantern - 4, 25 + y, 9, 10, steelShadow);
  p.rect(lantern - 3, 27 + y, 7, 6, violet);
  diamond(p, lantern, 30 + y, 3, orchid);
  p.pixel(lantern, 29 + y, gem);
  p.line(lantern - 4, 34 + y, lantern + 4, 34 + y, ivory);
  p.pixel(lantern - 6, 29 - y, orchid);
  p.pixel(lantern + 5, 31 - y, orchid);
}

export function drawFlyingSkull(p, dir, step) {
  const { x, y, back } = pose(dir, step);
  p.rect(14, 41, 20, 2, ink, 125);
  p.poly(
    [
      [x - 10, 29],
      [x - 11, 19],
      [x - 7, 13],
      [x - 8, 6 + y],
      [x - 3, 11],
      [x + 1, 5 + y],
      [x + 3, 13],
      [x + 8, 9 + y],
      [x + 11, 18],
      [x + 10, 28],
    ],
    violet,
  );
  p.poly(
    [
      [x - 8, 24],
      [x - 8, 17],
      [x - 4, 13],
      [x - 1, 16],
      [x + 2, 11 + y],
      [x + 7, 15],
      [x + 8, 23],
    ],
    orchid,
  );
  p.poly(
    [
      [x - 9, 22 + y],
      [x - 5, 16 + y],
      [x + 5, 16 + y],
      [x + 9, 21 + y],
      [x + 8, 28 + y],
      [x + 4, 30 + y],
      [x + 3, 35 + y],
      [x - 4, 35 + y],
      [x - 5, 30 + y],
      [x - 8, 28 + y],
    ],
    steel,
  );
  p.line(x - 5, 18 + y, x + 4, 18 + y, ivory, 2);
  if (!back) {
    p.rect(x - 6, 22 + y, 5, 4, ink);
    p.rect(x + 2, 22 + y, 5, 4, ink);
    p.pixel(x - 3, 23 + y, gem);
    p.pixel(x + 4, 23 + y, gem);
    p.line(x, 27 + y, x - 1, 29 + y, ink);
    for (const i of [-2, 1]) p.pixel(x + i, 34 + y, ink);
  }
  p.pixel(x - 11, 16 - y, orchid);
  p.pixel(x + 11, 20 - y, gem);
}

export function drawEyeBeast(p, dir, step) {
  const { x, y, back } = pose(dir, step);
  p.rect(11, 41, 26, 2, ink, 145);
  for (const [dx, dy] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ]) {
    const tip = 24 + 17 * dx;
    p.line(24 + dx * 7, 24 + dy * 5, 24 + dx * 13, 24 + dy * 11, violet, 3);
    p.line(24 + dx * 13, 24 + dy * 11, tip, 24 + dy * 7 + y, velvet, 2);
    p.pixel(tip, 24 + dy * 7 + y, orchid);
  }
  p.poly(
    [
      [24, 9 + y],
      [33, 12 + y],
      [38, 19 + y],
      [38, 26 + y],
      [34, 32 + y],
      [25, 37 + y],
      [17, 34 + y],
      [10, 27 + y],
      [10, 19 + y],
      [16, 12 + y],
    ],
    ink,
  );
  p.poly(
    [
      [24, 11 + y],
      [32, 14 + y],
      [36, 19 + y],
      [36, 26 + y],
      [32, 31 + y],
      [24, 34 + y],
      [17, 31 + y],
      [12, 25 + y],
      [13, 18 + y],
      [17, 13 + y],
    ],
    velvet,
  );
  if (back) {
    diamond(p, 24, 22 + y, 7, violet);
    p.line(19, 22 + y, 29, 22 + y, orchid);
    return;
  }
  p.poly(
    [
      [x - 10, 23 + y],
      [x - 6, 18 + y],
      [x, 16 + y],
      [x + 6, 18 + y],
      [x + 10, 23 + y],
      [x + 6, 27 + y],
      [x, 29 + y],
      [x - 7, 26 + y],
    ],
    steel,
  );
  diamond(p, x, 23 + y, 6, orchid);
  p.rect(x - 2, 19 + y, 5, 9, ink);
  p.rect(x - 1, 21 + y, 2, 4, violet);
  p.pixel(x + 1, 20 + y, ivory);
}

export function drawShadowBat(p, dir, step) {
  const { x, y, back } = pose(dir, step);
  const wings = step ? 7 : 0;
  p.rect(13, 39, 22, 2, ink, 115);
  p.poly(
    [
      [22, 23],
      [15, 18],
      [4, 12 + wings],
      [2, 15 + wings],
      [5, 28 + wings],
      [11, 26 + wings],
      [15, 31],
      [19, 29],
      [24, 34],
      [29, 29],
      [33, 31],
      [37, 26 + wings],
      [43, 28 + wings],
      [46, 15 + wings],
      [44, 12 + wings],
      [32, 18],
      [26, 23],
    ],
    ink,
  );
  p.poly(
    [
      [21, 25],
      [15, 20],
      [5, 15 + wings],
      [7, 25 + wings],
      [12, 23 + wings],
      [16, 28],
      [18, 26],
    ],
    velvet,
  );
  p.poly(
    [
      [27, 25],
      [33, 20],
      [44, 15 + wings],
      [41, 25 + wings],
      [36, 23 + wings],
      [32, 28],
      [30, 26],
    ],
    velvet,
  );
  p.line(5, 15 + wings, 16, 23, orchid);
  p.line(44, 15 + wings, 32, 23, orchid);
  p.poly(
    [
      [x - 6, 23 + y],
      [x - 5, 16 + y],
      [x - 1, 21 + y],
      [x + 2, 21 + y],
      [x + 5, 16 + y],
      [x + 6, 24 + y],
      [x + 4, 30 + y],
      [x, 33 + y],
      [x - 4, 31 + y],
    ],
    violet,
  );
  if (!back) {
    p.pixel(x - 3, 25 + y, gem);
    p.pixel(x + 3, 25 + y, gem);
    p.pixel(x, 29 + y, steel);
  }
}

export function drawGhostWisp(p, dir, step) {
  const { x, y, reverse, back } = pose(dir, step);
  const tail = reverse ? 4 : -4;
  p.rect(14, 41, 22, 2, ink, 115);
  p.poly(
    [
      [x, 8 + y],
      [x + 8, 9 + y],
      [x + 13, 16 + y],
      [x + 11, 25 + y],
      [x + 8, 31 + y],
      [x - 2, 35 + y],
      [x - 8 + tail, 40],
      [x - 13 + tail, 40],
      [x - 7 + tail, 34],
      [x - 9, 28],
      [x - 12, 22],
      [x - 10, 13 + y],
    ],
    violet,
  );
  p.poly(
    [
      [x, 9 + y],
      [x + 7, 10 + y],
      [x + 11, 16 + y],
      [x + 9, 24 + y],
      [x + 6, 30 + y],
      [x - 2, 34 + y],
      [x - 9 + tail, 38],
      [x - 6, 30],
      [x - 10, 22],
      [x - 8, 14 + y],
    ],
    steel,
  );
  p.poly(
    [
      [x - 5, 13 + y],
      [x + 4, 12 + y],
      [x + 8, 16 + y],
      [x + 7, 25 + y],
      [x + 2, 30 + y],
      [x - 5, 27 + y],
      [x - 7, 22 + y],
    ],
    gem,
  );
  p.line(x - 8, 18 + y, x - 6, 13 + y, ivory, 2);
  if (!back) {
    p.rect(x - 4, 18 + y, 3, 5, ink);
    p.rect(x + 3, 18 + y, 3, 5, ink);
    p.rect(x, 24 + y, 2, 4, violet);
  }
  p.pixel(x - 12, 25 + y, orchid);
  p.pixel(x + 11, 25 - y, gem);
  p.line(x - 8 + tail, 39, x - 12 + tail, 42, velvet);
}
