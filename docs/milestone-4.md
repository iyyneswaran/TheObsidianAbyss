# Milestone 4 — The Obsidian Abyss combat and encounters

- **Date** November 19, 2026
- **Status** Complete after automated verification.
- **Commit reference** The Git entry that introduces this report.

## Implementation and files

Private co-op now includes seven combat loadouts, three required encounters, a gated Shadow Overlord arena, hazardous lava, the Azure mana shrine, permanent death, spectating, and authoritative results. The inspector, solo movement route, class selection, Frost Nova playground, and private-team entry remain available.

| Location                                                                                                           | Responsibility                                                                      |
| ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| `packages/game-core/src/combat/balance.ts`                                                                         | Loadouts, provisional enemy and boss statistics, resources, and runtime caps        |
| `packages/game-core/src/combat/rules.ts`                                                                           | Entity and result types, line of sight, collision, targeting, and status predicates |
| `packages/game-core/src/combat/run.ts`                                                                             | Cast validation, timers, projectiles, areas, healing, damage, status and outcomes   |
| `packages/game-core/src/combat/encounters.ts`                                                                      | Encounter progression, navigation, hostile AI, and boss attacks                     |
| `packages/shared/src/{coop,combat}.ts`                                                                             | Zod commands and incremental Colyseus player and combat schemas                     |
| `apps/game-server/src/rooms/CoopDungeonRoom.ts` and `src/party/combat.ts`                                          | Ownership, fixed-step authority, recovery, snapshots, and transient events          |
| `apps/web/src/game/combat/presentation.ts`                                                                         | Phaser combat input, sprites, warnings, effects, and feedback                       |
| `apps/web/src/components/CombatHud.tsx` and `src/pages/OnlineDungeon.tsx`                                          | HP/MP, cooldowns, boss HUD, spectating, results and diagnostics                     |
| `apps/web/public/assets/dungeon/obsidian-combat.tmj` and `tools/dungeon/generate.mjs`                              | Original dungeon footprint, isolated arena and combat metadata                      |
| `tools/characters/monsters.mjs` and `apps/web/public/assets/monsters/`                                             | Original provisional directional monster sheets                                     |
| `tools/export-effects/export.mjs`, `packages/game-assets/src/combat.ts`, and `apps/web/public/assets/fx/`          | Local exporter, registry, and licensed atlases                                      |
| `packages/game-core/tests/combat.test.ts`, `apps/game-server/tests/combat.test.ts`, `tests/browser/combat.spec.ts` | Deterministic combat, real sockets, and browser gameplay                            |
| `apps/game-server/tests/combatHarness.ts` and `playwright.config.ts`                                               | Isolated loopback position staging for browser tests                                |

## Combat architecture

The private Colyseus `coop_dungeon` room uses fixed 30 Hz simulation and 15 Hz Schema patches. Commands map to the owning connection and the caster's locked loadout. Snapshots carry resources, statuses, cooldowns, enemies, projectiles, warnings, boss phase, and run result. Unique per-run events identify casts, projectiles, impacts, damage, actual healing, statuses, deaths, phases and outcomes. Phaser consumes the snapshots and events for presentation.

Casts consume MP and cooldown only after validation. Targets use canonical sight and collision. Projectiles check every four pixels or less and expire at their distance limit. A hit registers once per projectile or effect pulse. Dashes and displacement use swept body collision. Basic attacks select the nearest visible hostile, with an injured-ally option for Halo. Cone skills use the aim direction. Ground skills use the cursor position. Targeted skills look for a valid hostile near the cursor.

## Wizard abilities

Provisional HP/MP by class are Fire 125/105, Ice 123/113, Lightning 115/112, Earth 145/102, Wind 118/110, Healer 130/126, Defense 170/99. Every default slot is available immediately.

| Class     | Slot     | Ability            |  MP | Cooldown (s) | Aim range or self radius (px) | Effect                                                                         |
| --------- | -------- | ------------------ | --: | -----------: | ----------------------------: | ------------------------------------------------------------------------------ |
| Fire      | Basic    | Fireball           |   0 |         0.57 |                           254 | 22 damage, 410 px/s                                                            |
| Fire      | Skill 1  | Fire Breath        |  12 |         2.30 |                           110 | 26 damage, Burning 2.7s                                                        |
| Fire      | Skill 2  | Flame Pillar       |  18 |         3.50 |                           210 | 48 damage, 48px radius, 330ms wind-up                                          |
| Fire      | Skill 3  | Flamethrower       |  22 |         5.20 |                           133 | 15 damage, 4 pulses every 310ms                                                |
| Fire      | Ultimate | Fire Ring          |  38 |        16.00 |                           134 | 78 damage, Burning 3.6s, 134px radius, 280ms wind-up                           |
| Ice       | Basic    | Ice Lance          |   0 |         0.59 |                           244 | 19 damage, 430 px/s                                                            |
| Ice       | Skill 1  | Freeze             |  11 |         2.80 |                           220 | 9 damage, Frozen 1.55s                                                         |
| Ice       | Skill 2  | Frost Breath       |  13 |         2.60 |                           126 | 23 damage, Slowed 2.4s                                                         |
| Ice       | Skill 3  | Blizzard Vortex    |  24 |         5.20 |                           205 | 13 damage, Slowed 0.88s, 57px radius, 4 pulses every 580ms                     |
| Ice       | Ultimate | Frost Nova         |  36 |        15.00 |                           130 | 66 damage, Frozen 1.75s, 130px radius, 240ms wind-up                           |
| Lightning | Basic    | Zap                |   0 |         0.46 |                           221 | 17 damage                                                                      |
| Lightning | Skill 1  | Chain Lightning    |  18 |         2.85 |                           230 | 37 damage, 115px radius, 3 targets max                                         |
| Lightning | Skill 2  | Lightning Strike   |  19 |         3.50 |                           235 | 54 damage, 40px radius, 420ms wind-up                                          |
| Lightning | Skill 3  | Charge Up          |  12 |         5.00 |                             — | +20 next damage, 4.8s buff                                                     |
| Lightning | Ultimate | Thunderclap        |  38 |        15.50 |                           134 | 77 damage, Stunned 1.25s, 134px radius, 240ms wind-up                          |
| Earth     | Basic    | Boulder            |   0 |         0.69 |                           217 | 25 damage, 340 px/s                                                            |
| Earth     | Skill 1  | Vine Whip          |  11 |         2.40 |                           142 | 32 damage, Slowed 1.8s                                                         |
| Earth     | Skill 2  | Earth Spike        |  18 |         3.50 |                           205 | 51 damage, 43px radius, 420ms wind-up                                          |
| Earth     | Skill 3  | Quake              |  21 |         4.60 |                           107 | 47 damage, 107px radius                                                        |
| Earth     | Ultimate | Thorns             |  34 |        14.50 |                           185 | 22 damage, Slowed 0.85s, 105px radius, 4 pulses every 610ms                    |
| Wind      | Basic    | Wind Dart          |   0 |         0.50 |                           237 | 18 damage, 520 px/s                                                            |
| Wind      | Skill 1  | Wind Dash          |  12 |         2.25 |                            94 | swept dash                                                                     |
| Wind      | Skill 2  | Tornado            |  19 |         3.45 |                           219 | 38 damage, 48px radius, 54px displacement                                      |
| Wind      | Skill 3  | Wind Sweep         |  16 |         3.00 |                           143 | 30 damage, 62px displacement                                                   |
| Wind      | Ultimate | Tempest            |  35 |        16.00 |                           209 | 19 damage, Slowed 0.78s, 110px radius, 5 pulses every 480ms, 18px displacement |
| Healer    | Basic    | Halo               |   0 |         0.63 |                           228 | 17 damage, 7 healing                                                           |
| Healer    | Skill 1  | Holy Smite         |  11 |         1.80 |                           237 | 45 damage                                                                      |
| Healer    | Skill 2  | Healing Ring       |  19 |         3.85 |                           112 | 32 healing, 112px radius                                                       |
| Healer    | Skill 3  | Divine Shield      |  16 |         6.10 |                             — | 35 absorb, 3.9s buff                                                           |
| Healer    | Ultimate | Divine Sanctuary   |  39 |        16.60 |                           155 | 68 healing, 155px radius                                                       |
| Defense   | Basic    | Shield Strike      |   0 |         0.51 |                            82 | 27 damage                                                                      |
| Defense   | Skill 1  | Force Field        |  14 |         5.00 |                             — | 42 absorb, 3.9s buff                                                           |
| Defense   | Skill 2  | Shield Block       |  11 |         3.20 |                             — | 65% block, 2.2s buff                                                           |
| Defense   | Skill 3  | Ground Slam        |  19 |         3.40 |                            96 | 43 damage, Stunned 1s, 96px radius                                             |
| Defense   | Ultimate | Guardian's Bulwark |  33 |        15.50 |                           246 | 246px radius, 73 absorb, 45% block, 5.15s buff, taunt                          |

## PixelFX integration

The exporter uses the local PixelFX checkout at `C:\Users\pdee5\OneDrive\Desktop\pixelfx\pixelfx`. It copies the atlas, MIT license, and upstream notice into the public FX directory. The optional `--compact` path uses FFmpeg nearest-neighbor sampling to halve the atlas dimensions and scales frame bounds and pivots accordingly. Frost Nova keeps its original export and playground playback. The online scene loads party-class atlases and shared combat effects, applies pivots and directional rotation, sorts actors by depth, and cleans up finished effects.

Each of the 42 registry IDs resolves to `apps/web/public/assets/fx/<id>.png` and the matching JSON.

- **fire** `fire/fireball`, `fire/fire-breath`, `fire/flame-pillar`, `fire/flamethrower`, `fire/fire-ring`
- **ice** `ice/ice-lance`, `ice/freeze`, `ice/frost-breath`, `ice/blizzard-vortex`, `ice/frost-nova`
- **lightning** `lightning/zap-hit`, `lightning/chain-lightning`, `lightning/lightning-strike`, `lightning/charge-up`, `lightning/thunderclap`
- **nature** `nature/boulder`, `nature/vine-whip`, `nature/earth-spike`, `nature/quake`, `nature/thorns`, `nature/leaf-storm`, `nature/tornado`
- **holy** `holy/halo`, `holy/smite`, `holy/heal-aoe`, `holy/divine-shield`, `holy/heal`
- **scifi** `scifi/force-field`
- **impacts** `impacts/shield-block`, `impacts/ground-slam`, `impacts/blunt-hit`
- **shadow** `shadow/void-orb`, `shadow/shadow-tendrils`, `shadow/grasping-hands`, `shadow/soul-drain`, `shadow/dark-explosion`
- **arcane** `arcane/arcane-beam`, `arcane/mana-burst`, `arcane/portal`
- **spawn** `spawn/disintegrate`, `spawn/summon-rise`
- **explosions** `explosions/big-explosion`

## Monster AI

| Encounter            | Required enemy  |  HP | Behavior                                                                     |
| -------------------- | --------------- | --: | ---------------------------------------------------------------------------- |
| Forsaken Entrance    | Shadow stalker  | 103 | Patrol, flanking at middle range, close strike with wind-up and recovery     |
| Molten Guard Chamber | Cinder creature | 144 | Aggressive chase, telegraphed fire with collision-aware push                 |
| Sanctuary approach   | Dark mage       | 124 | Ranged projectiles, repositioning when crowded, up to two temporary servants |

A connected living wizard triggers a region. The nearest visible eligible target is preferred, with limited taunt priority and temporary pursuit after losing sight. AI uses a bounded four-neighbor search on the canonical walkable grid. It avoids hazards and solid terrain. The shrine stays outside routine monster spawning. Required enemy deaths clear their respective regions.

## Shadow Overlord

The boss starts at 720 HP and uses the same stats for parties of every size. Clear all three required encounters, then bring a living wizard within 54 px and line of sight of the gate and press **G**. The gateway assigns safe per-seat entrances and retains the original team room and resources.

The Shadow Overlord Enemy Codex informed the boss's crown, violet staff, armor trim, and the army silhouettes. The live Summoner wave includes the Corrupted Shadow Guard, Soul Drainer, flying skull, and shadow bat art. The Dark Mage can summon the eye beast and corrupted minion. The Lava Imp and Ghost/Wisp appear in the earlier encounters. Each look uses an original directional sheet and retains the combat behavior of its base archetype. [Asset registry](ASSET_REGISTRY.md)

- **The Watcher** uses validated anchor teleports, two temporary illusions, a moving shadow projectile, and telegraphed soul drain.
- **The Summoner** begins at 70%. It adds tendril zones, secondary floor warnings, and up to four concurrent shadow servants.
- **Eclipse** begins at 35%. It uses faster teleport combinations, a width-checked Arcane Beam with cover, and sequential shadow blasts.

Phases advance once per threshold. The arena adds dark stone, broken pillars, edge lava, escape lanes and a contestable mana rune. Boss death cancels incoming attacks and plays a harmless explosion.

## Health, mana and hazards

Lava applies eight damage per 950 ms after an initial exposure window while the canonical footprint overlaps lava. The exposure counter pauses on safe tiles. The Azure shrine and arena rune restore 20 MP per second to eligible wizards standing in the zone. Healing clamps to missing HP. Burning deals four damage every 600 ms, Slowed scales movement to 56%, and Frozen and Stunned interrupt movement and actions. Status refresh keeps one instance per kind. The boss has shorter crowd-control durations. Shields have finite absorption and blocks expire.

## Permanent death and spectating

Lethal damage clears actions, stops movement, makes the player an invalid combat target, and triggers a death effect. Spectators follow a living connected wizard and can switch targets. Dead players retain their seat and receive the same result as the team.

## Reconnection during combat

A drop holds the slot and freezes HP, MP, cooldowns, statuses and position. Protected actors ignore damage, healing, enemy targeting and shrine restoration. Queued attacks are cancelled. Signed guest identity, token ownership, recovery deadlines and drop limits govern recovery. A protected player who missed a gate transition takes their assigned arena entrance on recovery. Lethal damage before protection remains permanent.

## Run lifecycle

Boss death resolves victory. Loss of the last living seat resolves defeat, with active recovery reservations counted until expiry. The room records the stable run ID, outcome, participant status, actual damage and healing, monsters defeated and duration. Results processing clears projectiles and warnings and stops combat. Results remain available for up to 120 seconds or until the last seat leaves or expires. Players can return to the private-team flow. Persistent rewards and wallet settlement belong to Milestone 5.

## Acceptance and verification

- [x] Server-owned HP, MP, cast validation, mana, cooldowns, projectiles, area damage, healing, friendly-fire prevention, and statuses.
- [x] All seven default loadouts with 35 verified ability slots. Basic abilities are free. Targeting and spells use canonical terrain.
- [x] Three map encounters, navigable hostile behavior, telegraphs, and a portal gated by real enemy deaths.
- [x] Fixed-difficulty three-phase boss. Safe teleports, bounded summons, beam and floor attacks, harmless death FX, and one authoritative victory.
- [x] Server lava damage and bounded shrine restoration. The existing bridge uses safe stone tiles.
- [x] Permanent death, spectating, identity-verified reconnect, paused combat timers while protected, and synchronized outcomes.
- [x] Twelve directional enemy atlases, 42 PixelFX effects, and all 19 browser evidence captures.
- [x] Existing milestone regressions, real sockets, four Chromium contexts, a production smoke test, and build validation.

| Executed validation                                   | Passed | Failed | Skipped |
| ----------------------------------------------------- | -----: | -----: | ------: |
| Vitest unit, asset and deterministic simulation cases |     90 |      0 |       0 |
| Vitest integration cases                              |      4 |      0 |       0 |
| Playwright browser cases                              |     15 |      0 |       0 |
| Production two-context browser smoke                  |      1 |      0 |       0 |
| Typecheck, lint, format and production build commands |      4 |      0 |       0 |

`pnpm test` passed 94 Vitest and 15 Playwright cases on Windows with Node 22.17.0 and pnpm 12.18.0. Prior behavior is represented by 45 inherited Vitest cases and 11 inherited browser cases. The browser runner uses one worker so timing-sensitive WebGL tests have exclusive access to the browser host, and the multiplayer scenario still uses four independent contexts and guest identities.

Four Chromium clients verified class-specific effects, health and mana, freezing, healing, a shield, lava overlap, bridge traversal, shrine restoration, and real boss damage through three synchronized phases. All four clients received the same Victory result. The two-player scenario verified permanent death and the same Defeat result for both clients. Its targeted rerun passed again after adding a camera assertion and recapturing spectating after the scene finished loading. The remaining browser cases exercised one- and three-player runs.

The live Fastify and Colyseus test verified signed guest sessions, synchronized casts and healing, protected state during lava exposure, frozen MP and cooldowns on disconnect, seat restoration, and cross-team isolation. It also rejected forged HP/MP, fake boss death, foreign player IDs, invalid aim and abilities, duplicate casts, and entry through a locked gate. Deterministic cases exercise rate limits, projectile bounds, friendly fire, arena patterns and one result event. Code coverage percentages were unmeasured.

## Browser evidence

Playwright saves screenshots in `artifacts/milestone-4/`. The browser test fixture is a test-only entry point that binds to loopback and requires a randomly generated header. It stages existing living players at canonical map positions to shorten traversal and repeated boss approaches. Browser input, portal authorization, combat, damage, phase thresholds and outcomes run through the normal game stack.

| Captures                                                                                           | Visible evidence                                                         |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `fire-combat.png`, `ice-freeze.png`, `lightning-attack.png`, `earth-attack.png`, `wind-attack.png` | Offensive loadouts and enemy resource or status feedback                 |
| `healer-healing.png`, `defense-shield.png`, `four-player-combat.png`                               | Actual healing, a finite shield, and four active wizards                 |
| `monster-encounter.png`, `lava-damage.png`, `mana-restoration.png`                                 | Enemy activation, hazardous overlap, and the Azure rune floor            |
| `boss-phase-1.png`, `boss-phase-2.png`, `boss-phase-3.png`, `shadow-army.png`                      | Authoritative phase HUD, attack warnings, and the new summon art         |
| `player-death.png`, `spectator-mode.png`, `victory-screen.png`, `defeat-screen.png`                | Permanent death, spectator controls after refresh, and both run outcomes |

`enemy-sprite-sheets.png` is a separate visual inspection sheet of all twelve generated directional atlases.

## Performance observations

The production loopback smoke test sampled 45 foreground frame intervals in Chromium 159.0.8154.6 with two contexts. Median and p95 intervals were 16.7 ms. A four-context entrance capture showed 13 recent server patches per second during combat. Sustained FPS, server tick jitter, bandwidth, heap use and off-network conditions were unmeasured. Vite reports its size advisory for the existing Phaser chunk.

## Security and limitations

Strict Zod shapes require finite bounded aim coordinates, a loadout slot and an increasing sequence. The server checks ownership, life, protection, cooldown, mana, range and sight. The room caps incoming payload size and message rate. Simulation caps cover monsters, projectiles, areas and events. Wrong-identity recovery and stale seat tokens remain covered by the preceding co-op tests. Production omits F3 and the test fixture. Loopback web origins accept the localhost and 127.0.0.1 forms on the configured port. Other origins require the configured match. The supported Node 22 runtime supplies WebSocket.

Monster sprites and balance are provisional. Summon appearances share the rules of their underlying combat archetypes. Audio remains deferred. Long-run load and full unassisted solo balance remain unmeasured.

## Git and operation

```powershell
Set-Location 'C:\Users\pdee5\OneDrive\Desktop\TheObsidianAbyss'
pnpm install --frozen-lockfile
pnpm dev
```

Open `http://localhost:5173/party`, create or join a team, and enter the dungeon. Move with **WASD** or arrows. Basic attack with **left click**. Aim with the cursor and cast with **Q/E/R/F**. Use **G** at the Shadow Gate and **F3** for development diagnostics.

```powershell
pnpm typecheck
pnpm lint
pnpm format:check
pnpm build

$env:WEB_PORT = '5180'
$env:GAME_PORT = '2574'
$env:API_PORT = '3012'
pnpm test
```

The milestone targets `main` on the configured GitHub remote. The introducing commit message is `feat: implement milestone 4 combat and boss encounters`.

```powershell
git log --diff-filter=A -1 --format=%H -- docs/milestone-4.md
git status --short --branch
git ls-remote --exit-code origin refs/heads/main
```

## Next milestone

Milestone 5 covers progression, currencies, Store, Vault, and the Quest Board.
