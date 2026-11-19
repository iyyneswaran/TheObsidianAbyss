# Milestone 2 — Wizard Characters & Movement

- **Project** The Obsidian Abyss
- **Completion date** 19 November 2026
- **Status** Complete after automated verification
- **Commit reference** The Git history entry that introduced this report

## 1. Implementation summary

Milestone 2 adds character selection and a locally playable version of the three-room dungeon. Select any of seven wizards, enter the Forsaken Entrance, and walk through both corridors, across the stone bridge, and into the Sanctuary of the Azure Flame. The player has directional idle and walk cycles, a small floor-level collision footprint, and a smoothly following camera.

The dungeon inspector, Frost Nova playground, Colyseus test room, and Fastify health endpoint passed regression checks. Combat, enemy AI, HP and MP, hazard damage, regeneration, multiplayer gameplay, and persistence remain future milestones.

## 2. Folder structure

```text
AGENTS.md                                 # Permanent verification and milestone report rules
playwright.config.ts                     # Runs the browser suite with two Chromium workers
.gitignore                                # Ignores local milestone screenshots
apps/web/
  public/assets/characters/
    fire.png ice.png lightning.png earth.png wind.png healer.png defense.png
  src/
    main.tsx                              # Character selection and playable routes
    pages/
      Landing.tsx                         # Character selection entry
      CharacterSelection.tsx              # Seven keyboard-accessible wizard choices
      Dungeon.tsx                         # Shared inspector/play shell and F3 readout
    game/
      characters/
        selection.ts                      # Typed history-state selection and validation
        player.ts                         # Texture loading, player state, sprite and animations
      config/
        createDungeonGame.ts              # Passes the optional wizard into the shared scene
        engine.ts                         # Phaser lifecycle and browser-listener cleanup
      dungeon/
        actorDepth.ts                      # Depth-sorts wall and obstacle art with the player
        camera.ts                          # Bounded inspector pan or exponential player follow
        debug.ts                           # Development collision overlay and player sampling
        preview.ts                         # Typed ready and debug events
      scenes/DungeonScene.ts                # Reuses one dungeon initialization for both routes
  tests/
    dungeonCamera.test.ts                  # Pan, zoom, reset, bounds and follow tests
    wizards.test.ts                        # Registry, assets, clip keys and missing-frame checks
packages/
  game-assets/src/{index,wizards}.ts        # Seven-class catalog and sheet contract
  game-core/src/{index,movement}.ts         # Portable input, swept collision, spawn and hazard logic
  game-core/tests/movement.test.ts          # Movement and canonical geometry simulations
tests/
  fixtures/dungeon.ts                      # Canonical Tiled fixture for simulation and browser tests
  browser/{characters,wizardMovement}.spec.ts
tools/
  characters/generate.mjs                  # Draws original sheets from a shared directional rig
  dungeon/pixels.mjs                         # Existing PNG painter now supports rectangular frames
docs/
  ARCHITECTURE.md ASSET_REGISTRY.md DEVELOPMENT.md MILESTONES.md milestone-2.md
artifacts/milestone-2/                     # Ignored local Chromium screenshots
```

## 3. Character implementation

| ID          | Class            | Role    | Visual identity                                            |
| ----------- | ---------------- | ------- | ---------------------------------------------------------- |
| `fire`      | Fire Wizard      | Damage  | Crimson cloth, gold hems, flame emblem and staff           |
| `ice`       | Ice Wizard       | Control | Royal blue, frost-white shoulders, cyan crystal staff      |
| `lightning` | Lightning Wizard | Damage  | Violet cloth, angular gold trim, bolt motif                |
| `earth`     | Earth Wizard     | Control | Forest green, stone shoulders, wooden staff and leaf motif |
| `wind`      | Wind Wizard      | Control | Teal cloth, silver trim, feathered hat                     |
| `healer`    | Healer Wizard    | Support | Cream vestments, emerald cross and gold highlights         |
| `defense`   | Defense Wizard   | Tank    | Navy cloth, silver armor, gold-edged shield emblems        |

The original provisional sheets use the local character concept sheets as design references. Each sheet is 160 × 192 pixels and contains twenty 32 × 48 frames. The four rows are down, up, left, and right. Each row has two idle poses at 2 fps and three distinct walk poses. The walk loop plays four steps at 10 fps by revisiting the middle pose. Keys use `wizard.<class>.<idle|walk>.<direction>`.

Selection uses typed browser history state. A direct playable URL without a valid selection goes to `/characters`. The catalog owns the class-to-texture mapping. The loader checks that the selected sheet and all twenty frames exist before creating the actor.

## 4. Movement and collision

- WASD and arrow keys supply two directional axes. The simulation normalizes diagonal input to **144 world pixels per second**. The dominant axis sets facing, with vertical priority on ties. Releasing the keys preserves the last facing and stops translation.
- The feet use a **14 × 10 pixel** rectangle. Separate horizontal and vertical sweeps check every newly intersected tile boundary. A blocked axis stops exactly at contact while the other axis can continue sliding. The scene caps individual updates at 50 ms to avoid jumps after stalls. The shared sweep was also tested with a 20-second delta.
- Spawn resolves the lowest-ID valid `player_spawn` marker, preferring its center and then the nearest valid tile center. The canonical marker places the wizard at **496, 336**, facing down. Validation rejects solid or hazardous footprints.
- The **2560 × 2048 pixel** world uses the existing canonical grid. Void, walls, pillars, and substantial rubble block movement. Bridge tiles are regular safe floor. Lava permits movement and flags any footprint overlap as hazardous. The shrine pedestal blocks movement and the adjacent restoration zone remains reachable.

## 5. Camera and rendering

The playable camera begins at 1×, uses an 85 ms exponential follow time constant, and clamps the viewport to the map. Wheel zoom steps through 0.25×, 0.5×, 1×, and 2×. Phaser uses nearest-neighbor art and pixel-rounded camera coordinates. The sprite anchors at pixel 16, 44 of its frame.

Play mode keeps ground as tile layers and depth-sorts wall and obstacle art with the actor by floor anchor. Lighting, decorations, and overhead art retain their separate layers. The inspector keeps its original free pan, room jumps, zoom, and R reset.

F3 adds the selected class, exact position, facing, motion, speed, tile, room, zone, hazard, animation key, and frame to the development readout. The world overlay shows the footprint and collision geometry. The readout updates at most ten times per second while F3 is enabled. Production omits the debug UI.

## 6. Architecture and state contracts

The React route passes a checked wizard ID into one Phaser stage. Phaser reads keys and owns the local `PlayerTransform` with X, Y, facing, and movement state. `game-core` owns input normalization, spawn checks, collision sweeps, and terrain queries. The player controller maps displacement to a clip and applies the resulting transform to the sprite. Idle and walk loops continue without restarting the same clip on each frame.

The inspector and playable mode share the dungeon loader, atlas, animated environmental tiles, glows, viewport, and route lifecycle. Phaser releases its game, keyboard, sprites, and scene bindings on exit. The route adapter also removes the visibility and wheel callbacks left installed by Phaser 3.90. Chromium listener inspection confirmed that the tracked counts returned to baseline on each exit.

A future authoritative Colyseus room can receive directional input and sequence numbers, validate the inputs at a bounded server tick rate, advance the same engine-independent transform against the same map, and publish snapshots. The current Colyseus test room stays available through `/playground`.

## 7. Acceptance checklist

- [x] Milestones 0 and 1 passed regression checks.
- [x] The dungeon inspector still renders and supports its existing camera and F3 controls.
- [x] The character-selection route works.
- [x] All seven choices are selectable.
- [x] All seven previews show distinct sprites.
- [x] The selected wizard enters the playable dungeon. Fire and Ice were verified in Phaser.
- [x] The player begins at the canonical spawn marker.
- [x] All four facing directions are displayed.
- [x] All four walk cycles advance through three distinct frames.
- [x] Idle loops start on entry and resume after movement.
- [x] Diagonal speed matches cardinal speed.
- [x] Releasing movement keys stops the player and preserves facing.
- [x] Solid walls block movement.
- [x] Solid pillars and substantial rubble block movement.
- [x] The footprint stays within map bounds.
- [x] The wizard traverses both connected corridors.
- [x] The wizard crosses the bridge to the opposite bank.
- [x] The wizard reaches the shrine restoration zone.
- [x] Entering lava sets the hazard state while movement continues.
- [x] The camera smoothly follows and remains bounded.
- [x] Camera wheel zoom works.
- [x] Depth ordering was inspected in screenshots beside two pillars and around walls.
- [x] F3 reports movement and collision information in development.
- [x] Route transitions dispose the canvas and release tracked listeners. Blur clears held input.
- [x] Frost Nova plays and replays.
- [x] The Colyseus test room can be joined and left.
- [x] The standalone Fastify health endpoint returns HTTP 200.
- [x] Vitest unit and movement simulations passed.
- [x] Canonical map, assets, scene, and service integration checks passed.
- [x] Playwright passed against the real browser app.
- [x] Production build and Chromium smoke passed.
- [x] TypeScript, ESLint, and formatting checks passed.
- [x] Browser captures were generated and inspected.
- [x] This report records the implementation and evidence.
- [x] AGENTS.md requires a report for every completed milestone.
- [x] The supporting documentation and milestone status were updated.
- [x] The milestone was committed after the checks passed.

## 8. Executed validation

Windows, Node.js 22.17.0, pnpm 12.18.0, Vitest 5.1.1, Playwright 1.65.1, and headless Chromium 159.0.8154.6. The browser suite used web port 5179 and Colyseus port 2573 alongside an existing local server. Final browser validation ran with two workers.

| Command or check                                                            | Passed | Failed | Skipped | Coverage                                                                                                                          |
| --------------------------------------------------------------------------- | -----: | -----: | ------: | --------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm test` · Vitest                                                        |     34 |      0 |       0 | Wizard registry and assets, movement simulations, camera, canonical map, Fastify and Colyseus integration                         |
| `pnpm test` · Playwright                                                    |      9 |      0 |       0 | Selection, Phaser animation and camera, keyboard-driven traversal, lava, route shutdown, map inspector and Frost Nova regressions |
| `pnpm typecheck`                                                            |      1 |      0 |       0 | Workspace source and tests                                                                                                        |
| `pnpm lint`                                                                 |      1 |      0 |       0 | ESLint                                                                                                                            |
| `pnpm format:check`                                                         |      1 |      0 |       0 | Prettier                                                                                                                          |
| `pnpm build`                                                                |      1 |      0 |       0 | Workspace production builds                                                                                                       |
| Playwright production smoke with Vite preview and the built Fastify process |      1 |      0 |       0 | Wizard loaded, keyboard input changed the scene, F3 stayed hidden, and live `/health` returned the expected JSON                  |

A first browser run expected only one sprite request across both routes. The chooser's CSS image and Phaser's gameplay preloader each requested the sprite. The test now checks that movement produces zero further requests. Another run caught timing overshoot in the test's keyboard steering at a corridor waypoint. The rerun uses short key presses near each target and still verifies the actual player position. A four-worker run also timed out waiting for the original playground's cold canvas startup. The final suite uses two Chromium workers with the original regression assertions. Vite reported its existing Phaser chunk-size warning. Playwright reported a non-failing color environment warning.

The built browser recorded **48** animation-frame intervals during keyboard movement, with **16.7 ms median** and **16.8 ms p95**. This is a short frame-cadence sample on the local headless runner. A sustained FPS benchmark, heap profile, and coverage percentage were unmeasured. Phaser runs independently of React's render cycle, and the browser test observed no further map or sprite asset requests during movement.

## 9. Browser screenshots

All captures are from Chromium running the project and are stored in [artifacts/milestone-2](../artifacts/milestone-2/).

| Capture                                                                     | What it shows                                                         |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| [character-selection.png](../artifacts/milestone-2/character-selection.png) | Seven original previews, roles, and selected state                    |
| [fire-entrance.png](../artifacts/milestone-2/fire-entrance.png)             | Fire Wizard spawned in the Forsaken Entrance                          |
| [ice-entrance.png](../artifacts/milestone-2/ice-entrance.png)               | Ice Wizard loaded into the playable scene                             |
| [facing-up.png](../artifacts/milestone-2/facing-up.png)                     | Rear cloak and staff                                                  |
| [facing-down.png](../artifacts/milestone-2/facing-down.png)                 | Front robe and hat                                                    |
| [facing-left.png](../artifacts/milestone-2/facing-left.png)                 | Left-facing profile                                                   |
| [facing-right.png](../artifacts/milestone-2/facing-right.png)               | Right-facing profile                                                  |
| [pillar-entrance.png](../artifacts/milestone-2/pillar-entrance.png)         | Walking beside the first pillar and rubble with the footprint visible |
| [pillar-guard-route.png](../artifacts/milestone-2/pillar-guard-route.png)   | Walking past the second pillar near the eastern corridor              |
| [crossing-bridge.png](../artifacts/milestone-2/crossing-bridge.png)         | Wizard on the bridge across the lava                                  |
| [azure-shrine.png](../artifacts/milestone-2/azure-shrine.png)               | Wizard inside the shrine approach                                     |
| [movement-debug.png](../artifacts/milestone-2/movement-debug.png)           | F3 readout, player footprint, zone and obstacle boundaries            |

## 10. Git details

- Branch `main`
- Commit message `feat: implement milestone 2 wizard movement`
- Resolve the report's commit hash with `git log --diff-filter=A -1 --format=%H -- docs/milestone-2.md`
- Working tree clean after the local commit
- Push status local only

## 11. Operational instructions

```powershell
Set-Location 'C:\Users\pdee5\OneDrive\Desktop\TheObsidianAbyss'
pnpm dev
```

| Route                          | Use                                                                                   |
| ------------------------------ | ------------------------------------------------------------------------------------- |
| `/`                            | Landing page                                                                          |
| `/characters`                  | Select a wizard and enter the playable dungeon                                        |
| `/dungeon/play`                | Move with WASD or arrow keys. Scroll to zoom. Toggle the development readout with F3. |
| `/dungeon`                     | Inspect the map with WASD or arrows, room buttons, wheel zoom, R reset, and F3.       |
| `/playground`                  | Play Frost Nova and connect to the Colyseus test room.                                |
| `http://localhost:3001/health` | Fastify health endpoint                                                               |

## 12. Known limitations

- The asset rig is provisional original pixel art. Production character illustrations and animations are future work.
- This build is a local movement prototype. Combat, statistics, damage, mana, enemy behavior, multiplayer synchronization, and long-term selection persistence are deferred.
- Browser verification used desktop headless Chromium. Other browser engines, physical focus-switching across desktop apps, and long-running performance were unverified. A window blur event was dispatched in Chromium while a real movement key was held to exercise the input reset.
- The short frame sample does not establish a sustained desktop frame rate.

## 13. Next milestone

Milestone 3 is Cooperative Sessions. Milestone 3 has not started.
