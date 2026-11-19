# Asset registry

## Dungeon

The dungeon uses original pixel art drawn by `tools/dungeon/tiles.mjs` and assembled with the map generator. The concept image guided layout and palette. The playable scene uses an embedded 32 × 32 atlas at `apps/web/public/assets/dungeon/obsidian-stone.png`. The Tiled map `obsidian-dungeon.tmj` references the atlas and records the lava, torch, and crystal frame sequences. The nearby `light.png` supplies a reusable radial falloff for all three light sources.

The atlas includes stone floors, mortar and cracks, wall edges, rock-lined lava, masonry bridge sections, columns, rubble, banners, flame fixtures, shrine stonework, and rune tiles. The dungeon art was authored for this project and has no upstream asset attribution. The dungeon torches use four original tile frames.

## Frost Nova

PixelFX 0.3.1 was found in the nested local checkout at `C:\Users\pdee5\OneDrive\Desktop\pixelfx\pixelfx`. The upstream asset ID is `ice/frost-nova`.

The export ran from that checkout and redirected output into the game workspace.

```powershell
node tools/render.mjs ice/frost-nova --sheet --out C:\Users\pdee5\OneDrive\Desktop\TheObsidianAbyss\.pixelfx-export
```

The exporter wrote the atlas, PNG, and a contact sheet under `.pixelfx-export/ice/frost-nova/`. The committed files are `apps/web/public/assets/fx/ice/frost-nova.png` and `apps/web/public/assets/fx/ice/frost-nova.json`.

The Aseprite JSON has 103 frame rectangles with durations of 33 ms, a nominal rate of 30 fps, a frame size of 288 × 192 pixels, and a pivot of [144, 150] pixels. Phaser's Aseprite loader reads the atlas as exported. Playback uses the exported frame durations and scales the pivot by frame dimensions. The scene reuses a single sprite and hides it at the end of each play.

The public FX directory carries the upstream MIT license and notice in `PIXELFX-LICENSE.txt` and `PIXELFX-NOTICE.md`. Keep both with redistributed exports.

## Re-export or add an effect

From the game root, pass the PixelFX checkout and a single catalog ID to the wrapper.

```powershell
node tools/export-effects/export.mjs '..\pixelfx\pixelfx' ice/frost-nova
```

The wrapper calls the local exporter in a temporary directory and imports the PNG, JSON, and attribution files. For a new effect, review the atlas and license, then register the asset ID, paths, repeat behavior, and layer in `packages/game-assets/src/index.ts`. Run the asset tests and verify playback in the browser. The game serves the imported files directly.
