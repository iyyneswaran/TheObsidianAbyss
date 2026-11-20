# The Obsidian Abyss · Milestone 6

## Release

Verified on November 20, 2026. The five-zone multiplayer dungeon passed the complete Windows release suite.

## Playing the expedition

Choose a wizard, select **Play Online**, choose **Five-zone expedition** and create a private team. Share the code or confirm incomplete-team entry to play solo. WASD and arrows move. Left click, Q, E, R and F use the locked class loadout. G operates the nearest reachable relief, mechanism or gate. M expands the chart and objective list. There is no run deadline. The classic three-encounter co-op dungeon, solo map and inspector retain their original routes.

## World architecture and connectivity

Five finite orthogonal Tiled sections share the project's original 32-pixel tileset, eight tile layers and typed ObjectZones. Every room name below also identifies its map object in lower-case, hyphen-separated form. The individual sections are editable in Tiled. Packing them into disjoint regions of one coordinate space lets the existing renderer and the authoritative simulation use exactly the same floor, lava, wall, obstacle and sight grid. No scene change, HTTP asset fetch or character reconstruction occurs at a gate. The Phaser scene delegates environment, combat, markers and multiplayer actors to separate modules.

The Entrance forms a triangle. Molten Passages, Forgotten Crypt and Corrupted Sanctum each have two routes connecting their entry and exit chambers. The two secret wings and the royal arena are physically disconnected from public corridors. An authoritative interaction grants passage. Tests flood-fill nonhazardous floor from each zone entrance, compare all five local grids against the packed grid, verify the isolated destinations and check four distinct arrival slots per zone.

## Room catalog

| Zone and room                                        | Purpose and inhabitants                                                   | Connections                                              |
| ---------------------------------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------- |
| Forsaken Entrance · Ruined Gateway                   | Spawn, shrine, introductory ghost wisp and ruined entrance masonry        | Fallen Barracks, Hall of Ashes                           |
| Fallen Barracks                                      | Broken cover, corrupted guard and the Barracks seal                       | Gateway, Hall of Ashes                                   |
| Hall of Ashes                                        | Lava fissure, shadow bat and flanking servant                             | Gateway, Barracks, Molten gate                           |
| Molten Passages · Burning Corridor                   | Fire creature, vent, lava and narrow crossings                            | Guard Chamber, Furnace Vault                             |
| Molten Guard Chamber                                 | Guarded river crossings, shrine and original chamber detail               | Burning Corridor, Bridge of Embers                       |
| Furnace Vault                                        | Furnace mechanism, hot pools and Infernal Warden                          | Burning Corridor, Bridge of Embers                       |
| Bridge of Embers                                     | Stone crossing, flying skull and vent                                     | Guard Chamber, Vault, Crypt gate                         |
| Forgotten Crypt · Crypt Entrance                     | Burial alcoves, ghost wisp and shrine                                     | Chamber of Echoes, Hall of the Restless                  |
| Chamber of Echoes                                    | Flying skull, ghost wisp and broken columns                               | Crypt Entrance, Sealed Tomb                              |
| Hall of the Restless                                 | Staggered partitions, corrupted servant and concealed relief              | Crypt Entrance, Sealed Tomb, optional Ossuary            |
| The Sealed Tomb                                      | Crypt Reaper, Crypt sigil and the exit                                    | Echoes, Restless Hall, Sanctum gate                      |
| Corrupted Sanctum · Corrupted Passage                | Dark mage, arcane trap and violet torchlight                              | Broken Seals, Azure Sanctuary                            |
| Hall of Broken Seals                                 | Eye beast and two sequentially operable seals                             | Corrupted Passage, Shadow Gate Chamber                   |
| Sanctuary of the Azure Flame                         | Azure shrine and safe approach. Its concealed relief leads to the Archive | Corrupted Passage, Shadow Gate Chamber, optional Archive |
| Shadow Gate Chamber                                  | Gate guard, Soul Drainer and arcane trap                                  | Broken Seals, Azure Sanctuary, Throne zone gate          |
| Throne of the Shadow Overlord · Obsidian Antechamber | Shadow Guard, royal banners and a statuary aisle                          | Court of Lost Souls                                      |
| Court of Lost Souls                                  | Optional Soul Drainer, preparation shrine and boss gate                   | Antechamber, Shadow Throne                               |
| Shadow Throne                                        | Original Eclipse arena, edge lava, mana circle and Shadow Overlord        | Boss gate from Court                                     |

**Optional chambers.** Inspect the fractured relief in the Restless Hall or Azure Sanctuary using G. The Ossuary of Names and Violet Archive have separate discovery records, a guardian and a return passage. Revisiting either cannot award another discovery. These rooms are outside the primary count.

## Combat, hazards and shrine rules

The Infernal Warden uses lava melee, a 264 HP pool and a 17-damage telegraph. The Crypt Reaper uses mage projectiles, finite summons, 216 HP and 14-damage attacks. Both gain 180 ms of windup and recover 300 ms faster than their family. Encounter populations and stats are fixed for all roster sizes. Named flanking groups occupy different parts of the room. Placement checks canonical floor, shrines, player and monster positions. An occupied spawn retries before an encounter can clear. The existing 720 HP Shadow Overlord retains its three phases and thresholds of 70% and 35% HP.

| Floor hazard | Idle    | Warning | Active | Recovery | Damage |
| ------------ | ------- | ------- | ------ | -------- | ------ |
| Flame vent   | 2200 ms | 1100 ms | 570 ms | 1450 ms  | 12     |
| Arcane trap  | 3100 ms | 1400 ms | 480 ms | 1750 ms  | 15     |

Warning outlines precede active tiles. Each cycle can damage an overlapping living, connected player's footprint once. Existing shields and blocks apply. Lava retains its 950 ms, 8-damage cadence. Bridge tiles have safe ground under their complete footprint. The Gateway, Molten Guard Chamber, Crypt Entrance, Azure Sanctuary, Court and boss arena offer mana restoration. Each restores up to 20 missing MP per second through the existing combat system. Shrine use cannot create mana or quest credit above capacity.

## Objective, exploration and transition policy

Clear the current zone's required battles and activate its mechanisms. The four zone exit gates additionally require, in order, the Barracks seal, Furnace mechanism, Crypt sigil, then both Broken Seals. Defeating the Antechamber guard gives access to the final boss gate in the Court. Its optional fight can be bypassed. A single wizard can activate every mechanism.

The server takes a revision number with G and resolves the interaction using its own current section, geometry, range and line of sight. A successfully consumed revision expires. Only connected, living, mobile participants can interact. A zone exit relocates the eligible party at once. Each destination has four walkable landing slots beyond the detection range of every fixed enemy spawn, with a clear route into the entry chamber. A protected living seat retains its original identity and resources and has a pending destination for reconnect. Dead players spectate living teammates and retain their terminal status. Locked equipment, cooldowns, mana, HP and contributions remain attached to the same run. The server retires prior-zone transient projectiles and attacks.

The compact chart displays current room, discovered geometry, party positions and the next objective. M shows links, cleared objectives, mechanisms, discovered shrine and gate positions. Discovery is shared by the team. A secret joins the chart only after validated entry. Server exploration state lives in the private room. Ordinary movement never writes to PostgreSQL.

A first secret discovery or a successful zone gateway emits a stable run/player/source event for each eligible participant. The existing Dungeon Explorer daily accepts this event or a qualifying run. Weekly qualifying-run and victory missions still require their original terminal conditions. No transition, discovery or mechanism grants coins or gems. The M5 settlement splits the 240 victory coins across the locked roster and grants eligible participants 3 gems and 100 XP. Existing quest counts, claim flow, prices and loadout locks are preserved.

## Implementation files

| Area                               | Locations                                                                                                                                                                                                                                               |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Editable levels and packed runtime | `apps/web/public/assets/dungeon/{forsaken-entrance,molten-passages,forgotten-crypt,corrupted-sanctum,throne-of-the-shadow-overlord,expedition}.tmj`, `tools/dungeon/expedition.mjs`                                                                     |
| Shared simulation                  | `packages/game-core/src/expedition.ts`, `combat/{encounters,rules,run}.ts`, package export                                                                                                                                                              |
| Network and persistence            | `packages/shared/src/{combat,coop}.ts`, `apps/game-server/src/{server,party/combat,party/progression,party/routes,rooms/CoopDungeonRoom}.ts`, `packages/progression/src/{quests,settlement}.ts`                                                         |
| Browser                            | `components/{ExpeditionMap,CombatHud}.tsx`, `pages/{Party,OnlineDungeon}.tsx`, `multiplayer/party.ts`, `game/scenes/DungeonScene.ts` and `game/dungeon/{actorDepth,assets,environment,expeditionMarkers}.ts` in the web app                             |
| Verification                       | `packages/game-core/tests/expedition.test.ts`, progression database tests, the real SDK isolation test, `apps/game-server/tests/combatHarness.ts`, `tests/fixtures/team.ts`, `tests/browser/{expedition,combat,coop}.spec.ts`, `artifacts/milestone-6/` |

## Pacing and balance

The design target is 30–45 minutes for a first playthrough with exploration, combat, shrine stops and secrets. The measured safe route visited every primary approach and required control, using the normal player movement and footprint collision routine for **668 tile steps, or 148.4 seconds of movement alone**. Backtracking depends on the chosen branch.

| Seats | Staged simulation combat and interactions | Of which Shadow Overlord |
| ----- | ----------------------------------------: | -----------------------: |
| 1     |                                   133.1 s |                   80.7 s |
| 2     |                                    39.7 s |                   16.6 s |
| 4     |                                    14.4 s |                    3.9 s |

These simulations place lightning wizards in clear firing lanes, use legal casts at available cooldowns and omit human navigation and decision time. Adding their elapsed times to the measured walk gives roughly 2.7–4.7 minutes before search, recovery, voluntary shrine visits, optional combat, misses and deaths. The separate Playwright journeys use real browser input and accelerate travel. Human pacing, including whether a first playthrough lasts 30–45 minutes, remains unmeasured.

## Verification scope

- [x] Each local Tiled grid matches its section of the packed map. The measured walking route reaches each mandatory control using the same movement sweep as gameplay.
- [x] Fifteen expedition simulations and map checks exercise geometry, trap phases and footprints, finite spawns, stale interactions, protected and dead seats, two secrets, gates and all boss phases.
- [x] Real Chromium clients completed the expedition solo, as a pair and as a party of four. The pair scenario disconnects a participant, advances the other player, reconnects the original identity at a safe landing, then follows the surviving player in spectator mode after a lava death. Both clients receive the result.
- [x] PostgreSQL verifies idempotent discovery credit, separate participant identities and unchanged wallets on discovery. Browser clients verify saved balances, XP and quest progress after reload.
- [x] The Shadow Overlord, dark mage, corrupted guard, Soul Drainer, flying skull, wisp, eye beast, bat, lava creature and corrupted minion use the existing supplied-design sprite set. The classic boss regression checks the summoned army appearances and the default encounter still uses the three-phase Shadow Overlord.

## Automated release results

The final `pnpm verify:progression` completed with exit code 0 against a freshly migrated, seeded PostgreSQL test schema.

| Check                                     |  Passed | Failed | Skipped |
| ----------------------------------------- | ------: | -----: | ------: |
| Vitest across 15 files                    |     138 |      0 |       0 |
| Chromium browser journeys and regressions |      20 |      0 |       0 |
| Built production services after restart   |       1 |      0 |       0 |
| Total automated tests                     | **159** |  **0** |   **0** |

The Vitest total includes 15 expedition tests, 12 progression-package tests and the existing Fastify and Colyseus integrations. The real SDK tests include forged interaction input, stale state, isolation between two teams and seat ownership on reconnect. The database tests cover discovery replay, quest eligibility and durable settlement. The browser suite includes three new full expedition journeys and all 17 earlier scenarios. The production smoke test logs back into the same account after restarting the built services, verifies wallet, claim and loadout, then casts an equipped ability in the expedition.

The three browser journeys took 46 seconds solo, about 1.1 minutes for the pair and 57.7 seconds for four players including setup and profile checks. Accelerated traversal accounts for these short times. Real combat inputs, encounter damage, boss phases and reward receipts remained server-owned throughout. The solo win paid 240 coins, the two-player win paid 120 per eligible participant and the four-player win paid 60 each.

- [x] Prettier, workspace and test TypeScript, ESLint and production builds passed.
- [x] Prisma schema validation, fresh migrations, seeding, database tests and production restart passed.
- [x] The section pack reproduced the runtime map byte for byte. All 22 evidence links resolve to actual PNG files.
- [x] Regressions passed for the original maps, combat and army, private teams, reconnect, death, profiles, Store, Vault, quests, health endpoint and Frost Nova playground.

The production client build emitted Vite's chunk-size advisory. The release suite does not collect line or branch coverage.

## Browser evidence

Each PNG comes from a Chromium session connected to the real game server. The final frame comes from the server-owned victory summary. Paths below are relative to this report.

- **Entrance**. [forsaken-entrance](../artifacts/milestone-6/forsaken-entrance.png), [fallen-barracks](../artifacts/milestone-6/fallen-barracks.png), [hall-of-ashes](../artifacts/milestone-6/hall-of-ashes.png).
- **Molten**. [molten-passages](../artifacts/milestone-6/molten-passages.png), [molten-guard-chamber](../artifacts/milestone-6/molten-guard-chamber.png), [furnace-vault](../artifacts/milestone-6/furnace-vault.png), [bridge-of-embers](../artifacts/milestone-6/bridge-of-embers.png).
- **Crypt**. [forgotten-crypt](../artifacts/milestone-6/forgotten-crypt.png), [chamber-of-echoes](../artifacts/milestone-6/chamber-of-echoes.png), [sealed-tomb](../artifacts/milestone-6/sealed-tomb.png), [secret-chamber](../artifacts/milestone-6/secret-chamber.png).
- **Sanctum**. [corrupted-sanctum](../artifacts/milestone-6/corrupted-sanctum.png), [azure-sanctuary](../artifacts/milestone-6/azure-sanctuary.png), [shadow-gate](../artifacts/milestone-6/shadow-gate.png).
- **Throne and outcome**. [obsidian-antechamber](../artifacts/milestone-6/obsidian-antechamber.png), [shadow-throne](../artifacts/milestone-6/shadow-throne.png), [victory-after-full-run](../artifacts/milestone-6/victory-after-full-run.png).
- **Navigation and combat**. [minimap](../artifacts/milestone-6/minimap.png), [objective-tracker](../artifacts/milestone-6/objective-tracker.png), [elite-encounter](../artifacts/milestone-6/elite-encounter.png), [four-player-exploration](../artifacts/milestone-6/four-player-exploration.png), [zone-transition](../artifacts/milestone-6/zone-transition.png).

## Four-client performance and visual review

The final Windows Chromium run loaded 57 asset resources and transferred 7,607,220 bytes. The longest observed asset request took 62 ms. The packed Tiled map occupies 638,859 bytes on disk. The renderer reuses the shared atlas and pools depth-sorted wall and obstacle sprites for the active section. Each line below is a sample from the leader's browser while all four clients rendered.

| Leaving or entering    | Interaction to synchronized UI | Phaser FPS sample | Scene objects | Textures | Scene listeners | JS heap, MiB | Cumulative received payload |
| ---------------------- | -----------------------------: | ----------------: | ------------: | -------: | --------------: | -----------: | --------------------------: |
| Entrance to Molten     |                         376 ms |              53.5 |           521 |       38 |              53 |         70.8 |                23,696 bytes |
| Molten to Crypt        |                         305 ms |              52.4 |           514 |       33 |              53 |         85.8 |                96,867 bytes |
| Crypt to Sanctum       |                         363 ms |              52.2 |           616 |       41 |              53 |         81.2 |               130,872 bytes |
| Sanctum to Antechamber |                         360 ms |              49.6 |           613 |       38 |              53 |         82.5 |               191,434 bytes |
| Court to boss arena    |                         317 ms |              50.2 |           616 |       40 |              53 |         67.6 |               201,432 bytes |

The final sample covered 932 incoming WebSocket frames. The measured server tick rate from session start ranged from 22.4 to 22.9 Hz on this host against a 30 Hz target. Interaction timings include fixture positioning, G input and confirmation across all four browsers. Samples include transient spell and text objects. Browser heap returned below its first sample at the boss gate. The fixed per-run combat caps are 28 monsters, 64 projectiles and 48 areas. The raw readings are in [performance.json](../artifacts/milestone-6/performance.json).

All 22 screenshots were visually inspected. The Azure shrine and violet sanctum lighting, safe bridge decks, room boundaries, boss edge lava, party and expanded chart were visible. The chart occupies the top-right of the stage and the combat controls stay outside it. Rooms reuse masonry and the elites reuse their existing sprite families. The measurements cover one local Chromium configuration. Cross-browser rendering, WAN latency, long-session memory behavior, sustained 60 FPS, human completion time and code-coverage percentages remain unmeasured.

## Operational commands on Windows

From the project root with Node and pnpm available, use the development database configured in the ignored environment file.

```powershell
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Open the local web address printed by Vite and go to `/party`. To rebuild the packed map after editing the individual Tiled sections, or run focused checks:

```powershell
node tools/dungeon/expedition.mjs --pack
pnpm exec vitest run packages/game-core/tests/expedition.test.ts
```

Running the generator without `--pack` rebuilds the five authored section files from the procedural source as well. To run the release suite on the configured Windows test installation:

```powershell
$clusterPath = (Get-Content .postgres-test/cluster-path -Raw).Trim()
$pgCtl = '.postgres-test/package/native/bin/pg_ctl.exe'
& $pgCtl status -D $clusterPath
if ($LASTEXITCODE -eq 3) {
  & $pgCtl start -D $clusterPath -l .postgres-test/postgres.log -o '-h 127.0.0.1 -p 55438' -w
}
$env:TEST_DATABASE_URL = (Get-Content .postgres-test/suite.env -Raw).Trim()
pnpm verify:progression
```

The suite creates a disposable schema, applies migrations, seeds, validates, runs development and production browser checks, and drops the schema. On another installation provide a disposable PostgreSQL URL selecting a test-named database.

## Git

Branch `main`. Implementation commit message `feat: implement milestone 6 full dungeon expansion`. The following commands identify the introducing commit and compare it to the published branch.

```powershell
git log --diff-filter=A -1 --format=%H -- docs/milestone-6.md
git status --short --branch
git ls-remote --exit-code origin refs/heads/main
```

## Next milestone

A future balance and encounter-design pass can use human traversal timings and accessibility feedback. Milestone 7 has not started.
