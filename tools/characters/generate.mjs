import { mkdirSync, writeFileSync } from "node:fs";
import {
  wizardDirections,
  wizards,
  wizardSheet,
} from "../../packages/game-assets/src/wizards.ts";
import { painter, png, surface } from "../dungeon/pixels.mjs";

const ink = 0x181321;
const skin = 0xdb9e75;
const skinLight = 0xfac59b;
const beard = 0xe1dadd;
const beardShade = 0x9b8eaa;

// Cloth shadow, base, highlight, trim, glint, and insignia fill.
const colors = {
  fire: [0x642337, 0xaa3439, 0xe45143, 0xf5a84c, 0xffdf85, 0xff7238],
  ice: [0x233c75, 0x3965ad, 0x648bda, 0x8ed7fa, 0xe7faff, 0x49cafa],
  lightning: [0x3e255f, 0x633e92, 0x9164c2, 0xeab349, 0xffe492, 0xffca4f],
  earth: [0x314331, 0x4d6340, 0x768a4d, 0xb78558, 0xe0be8b, 0xa9cf62],
  wind: [0x204452, 0x2c6f78, 0x449e9c, 0xabcec7, 0xe2efe1, 0x76dacc],
  healer: [0x806779, 0xc1a590, 0xefe0c1, 0x72b18a, 0xffdda0, 0x63d3a2],
  defense: [0x262e56, 0x3a4a82, 0x606fa9, 0xb5b6c8, 0xffd987, 0xe6b95e],
};

const crowns = {
  fire: [
    [7, 15],
    [10, 11],
    [13, 6],
    [19, 2],
    [22, 3],
    [25, 7],
    [27, 8],
    [29, 6],
    [27, 11],
    [24, 12],
    [21, 10],
    [21, 15],
  ],
  ice: [
    [6, 15],
    [10, 11],
    [10, 6],
    [15, 3],
    [19, 3],
    [23, 7],
    [24, 12],
    [26, 15],
  ],
  lightning: [
    [6, 15],
    [10, 10],
    [13, 9],
    [13, 5],
    [20, 3],
    [23, 5],
    [25, 9],
    [22, 10],
    [24, 15],
  ],
  earth: [
    [6, 15],
    [9, 10],
    [9, 7],
    [13, 4],
    [18, 4],
    [22, 6],
    [24, 11],
    [26, 15],
  ],
  wind: [
    [7, 15],
    [10, 10],
    [15, 4],
    [20, 4],
    [21, 6],
    [19, 11],
    [25, 15],
  ],
  healer: [
    [6, 15],
    [10, 10],
    [8, 7],
    [5, 10],
    [3, 10],
    [6, 5],
    [11, 3],
    [17, 5],
    [21, 9],
    [23, 15],
  ],
  defense: [
    [6, 15],
    [10, 9],
    [12, 5],
    [17, 3],
    [21, 5],
    [23, 10],
    [24, 15],
  ],
};

function motif(draw, id, x, y, light, fill) {
  const { pixel, rect, poly, line } = draw;
  if (id === "fire") {
    poly(
      [
        [x - 3, y + 3],
        [x - 4, y],
        [x - 1, y - 3],
        [x - 1, y],
        [x + 2, y - 5],
        [x + 4, y],
        [x + 3, y + 3],
        [x, y + 5],
      ],
      light,
    );
    pixel(x, y + 2, fill);
  } else if (id === "ice") {
    line(x, y - 4, x, y + 4, light);
    line(x - 3, y - 2, x + 3, y + 2, light);
    line(x - 3, y + 2, x + 3, y - 2, light);
    pixel(x, y, fill);
  } else if (id === "lightning") {
    poly(
      [
        [x, y - 5],
        [x + 3, y - 5],
        [x + 1, y - 1],
        [x + 4, y - 1],
        [x - 3, y + 5],
        [x - 1, y + 1],
        [x - 4, y + 1],
      ],
      light,
    );
  } else if (id === "earth") {
    poly(
      [
        [x - 4, y + 1],
        [x - 2, y - 3],
        [x + 1, y - 4],
        [x + 4, y - 3],
        [x + 2, y + 2],
        [x - 1, y + 4],
      ],
      fill,
    );
    line(x - 3, y + 4, x + 2, y - 2, light);
  } else if (id === "wind") {
    line(x - 4, y + 3, x + 4, y - 4, light);
    for (let i = 0; i < 4; i++)
      line(x - 2 + i, y + 1 - i, x - 3 + i, y - 2 - i, fill);
  } else if (id === "healer") {
    rect(x - 1, y - 4, 3, 9, fill);
    rect(x - 4, y - 1, 9, 3, fill);
    pixel(x, y, light);
  } else {
    poly(
      [
        [x - 4, y - 4],
        [x + 5, y - 4],
        [x + 4, y + 1],
        [x, y + 5],
        [x - 3, y + 2],
      ],
      light,
    );
    poly(
      [
        [x - 2, y - 3],
        [x + 3, y - 3],
        [x + 2, y + 1],
        [x, y + 3],
        [x - 2, y + 1],
      ],
      fill,
    );
  }
}

function drawWizard(p, id, direction, phase) {
  const [shade, cloth, bright, trim, glint, gem] = colors[id];
  const back = direction === "up";
  const side = direction === "left" || direction === "right";
  const mirrored = direction === "left";
  const stride = phase === 2 ? -1 : phase === 4 ? 1 : 0;
  const bob = phase === 1 || stride !== 0 ? -1 : 0;
  const flip = (x) => (mirrored ? 32 - x : x);
  const rect = (x, y, w, h, c) => p.rect(mirrored ? 33 - x - w : x, y, w, h, c);
  const pixel = (x, y, c) => p.pixel(flip(x), y, c);
  const poly = (points, c) =>
    p.poly(
      points.map(([x, y]) => [flip(x), y]),
      c,
    );
  const line = (x, y, dx, dy, c) => p.line(flip(x), y, flip(dx), dy, c);
  const symbol = { rect, pixel, poly, line };
  const shifted = (points, c) =>
    poly(
      points.map(([x, y]) => [x, y + bob]),
      c,
    );
  function shoe(x, y) {
    rect(x, y, 6, 5, ink);
    rect(x + 1, y + 1, 4, 3, id === "defense" ? trim : 0x76535b);
    rect(x + 1, y + 3, 4, 1, 0x312130);
    pixel(x + 4, y + 1, glint);
  }
  if (side) {
    shoe(13 + stride * 3, 38 - Math.abs(stride));
    shoe(17 - stride * 4, 40);
  } else {
    shoe(9, 40 + stride);
    shoe(17, 40 - stride);
  }

  const hem = 40 + bob;
  const cape = side
    ? [
        [13, 21],
        [21, 22],
        [24, 29],
        [20, 33],
        [22, hem - 1],
        [14, hem],
        [7 + stride, hem - 2],
        [10, 30],
      ]
    : [
        [10, 21],
        [23, 21],
        [26, 28],
        [25, 33],
        [27 + stride, hem - 1],
        [18, hem + 1],
        [7 + stride, hem],
        [5, hem - 3],
        [8, 29],
      ];
  poly(cape, ink);
  poly(
    side
      ? [
          [13, 23],
          [21, 24],
          [22, 29],
          [18, 33],
          [20, hem - 1],
          [14, hem - 1],
          [8 + stride, hem - 2],
          [11, 30],
        ]
      : [
          [11, 23],
          [22, 23],
          [24, 28],
          [23, 33],
          [25 + stride, hem - 1],
          [18, hem],
          [8 + stride, hem - 1],
          [7, hem - 3],
          [10, 29],
        ],
    shade,
  );
  poly(
    side
      ? [
          [12, 24],
          [17, 25],
          [17, 31],
          [15, 35],
          [19, hem - 1],
          [10 + stride, hem - 2],
        ]
      : [
          [11, 24],
          [22, 24],
          [21, 29],
          [23 + stride, hem - 2],
          [18, hem - 1],
          [9 + stride, hem - 2],
          [11, 33],
        ],
    cloth,
  );
  line(side ? 12 : 9, 30, (side ? 10 : 8) + stride, hem - 2, bright);
  line(
    (side ? 10 : 8) + stride,
    hem - 2,
    (side ? 19 : 23) + stride,
    hem - 2,
    trim,
  );

  if (back) {
    poly(
      [
        [8, 24],
        [14, 21],
        [22, 22],
        [25, 26],
        [18, 28],
        [10, 27],
      ],
      trim,
    );
    motif(symbol, id, 16 + stride, 34 + bob, glint, gem);
  } else {
    shifted(
      [
        [10, 24],
        [16, 26],
        [22, 23],
        [20, 29],
        [13, 30],
      ],
      trim,
    );
    line(12, 31 + bob, side ? 21 : 22, 31 + bob, ink);
    rect(side ? 18 : 15, 30 + bob, 4, 3, glint);
    if (!side) motif(symbol, id, 16 + stride, 36 + bob, trim, gem);
  }

  if (id === "earth" || id === "defense" || id === "ice") {
    const plate = id === "ice" ? 0xd1dce9 : id === "earth" ? 0x9b857f : trim;
    for (const x of side ? [12] : [9, 23]) {
      shifted(
        [
          [x - 4, 26],
          [x - 3, 23],
          [x, 22],
          [x + 4, 24],
          [x + 3, 28],
          [x - 1, 29],
        ],
        ink,
      );
      shifted(
        [
          [x - 3, 25],
          [x, 23],
          [x + 3, 24],
          [x + 2, 27],
          [x - 1, 28],
        ],
        plate,
      );
      line(x - 2, 25 + bob, x + 1, 24 + bob, glint);
    }
  }

  if (!back) {
    const x = side ? 19 : 12;
    rect(x - 1, 16 + bob, side ? 7 : 11, 7, ink);
    rect(x, 16 + bob, side ? 5 : 9, 6, skin);
    rect(x + 1, 18 + bob, side ? 4 : 7, 2, skinLight);
    pixel(x + (side ? 3 : 2), 18 + bob, ink);
    if (!side) pixel(x + 6, 18 + bob, ink);
    shifted(
      side
        ? [
            [18, 20],
            [23, 21],
            [25, 23],
            [23, 25],
            [20, 28],
            [17, 23],
          ]
        : [
            [11, 21],
            [13, 20],
            [16, 21],
            [19, 20],
            [22, 21],
            [21, 25],
            [16, 29],
            [12, 25],
          ],
      beardShade,
    );
    shifted(
      side
        ? [
            [19, 21],
            [24, 22],
            [23, 24],
            [21, 26],
            [20, 23],
          ]
        : [
            [12, 21],
            [16, 22],
            [20, 21],
            [20, 24],
            [16, 27],
            [13, 24],
          ],
      beard,
    );
    pixel(side ? 24 : 16, 20 + bob, skinLight);
  } else {
    shifted(
      [
        [9, 15],
        [22, 15],
        [24, 22],
        [22, 24],
        [12, 24],
        [9, 22],
      ],
      beardShade,
    );
    line(12, 21 + bob, 20, 22 + bob, beard);
  }

  shifted(crowns[id], ink);
  const peak = id === "fire" ? 19 : id === "healer" ? 11 : 16;
  shifted(
    [
      [8, 15],
      [12, 10],
      [peak - 2, 6],
      [peak, 4],
      [22, 8],
      [21, 10],
      [24, 15],
    ],
    shade,
  );
  shifted(
    [
      [10, 14],
      [13, 9],
      [peak, 5],
      [peak + 3, 6],
      [18, 11],
      [22, 14],
    ],
    cloth,
  );
  line(Math.min(peak, 19), 6 + bob, 13, 10 + bob, bright);
  shifted(
    [
      [11, 12],
      [19, 12],
      [23, 13],
      [25, 15],
      [9, 15],
    ],
    trim,
  );
  shifted(
    side
      ? [
          [4, 16],
          [10, 14],
          [24, 14],
          [31, 17],
          [29, 19],
          [12, 19],
          [4, 18],
        ]
      : [
          [1, 17],
          [8, 14],
          [24, 14],
          [30, 16],
          [31, 18],
          [27, 20],
          [6, 19],
          [2, 19],
        ],
    ink,
  );
  shifted(
    [
      [3, 17],
      [9, 15],
      [24, 15],
      [29, 17],
      [26, 18],
      [6, 18],
    ],
    bright,
  );
  line(5, 17 + bob, 10, 16 + bob, glint);
  line(10, 16 + bob, 24, 16 + bob, trim);
  if (!back) {
    shifted(
      [
        [15, 14],
        [18, 10],
        [21, 14],
        [18, 17],
      ],
      glint,
    );
    pixel(18, 13 + bob, gem);
  }
  if (id === "wind") motif(symbol, id, 9, 10 + bob, glint, trim);

  const staffX = side ? 27 : back ? 5 : 27;
  const staffY = 25 + bob - stride;
  rect(staffX, staffY - 11, 2, 26, ink);
  rect(staffX, staffY - 9, 1, 23, id === "earth" ? 0xbb865f : 0x907584);
  rect(staffX - 1, staffY + 2, 3, 3, skin);
  rect(staffX, staffY - 6, 2, 3, trim);
  if (id === "ice") {
    poly(
      [
        [staffX - 3, staffY - 10],
        [staffX, staffY - 17],
        [staffX + 4, staffY - 12],
        [staffX + 2, staffY - 7],
      ],
      gem,
    );
    line(staffX, staffY - 16, staffX - 1, staffY - 10, glint);
  } else {
    motif(symbol, id, staffX, staffY - 12, glint, gem);
  }
}

const folder = new URL(
  "../../apps/web/public/assets/characters/",
  import.meta.url,
);
mkdirSync(folder, { recursive: true });
const { frameWidth, frameHeight, columns } = wizardSheet;
for (const wizard of Object.values(wizards)) {
  const sheet = surface(
    frameWidth * columns,
    frameHeight * wizardDirections.length,
  );
  for (const [row, direction] of wizardDirections.entries()) {
    for (let index = 0; index < columns; index++) {
      drawWizard(
        painter(sheet, index * frameWidth, row * frameHeight, {
          width: frameWidth,
          height: frameHeight,
        }),
        wizard.id,
        direction,
        index,
      );
    }
  }
  writeFileSync(new URL(`${wizard.id}.png`, folder), png(sheet));
}
