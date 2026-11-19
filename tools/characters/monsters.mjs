import { mkdirSync, writeFileSync } from "node:fs";
import { painter, png, surface } from "../dungeon/pixels.mjs";
import {
  drawEyeBeast,
  drawFlyingSkull,
  drawGhostWisp,
  drawOverlordRegalia,
  drawShadowBat,
  drawShadowGuard,
  drawSoulDrainer,
} from "./shadowArmy.mjs";

const output = new URL(
  "../../apps/web/public/assets/monsters/",
  import.meta.url,
);
mkdirSync(output, { recursive: true });

const size = 48;

// --- Colour palette ---
const P = {
  // Darks — charcoal, NOT near-black
  void: 0x120e20,
  bodyDark: 0x221a40,
  bodyMid: 0x3c2e64,
  bodyLight: 0x584888,
  // Purples & lavenders — very visible
  glow1: 0x8060b8,
  glow2: 0xb090d8,
  glow3: 0xd4b8f0,
  glow4: 0xeee0ff,
  white: 0xffffff,
  wispDark: 0x6648a0,
  wispMid: 0xa078d0,
  wispBright: 0xd0aaee,
  // Lava
  rock: 0x1a0a06,
  rockMid: 0x381a10,
  magma1: 0xff6b30,
  magma2: 0xffb040,
  magmaGlow: 0xffe0a0,
  // Mage
  robeDark: 0x2c1c50,
  robeMid: 0x503888,
  arcane: 0xd898f8,
  arcaneBright: 0xf0d0ff,
  // Ground shadow
  shadow: 0x060410,
};

// --- Shadow Stalker (wraith, inspired by PixelFX ghost critter) ---
function drawShadow(p, dir, step) {
  const { poly, rect, line, pixel } = p;
  const bob = step;
  const face = dir === 2 ? -3 : dir === 3 ? 3 : 0;

  // Ground shadow
  poly(
    [
      [16, 43],
      [32, 43],
      [34, 45],
      [14, 45],
    ],
    P.shadow,
  );

  // Wispy bottom tendrils
  for (let i = 0; i < 5; i++) {
    const tx = 14 + i * 5 + (step ? 1 : 0);
    const th = 38 + (i % 2) * 2 + bob;
    line(tx, th, tx + (i % 2 ? -2 : 2), 44, P.wispMid);
    pixel(tx + (i % 2 ? -1 : 1), 42, P.wispBright);
    pixel(tx, 44, P.wispDark);
  }

  // Main body cloak
  poly(
    [
      [24 + face, 8 + bob],
      [14, 14],
      [11, 22],
      [9, 32],
      [12, 38 + bob],
      [16, 42],
      [20, 39 + bob],
      [24, 43],
      [28, 39 + bob],
      [32, 42],
      [36, 38 + bob],
      [39, 32],
      [37, 22],
      [34, 14],
    ],
    P.bodyDark,
  );

  // Inner cloak layer
  poly(
    [
      [24 + face, 11 + bob],
      [16, 16],
      [13, 23],
      [12, 32],
      [15, 37],
      [20, 36 + bob],
      [24, 40],
      [28, 36 + bob],
      [33, 37],
      [36, 32],
      [35, 23],
      [32, 16],
    ],
    P.bodyMid,
  );

  // Ethereal edge highlights
  line(13, 23, 12, 34, P.bodyLight);
  line(35, 23, 36, 34, P.bodyLight);
  line(12, 34, 16, 42, P.wispDark);
  line(36, 34, 32, 42, P.wispDark);
  // Shoulder highlights
  pixel(12, 20, P.glow1);
  pixel(36, 20, P.glow1);

  // Hood
  poly(
    [
      [24 + face, 6 + bob],
      [16 + face, 11 + bob],
      [15 + face, 18 + bob],
      [20 + face, 22 + bob],
      [28 + face, 22 + bob],
      [33 + face, 18 + bob],
      [32 + face, 11 + bob],
    ],
    P.bodyDark,
  );

  // Hood rim
  line(16 + face, 11 + bob, 24 + face, 7 + bob, P.bodyLight);
  line(24 + face, 7 + bob, 32 + face, 11 + bob, P.bodyLight);

  // Eyes (glowing lavender — large and bright)
  if (dir !== 1) {
    // Left eye
    rect(19 + face, 14 + bob, 3, 3, P.bodyDark);
    pixel(20 + face, 15 + bob, P.glow3);
    pixel(21 + face, 15 + bob, P.glow4);
    pixel(20 + face, 14 + bob, P.glow2);
    pixel(21 + face, 14 + bob, P.glow2);
    // Right eye
    rect(25 + face, 14 + bob, 3, 3, P.bodyDark);
    pixel(26 + face, 15 + bob, P.glow3);
    pixel(27 + face, 15 + bob, P.glow4);
    pixel(26 + face, 14 + bob, P.glow2);
    pixel(27 + face, 14 + bob, P.glow2);
  }

  // Ethereal wisps floating from body — bright trails
  line(10, 26 + bob, 7, 22 + bob, P.wispMid);
  line(38, 28 + bob, 41, 24 + bob, P.wispMid);
  pixel(7, 22 + bob, P.glow3);
  pixel(41, 24 + bob, P.glow3);
  pixel(8, 24, P.wispBright);
  pixel(40, 26, P.wispBright);
  pixel(9, 30 + bob, P.glow2);
  pixel(39, 32 + bob, P.glow2);
}

// --- Cinder Creature (lava elemental, inspired by PixelFX flying skull) ---
function drawLava(p, dir, step) {
  const { poly, rect, line, pixel } = p;
  const bob = step;
  const face = dir === 2 ? -3 : dir === 3 ? 3 : 0;

  // Ground shadow
  poly(
    [
      [14, 42],
      [34, 42],
      [36, 45],
      [12, 45],
    ],
    P.shadow,
  );

  // Legs / rocky base
  poly(
    [
      [18, 36 + bob],
      [14, 42],
      [20, 44],
      [24, 40 + bob],
      [28, 44],
      [34, 42],
      [30, 36 + bob],
    ],
    P.rock,
  );

  // Body (bulky rocky form)
  poly(
    [
      [24 + face, 10 + bob],
      [15, 16],
      [11, 24],
      [12, 32],
      [15, 38 + bob],
      [33, 38 + bob],
      [36, 32],
      [37, 24],
      [33, 16],
    ],
    P.rockMid,
  );

  // Magma cracks — bright glowing lines
  line(20, 20, 18, 30, P.magma1);
  line(28, 18, 30, 28, P.magma2);
  line(18, 25, 30, 25, P.magma1);
  line(22, 22, 26, 32, P.magma2);
  // Core glow
  rect(22, 24, 4, 4, P.magma1);
  rect(23, 25, 2, 2, P.magmaGlow);

  // Shoulder ember glow
  pixel(13, 20, P.magma1);
  pixel(35, 22, P.magma2);
  pixel(12, 26, P.magma1);
  pixel(36, 28, P.magma2);

  // Head / top
  poly(
    [
      [24 + face, 8 + bob],
      [17 + face, 12 + bob],
      [16 + face, 18 + bob],
      [20 + face, 22 + bob],
      [28 + face, 22 + bob],
      [32 + face, 18 + bob],
      [31 + face, 12 + bob],
    ],
    P.rockMid,
  );

  // Eyes (burning orange)
  if (dir !== 1) {
    rect(19 + face, 14 + bob, 3, 2, P.magma1);
    rect(26 + face, 14 + bob, 3, 2, P.magma1);
    pixel(20 + face, 14 + bob, P.magmaGlow);
    pixel(27 + face, 14 + bob, P.magmaGlow);
  }

  // Horns
  line(17 + face, 12 + bob, 14 + face, 6 + bob, P.rock);
  line(31 + face, 12 + bob, 34 + face, 6 + bob, P.rock);
  pixel(14 + face, 6 + bob, P.magma1);
  pixel(34 + face, 6 + bob, P.magma1);
}

// --- Dark Mage (hooded spellcaster) ---
function drawMage(p, dir, step) {
  const { poly, rect, line, pixel } = p;
  const bob = step;
  const face = dir === 2 ? -3 : dir === 3 ? 3 : 0;

  // Ground shadow
  poly(
    [
      [16, 43],
      [32, 43],
      [34, 45],
      [14, 45],
    ],
    P.shadow,
  );

  // Robe bottom
  poly(
    [
      [16, 32],
      [13, 38 + bob],
      [14, 44],
      [22, 42 + bob],
      [24, 44],
      [26, 42 + bob],
      [34, 44],
      [35, 38 + bob],
      [32, 32],
    ],
    P.robeDark,
  );

  // Robe body
  poly(
    [
      [24 + face, 12 + bob],
      [16, 16],
      [14, 24],
      [15, 32],
      [33, 32],
      [34, 24],
      [32, 16],
    ],
    P.robeMid,
  );

  // Inner robe
  poly(
    [
      [24 + face, 14 + bob],
      [18, 18],
      [16, 24],
      [17, 30],
      [31, 30],
      [32, 24],
      [30, 18],
    ],
    P.robeDark,
  );

  // Arcane symbol on chest
  if (dir === 0 || dir === 1) {
    pixel(23, 22, P.arcane);
    pixel(24, 21, P.arcaneBright);
    pixel(25, 22, P.arcane);
    pixel(24, 23, P.arcane);
    pixel(24, 22, P.glow4);
  }

  // Robe trim highlights
  line(14, 24, 15, 32, P.bodyLight);
  line(34, 24, 33, 32, P.bodyLight);

  // Hood
  poly(
    [
      [24 + face, 6 + bob],
      [16 + face, 11 + bob],
      [15 + face, 18 + bob],
      [19 + face, 22 + bob],
      [29 + face, 22 + bob],
      [33 + face, 18 + bob],
      [32 + face, 11 + bob],
    ],
    P.robeDark,
  );

  // Hood rim
  line(17 + face, 11 + bob, 24 + face, 7 + bob, P.robeMid);
  line(24 + face, 7 + bob, 31 + face, 11 + bob, P.robeMid);

  // Eyes (glowing purple)
  if (dir !== 1) {
    pixel(20 + face, 15 + bob, P.arcane);
    pixel(21 + face, 15 + bob, P.arcaneBright);
    pixel(27 + face, 15 + bob, P.arcane);
    pixel(28 + face, 15 + bob, P.arcaneBright);
    // Eye glow halo
    pixel(20 + face, 14 + bob, P.glow1);
    pixel(28 + face, 14 + bob, P.glow1);
  }

  // Staff
  const sx = dir === 2 ? 10 : 36;
  line(sx, 12, sx, 44, P.robeMid, 2);
  // Staff orb — bright
  rect(sx - 2, 8, 5, 5, P.glow1);
  rect(sx - 1, 9, 3, 3, P.arcane);
  pixel(sx, 10, P.arcaneBright);
  // Staff glow particles
  pixel(sx - 2, 7, P.glow2);
  pixel(sx + 2, 7, P.glow2);
  pixel(sx, 7, P.arcane);
}

// --- Shadow Servant (small wispy minion, inspired by PixelFX bat) ---
function drawServant(p, dir, step) {
  const { poly, line, pixel } = p;
  const bob = step;
  const face = dir === 2 ? -2 : dir === 3 ? 2 : 0;

  // Shadow
  poly(
    [
      [18, 42],
      [30, 42],
      [32, 44],
      [16, 44],
    ],
    P.shadow,
  );

  // Wispy tendrils
  for (let i = 0; i < 3; i++) {
    const tx = 18 + i * 5;
    line(tx, 36 + bob, tx + (i % 2 ? 2 : -2), 42, P.wispMid);
    pixel(tx + (i % 2 ? 1 : -1), 40, P.wispBright);
  }

  // Small body
  poly(
    [
      [24 + face, 14 + bob],
      [18, 18],
      [16, 24],
      [17, 32],
      [19, 36 + bob],
      [29, 36 + bob],
      [31, 32],
      [32, 24],
      [30, 18],
    ],
    P.bodyDark,
  );

  // Inner body
  poly(
    [
      [24 + face, 16 + bob],
      [20, 20],
      [18, 25],
      [19, 31],
      [21, 34 + bob],
      [27, 34 + bob],
      [29, 31],
      [30, 25],
      [28, 20],
    ],
    P.bodyMid,
  );

  // Head
  poly(
    [
      [24 + face, 10 + bob],
      [19 + face, 14 + bob],
      [18 + face, 20 + bob],
      [22 + face, 23 + bob],
      [26 + face, 23 + bob],
      [30 + face, 20 + bob],
      [29 + face, 14 + bob],
    ],
    P.bodyDark,
  );

  // Eyes — bright
  if (dir !== 1) {
    pixel(21 + face, 17 + bob, P.glow3);
    pixel(22 + face, 17 + bob, P.glow4);
    pixel(26 + face, 17 + bob, P.glow3);
    pixel(27 + face, 17 + bob, P.glow4);
  }

  // Wing nubs with purple tips
  if (dir === 0 || dir === 2 || dir === 3) {
    line(16, 22, 12, 18 + bob, P.bodyLight);
    line(32, 22, 36, 18 + bob, P.bodyLight);
    pixel(12, 18 + bob, P.glow2);
    pixel(36, 18 + bob, P.glow2);
  }
}

// --- Illusion (ghostly double of overlord) ---
function drawIllusion(p, dir, step) {
  const { poly, line, pixel } = p;
  const bob = step;
  const face = dir === 2 ? -3 : dir === 3 ? 3 : 0;

  // No ground shadow (ethereal)

  // Wispy bottom
  for (let i = 0; i < 4; i++) {
    const tx = 15 + i * 5;
    line(tx, 38 + bob, tx + (i % 2 ? 2 : -2), 44, P.wispMid);
    pixel(tx, 42, P.wispBright);
  }

  // Transparent body shape (lighter, ghostly overlord)
  poly(
    [
      [24 + face, 10 + bob],
      [14, 16],
      [11, 24],
      [10, 32],
      [13, 38 + bob],
      [18, 42],
      [22, 39 + bob],
      [24, 43],
      [26, 39 + bob],
      [30, 42],
      [35, 38 + bob],
      [38, 32],
      [37, 24],
      [34, 16],
    ],
    P.bodyMid,
  );

  // Inner
  poly(
    [
      [24 + face, 13 + bob],
      [16, 18],
      [14, 25],
      [13, 33],
      [16, 37],
      [22, 36 + bob],
      [24, 40],
      [26, 36 + bob],
      [32, 37],
      [35, 33],
      [34, 25],
      [32, 18],
    ],
    P.bodyLight,
  );

  // Ethereal edge highlights — bright
  line(14, 25, 13, 35, P.glow2);
  line(34, 25, 35, 35, P.glow2);

  // Hood
  poly(
    [
      [24 + face, 7 + bob],
      [17 + face, 12 + bob],
      [16 + face, 19 + bob],
      [21 + face, 22 + bob],
      [27 + face, 22 + bob],
      [32 + face, 19 + bob],
      [31 + face, 12 + bob],
    ],
    P.bodyMid,
  );

  // Hood rim
  line(17 + face, 12 + bob, 24 + face, 8 + bob, P.glow1);
  line(24 + face, 8 + bob, 31 + face, 12 + bob, P.glow1);

  // Ghost eyes — slightly dimmer than overlord
  if (dir !== 1) {
    pixel(20 + face, 15 + bob, P.glow3);
    pixel(21 + face, 15 + bob, P.glow4);
    pixel(26 + face, 15 + bob, P.glow3);
    pixel(27 + face, 15 + bob, P.glow4);
  }

  // Faint wing outlines with tips
  line(11, 20, 7, 14 + bob, P.bodyLight);
  line(37, 20, 41, 14 + bob, P.bodyLight);
  pixel(7, 14 + bob, P.glow2);
  pixel(41, 14 + bob, P.glow2);
}

// --- Shadow Overlord (THE BOSS — matching reference image) ---
// Dark spectral winged entity: dark charcoal body, purple/lavender ghostly wisps,
// glowing white eyes, horn-like crown protrusions, dark wings with purple energy
// at tips, tattered flowing lower body
function drawOverlord(p, dir, step) {
  const { poly, rect, line, pixel } = p;
  const bob = step;
  const face = dir === 2 ? -2 : dir === 3 ? 2 : 0;

  // Ground shadow (larger boss)
  poly(
    [
      [10, 42],
      [38, 42],
      [40, 46],
      [8, 46],
    ],
    P.shadow,
  );

  // --- Purple wisps trailing at the bottom (ghostly energy) ---
  for (let i = 0; i < 7; i++) {
    const wx = 10 + i * 4 + (step ? 1 : -1);
    const wy = 39 + (i % 3);
    line(wx, wy + bob, wx + (i % 2 ? -2 : 2), 45, P.wispMid);
    pixel(wx, wy + bob, P.wispBright);
    pixel(wx + 1, wy + 1 + bob, P.glow3);
  }

  // --- Wings (large, dark, spreading outward with purple membrane) ---
  // Left wing bone
  poly(
    [
      [14, 16],
      [8, 10 + bob],
      [4, 6 + bob],
      [3, 10 + bob],
      [5, 16],
      [4, 22],
      [3, 28 + bob],
      [6, 32],
      [10, 30],
      [13, 24],
    ],
    P.void,
  );

  // Left wing inner membrane — purple tinted
  poly(
    [
      [13, 18],
      [7, 12 + bob],
      [5, 16],
      [5, 22],
      [7, 28],
      [10, 28],
      [12, 24],
    ],
    P.bodyMid,
  );

  // Left wing purple energy at tips
  pixel(4, 6 + bob, P.glow3);
  pixel(3, 7 + bob, P.glow2);
  pixel(5, 8 + bob, P.glow4);
  pixel(3, 28 + bob, P.glow3);
  pixel(4, 29 + bob, P.glow2);
  pixel(3, 9 + bob, P.wispBright);
  // Wing edge highlight
  line(4, 10 + bob, 4, 22, P.bodyLight);

  // Right wing bone
  poly(
    [
      [34, 16],
      [40, 10 + bob],
      [44, 6 + bob],
      [45, 10 + bob],
      [43, 16],
      [44, 22],
      [45, 28 + bob],
      [42, 32],
      [38, 30],
      [35, 24],
    ],
    P.void,
  );

  // Right wing inner membrane — purple tinted
  poly(
    [
      [35, 18],
      [41, 12 + bob],
      [43, 16],
      [43, 22],
      [41, 28],
      [38, 28],
      [36, 24],
    ],
    P.bodyMid,
  );

  // Right wing purple energy at tips
  pixel(44, 6 + bob, P.glow3);
  pixel(45, 7 + bob, P.glow2);
  pixel(43, 8 + bob, P.glow4);
  pixel(45, 28 + bob, P.glow3);
  pixel(44, 29 + bob, P.glow2);
  pixel(45, 9 + bob, P.wispBright);
  // Wing edge highlight
  line(44, 10 + bob, 44, 22, P.bodyLight);

  // --- Main body / tattered cloak ---
  poly(
    [
      [24 + face, 10 + bob],
      [15, 14],
      [12, 20],
      [11, 28],
      [10, 34],
      [13, 40 + bob],
      [17, 43],
      [20, 40 + bob],
      [24, 44],
      [28, 40 + bob],
      [31, 43],
      [35, 40 + bob],
      [38, 34],
      [37, 28],
      [36, 20],
      [33, 14],
    ],
    P.bodyDark,
  );

  // Inner body layer — visible purple
  poly(
    [
      [24 + face, 13 + bob],
      [17, 16],
      [14, 22],
      [13, 29],
      [14, 35],
      [17, 38 + bob],
      [21, 36 + bob],
      [24, 40],
      [27, 36 + bob],
      [31, 38 + bob],
      [34, 35],
      [35, 29],
      [34, 22],
      [31, 16],
    ],
    P.bodyMid,
  );

  // Tattered cloak edge details
  line(13, 29, 14, 38, P.bodyLight);
  line(35, 29, 34, 38, P.bodyLight);
  line(11, 28, 10, 34, P.bodyLight);
  line(37, 28, 38, 34, P.bodyLight);

  // Jewel/medallion on chest
  if (dir !== 1) {
    rect(22, 24, 4, 4, P.glow1);
    rect(23, 25, 2, 2, P.glow3);
    pixel(24, 26, P.glow4);
  }

  // --- Horned crown ---
  // Crown base
  poly(
    [
      [24 + face, 5 + bob],
      [17 + face, 10 + bob],
      [16 + face, 17 + bob],
      [20 + face, 21 + bob],
      [28 + face, 21 + bob],
      [32 + face, 17 + bob],
      [31 + face, 10 + bob],
    ],
    P.bodyDark,
  );

  // Crown rim highlight
  line(17 + face, 10 + bob, 24 + face, 6 + bob, P.bodyLight);
  line(24 + face, 6 + bob, 31 + face, 10 + bob, P.bodyLight);

  // Left horn
  poly(
    [
      [17 + face, 10 + bob],
      [14 + face, 5 + bob],
      [13 + face, 1 + bob],
      [15 + face, 4 + bob],
      [18 + face, 8 + bob],
    ],
    P.bodyMid,
  );
  pixel(13 + face, 1 + bob, P.glow3);
  pixel(14 + face, 2 + bob, P.glow2);
  pixel(13 + face, 2 + bob, P.glow1);

  // Right horn
  poly(
    [
      [31 + face, 10 + bob],
      [34 + face, 5 + bob],
      [35 + face, 1 + bob],
      [33 + face, 4 + bob],
      [30 + face, 8 + bob],
    ],
    P.bodyMid,
  );
  pixel(35 + face, 1 + bob, P.glow3);
  pixel(34 + face, 2 + bob, P.glow2);
  pixel(35 + face, 2 + bob, P.glow1);

  // --- Glowing eyes (white/cyan — the defining feature from the reference) ---
  if (dir !== 1) {
    // Left eye socket
    rect(19 + face, 13 + bob, 4, 3, P.void);
    pixel(20 + face, 14 + bob, P.glow4);
    pixel(21 + face, 14 + bob, P.white);
    pixel(20 + face, 13 + bob, P.glow3);
    pixel(21 + face, 13 + bob, P.glow3);
    pixel(20 + face, 15 + bob, P.glow2);
    pixel(21 + face, 15 + bob, P.glow2);

    // Right eye socket
    rect(25 + face, 13 + bob, 4, 3, P.void);
    pixel(26 + face, 14 + bob, P.glow4);
    pixel(27 + face, 14 + bob, P.white);
    pixel(26 + face, 13 + bob, P.glow3);
    pixel(27 + face, 13 + bob, P.glow3);
    pixel(26 + face, 15 + bob, P.glow2);
    pixel(27 + face, 15 + bob, P.glow2);

    // Mouth slit
    rect(22 + face, 18 + bob, 4, 1, P.glow1);
  }

  // --- Ethereal wisps emanating from body (reference: prominent lavender trails) ---
  // Left side wisps
  line(9, 20 + bob, 6, 16 + bob, P.wispMid);
  line(10, 28 + bob, 7, 24 + bob, P.wispBright);
  pixel(6, 16 + bob, P.glow3);
  pixel(7, 24 + bob, P.glow4);
  pixel(8, 32 + bob, P.wispBright);
  pixel(5, 20 + bob, P.glow2);
  // Right side wisps
  line(39, 22 + bob, 42, 18 + bob, P.wispMid);
  line(38, 30 + bob, 41, 26 + bob, P.wispBright);
  pixel(42, 18 + bob, P.glow3);
  pixel(41, 26 + bob, P.glow4);
  pixel(40, 34 + bob, P.wispBright);
  pixel(43, 22 + bob, P.glow2);
  // Bottom trailing wisps
  pixel(11, 38 + bob, P.glow4);
  pixel(37, 36 + bob, P.glow4);
  pixel(16, 44, P.wispMid);
  pixel(32, 44, P.wispMid);
  drawOverlordRegalia(p, dir, step);
}

const drawFunctions = {
  shadow: drawShadow,
  lava: drawLava,
  mage: drawMage,
  servant: drawServant,
  illusion: drawIllusion,
  overlord: drawOverlord,
  "ghost-wisp": drawGhostWisp,
  "shadow-guard": drawShadowGuard,
  "soul-drainer": drawSoulDrainer,
  "flying-skull": drawFlyingSkull,
  "eye-beast": drawEyeBeast,
  "shadow-bat": drawShadowBat,
};

for (const [id, drawFn] of Object.entries(drawFunctions)) {
  const sheet = surface(size * 2, size * 4);
  for (let dir = 0; dir < 4; dir++) {
    for (let step = 0; step < 2; step++) {
      const p = painter(sheet, step * size, dir * size, size);
      drawFn(p, dir, step);
    }
  }
  writeFileSync(new URL(id + ".png", output), png(sheet));
}

console.log(
  "Monster sprites generated:",
  Object.keys(drawFunctions).join(", "),
);
