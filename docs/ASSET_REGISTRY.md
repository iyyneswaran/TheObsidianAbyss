# Asset registry

## Wizard sprites

The seven original provisional wizard sheets live in `apps/web/public/assets/characters/`. The local concept sheets guided the palettes, hats, trims, emblems, and staff shapes. Every sheet has 32 × 48 frames laid out in five columns and four direction rows. The feet anchor is 16, 44 pixels from the frame origin. The first two columns are idle, and the remaining three are distinct walk poses.

The typed manifest is `packages/game-assets/src/wizards.ts`. Regenerate the sheets from the repository root with `pnpm exec tsx tools/characters/generate.mjs`. To replace the provisional art, retain the layout or update the manifest's frame layout, animation columns, and foot anchor together.

## Monster sprites

Twelve directional monster sheets live in `apps/web/public/assets/monsters/`. Each PNG is 96 × 192 pixels with 48 × 48 frames in two columns and four rows ordered down, up, left and right. The walk animation alternates columns.

The existing generated sheets provided the initial style. The Shadow Overlord Enemy Codex guided the crown, amethyst staff, armor trim, and new army silhouettes. The game uses the authoritative appearance ID to choose a sheet. Each visual variant shares the rules of its underlying combat archetype.

| Sheet                        | Appearance                                                            | Where it appears     |
| ---------------------------- | --------------------------------------------------------------------- | -------------------- |
| `overlord.png`               | Shadow Overlord with horned crown, amethyst staff, and tattered armor | Boss arena           |
| `mage.png`                   | Dark Mage Servant with orb staff                                      | Sanctuary approach   |
| `shadow-guard.png`           | Corrupted Shadow Guard with sword and shield                          | Summoner wave        |
| `soul-drainer.png`           | Soul Drainer with ivory mask and lantern                              | Summoner wave        |
| `lava.png`                   | Lava Imp with magma cracks and ember eyes                             | Molten Guard Chamber |
| `flying-skull.png`           | Skull wreathed in purple flame                                        | Summoner wave        |
| `ghost-wisp.png`             | Lavender Ghost/Wisp                                                   | Forsaken Entrance    |
| `eye-beast.png`              | Tentacled Eye Beast                                                   | Dark Mage summon     |
| `shadow-bat.png`             | Purple bat with a two-beat wing animation                             | Summoner wave        |
| `servant.png`                | Corrupted Minion                                                      | Dark Mage summon     |
| `illusion.png`, `shadow.png` | Two translucent spectral doubles                                      | Watcher illusions    |

Regenerate the original art with `node tools/characters/monsters.mjs` from the repository root. The generator uses `tools/characters/shadowArmy.mjs` for the codex-derived designs and the existing pixel drawing helpers.

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

Milestone 5 uses the existing class sprite sheets in the Store and Vault and existing registered Aseprite effects for all fourteen purchasable abilities. The class-to-effect mapping is in [the alternate combat definitions](../packages/game-core/src/combat/alternates.ts). The Shadow Overlord and its army continue to use the directional sheets documented above.

The [combat registry](../packages/game-assets/src/combat.ts) records the online effects used by Milestone 4. Combat exports accept `--compact` to create half-size pixel atlases with nearest-neighbor sampling via FFmpeg. Frost Nova keeps its original export. Regenerate monster sheets with `node tools/characters/monsters.mjs`. See [Monster sprites](#monster-sprites) for the layout and palette details.

From the game root, pass the PixelFX checkout and a single catalog ID to the wrapper.

```powershell
node tools/export-effects/export.mjs '..\pixelfx\pixelfx' ice/frost-nova
```

The wrapper calls the local exporter in a temporary directory and imports the PNG, JSON, and attribution files. For a new effect, review the atlas and license, then register the asset ID, paths, repeat behavior, and layer in `packages/game-assets/src/index.ts`. Run the asset tests and verify playback in the browser. The game serves the imported files directly.
