# Milestone 7 Â· Game polish and release readiness

## Release status

November 21, 2026. The Windows release suite passed all 175 tests. A separate container smoke also passed. The implementation builds on Milestone 6 at `69e3eda`. The Git section gives the exact command to resolve the implementation revision.

## Implementation

The five-zone expedition has an original synthesized score, positional effects, a persistent audio mixer, keyboard rebinding and display preferences. Settings can open over a live dungeon. Browser gameplay, database verification and packaging run through the release workflow.

## Source locations

| Area                  | Implementation                                                                                                       |
| --------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Sound and preferences | `apps/web/src/audio/sound.ts`, `apps/web/src/settings/`                                                              |
| Dungeon presentation  | `apps/web/src/game/scenes/DungeonScene.ts`, `apps/web/src/game/combat/presentation.ts`, `apps/web/src/game/dungeon/` |
| HUD and menus         | `apps/web/src/components/`, `apps/web/src/pages/`, `apps/web/src/styles/interface.css`                               |
| Authoritative time    | `apps/game-server/src/party/fixedClock.ts`, `apps/game-server/src/rooms/CoopDungeonRoom.ts`                          |
| Runtime packaging     | `Dockerfile`, `compose.production.yaml`, `deployment/nginx.conf`                                                     |
| Release tests         | `tests/browser/`, `tests/production/`, `tools/verify-progression.mjs`, `tools/verify-containers.mjs`                 |

## Audio architecture

A trusted gesture unlocks one AudioContext per tab. The music, ambience, effects and UI gains feed the master gain. The scene selects the zone or boss arrangement. The mixer caches up to 80 generated buffers and caps transient voices at 12. Distance reduces gain, repeated cues have a cooldown and high-priority warnings can replace low-priority voices. Score transitions fade, hidden tabs mute, and leaving the dungeon retires its loops. The server supplies casts, projectile events, mitigation, damage, healing, boss phases and death. Key presses send intents to the server.

## Audio and artwork registry

| Scene             | Original score and ambience                |
| ----------------- | ------------------------------------------ |
| Forsaken Entrance | Low A drone with a slow broken minor chord |
| Molten Passages   | Faster G pulse with repeated notes         |
| Forgotten Crypt   | Sparse octave melody in C                  |
| Corrupted Sanctum | G-sharp pulse with a tritone               |
| Shadow Throne     | Low E with a rising octave                 |
| Overlord          | D pedal with a shorter, alternating pulse  |

All six arrangements use generated mono PCM at 22,050 Hz. Combat effect identifiers select class timbres and deterministic variations for the default and alternate spells. The project supplies the synthesis source. The landing artwork is a WebP edition of the supplied Shadow Overlord Enemy Codex. Asset provenance is recorded in the [asset registry](ASSET_REGISTRY.md).

## Interface

The main menu features the supplied Overlord illustration. The navigation identifies the selected route. Ability slots show bindings, mana, cooldown and low-mana states. The boss warning accompanies the ground telegraph. The expedition map follows the bound minimap key and nearby mechanisms show the interaction key. Party, profile, Store, Vault, quests, spectator and result screens share focus, contrast and panel styles.

## Accessibility and controls

Movement, basic attack, three skills, ultimate, interaction and minimap have editable bindings. Arrow movement and left-click attack remain available. Duplicate keys produce a visible error. Escape cancels rebinding. A native dialog keeps keyboard focus inside session settings and restores it on close. Local storage preserves preferences across refreshes. Reduced motion initially follows the operating system and suppresses camera shake and floating-number travel. Users can also disable the numbers, adjust HUD size and enable high contrast.

## Rendering

Camera buckets select a bounded set of pooled wall and obstacle sprites. The environment updates animation and light intensity at most twenty times a second. Debug target lists are constructed only at overlay sample time. The comparison records actual Phaser object counts, textures, listener counts, frame intervals and heap use.

## Server and network

Colyseus callbacks advance a fixed 30 Hz clock using elapsed monotonic time. Each callback can run up to four steps. Extra time after a longer stall is discarded. A bounded sample window records amortized step duration and callback lateness. The UI compares the serialized expedition chart separately from other HUD state. Team authority, identity checks and persistent reward calculations remain server-side.

## Bundles and loading

The landing route loads its own artwork. Phaser loads on game entry, the Colyseus SDK loads on connection and each zone's audio is generated on demand. The milestone-6 entry bundle measured 522.9 kB. The updated build measured 482.59 kB before gzip and 148.57 kB after gzip. The roughly 1.2 MB lazy Phaser engine still triggers Vite's advisory. Dungeon loading displays actual Phaser loader progress and provides a retry action for asset or graphics failures.

## Reliability

Reconnect feedback, protected disconnected seats, durable settlement, retryable scene errors and service readiness distinguish the state of the connection from the result of a run. Structured game logs identify rooms, reconnects, session end and periodic simulation cost. Outbox retries log state changes. Diagnostic records omit credentials and player names.

## Infrastructure

The local Compose stack runs PostgreSQL, migrations, Fastify, Colyseus and the NGINX frontend. The proxy handles history routes, the API and WebSocket upgrades. PostgreSQL and pending settlements have separate volumes. The container smoke reached a private dungeon and verified a real spell's MP cost through NGINX. The host used PostgreSQL 16 Alpine after the registry repeatedly interrupted its PostgreSQL 17 download. Configuration and operations are in the [deployment guide](DEPLOYMENT.md).

## Continuous integration

The release workflow runs on pushes and pull requests to main and supports manual dispatch. It uses read-only repository permissions, disposable database credentials, a native release job and a separate container smoke job. Failed browser traces are reduced to action names and timings before upload. Both jobs passed for implementation `5d8e6e5` on November 21, 2026. The Ubuntu release job independently passed 148 Vitest and 27 Chromium tests with zero failures or skips. The container job built fresh images and exercised the browser-to-game path with PostgreSQL 17 Alpine. [GitHub Actions run 44882205236](https://github.com/iyyneswaran/TheObsidianAbyss/actions/runs/44882205236).

## Security review

Cookie issuance uses the configured HTTPS origin to select Secure cookies. Fastify and private WebSocket entry enforce the browser origin. The game validates player ownership before admitting a returning seat. Account settlement, equipment prices and quest claims use database checks. The acceleration controller lives under the game server test directory and listens on loopback with a per-run credential. The production image starts the compiled game entry point.

## Automated verification

| Release check                                                                          | Passed | Failed | Skipped |
| -------------------------------------------------------------------------------------- | -----: | -----: | ------: |
| Vitest in 17 files, including game simulations, services, persistence, clock and audio |    148 |      0 |       0 |
| Chromium development browser suite                                                     |     24 |      0 |       0 |
| Compiled service restart and persistence                                               |      1 |      0 |       0 |
| Built expeditions with four registered seats and with one silent seat                  |      2 |      0 |       0 |
| Total                                                                                  |    175 |      0 |       0 |

Frozen dependency installation, Prisma validation, isolated migrations, seeding, formatting, TypeScript, ESLint and the production build passed. The separate Compose smoke passed on local PostgreSQL 16. Coverage instrumentation was disabled. Browser checks exercised trusted audio activation, category gains, silent gameplay, keyboard rebinding, reduced motion, HP/MP, movement, collision, reconnect, permanent death, three boss phases and reward settlement. The built four-player run verified the original seat and its HP after reconnect, then checked each account's wallet, XP and quest progress after victory. The solo run completed with audio disabled.

## Performance comparison

See the [zone-by-zone comparison](../artifacts/milestone-7/performance-comparison.md). Raw samples are in [the baseline](../artifacts/milestone-7/performance-before.json) and [the updated four-browser run](../artifacts/milestone-7/performance-after.json). Both use a Windows loopback server, Chromium, four separate player contexts and the same five-zone route. Fixtures position living players and advance combat time. Machine load and screenshots influence wall-clock measurements.

Four-client Phaser samples increased from 34.5–54.4 FPS to 55.1–56.9 FPS. Cumulative server cadence increased from 22.1–23.2 to 29.9–30.0 ticks/s. Updated scenes contained 334–374 display objects, down from 505–624. The p95 frame interval moved from 33.4 to 33.3 ms. The leader saw 13–14 state updates in each sampled second, with 24.0 incoming WebSocket frames/s across the final measurement. The production four-seat reconnect took 1,444 ms from button activation to a ready scene on loopback. Eight navigation cycles each ended with one document, 223 DOM nodes and 201 listeners. Post-GC heap rose from 10.80 to 11.79 MB during the run.

## Visual evidence

| Review area          | Browser captures                                                                                                                                                                                                                                                                                               |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Entry and team       | [Main menu](../artifacts/milestone-7/main-menu-polished.png), [Character selection](../artifacts/milestone-7/character-selection-polished.png), [Party lobby](../artifacts/milestone-7/party-lobby-polished.png)                                                                                               |
| Progression          | [Profile](../artifacts/milestone-7/profile-polished.png), [Store](../artifacts/milestone-7/store-polished.png), [Vault](../artifacts/milestone-7/vault-polished.png), [Daily quests](../artifacts/milestone-7/daily-quests-polished.png), [Weekly quests](../artifacts/milestone-7/weekly-quests-polished.png) |
| Preferences          | [Audio](../artifacts/milestone-7/settings-audio.png), [Controls](../artifacts/milestone-7/settings-controls.png)                                                                                                                                                                                               |
| Dungeon              | [Loading](../artifacts/milestone-7/loading-screen.png), [Four-player HUD](../artifacts/milestone-7/four-player-hud.png), [Combat feedback](../artifacts/milestone-7/combat-feedback.png), [Minimap](../artifacts/milestone-7/minimap-polished.png)                                                             |
| Overlord             | [Boss telegraph](../artifacts/milestone-7/boss-telegraph.png), [Phase three](../artifacts/milestone-7/boss-phase-3.png)                                                                                                                                                                                        |
| Recovery and results | [Reconnect](../artifacts/milestone-7/reconnect-feedback.png), [Spectator](../artifacts/milestone-7/spectator-mode-polished.png), [Victory](../artifacts/milestone-7/victory-screen-polished.png), [Defeat](../artifacts/milestone-7/defeat-screen-polished.png)                                                |

The expedition screenshot uses the actual server chart. Browser audio assertions measure mixer output with an AnalyserNode.

## Limitations

The measurements cover desktop Chromium and local networking. Human traversal time, subjective sound quality, other browser engines, production TLS certificates, WAN play and multi-host operation need separate evaluation. Active rooms reside in memory on one game process. Repeated garbage collection and bounded runs provide a finite observation window for memory behavior.

## Git

The implementation commit is titled `feat: implement milestone 7 game polish and release readiness`. After the implementation push, the remote `refs/heads/main` and local `HEAD` both resolved to [5d8e6e5256f7b89ee6e87b8f44d39582c99b63ca](https://github.com/iyyneswaran/TheObsidianAbyss/commit/5d8e6e5256f7b89ee6e87b8f44d39582c99b63ca). Resolve the introducing commit with `git log --diff-filter=A -1 --format=%H -- docs/milestone-7.md` and check the current server ref with `git ls-remote origin refs/heads/main`.

## Operational commands

From the repository root in PowerShell, use the existing private test configuration for the disposable native test database.

```powershell
pnpm install --frozen-lockfile
$clusterPath = (Get-Content .postgres-test/cluster-path -Raw).Trim()
$pgCtl = '.postgres-test/package/native/bin/pg_ctl.exe'
& $pgCtl status -D $clusterPath
if ($LASTEXITCODE -eq 3) {
  & $pgCtl start -D $clusterPath -l .postgres-test/postgres.log -o '-h 127.0.0.1 -p 55438' -w
}
$env:TEST_DATABASE_URL = (Get-Content .postgres-test/suite.env -Raw).Trim()
pnpm verify:progression
node tools/verify-containers.mjs
pnpm dev
```

The release command generates Prisma, creates an isolated schema, migrates and seeds it, runs format, type, lint, build and test checks, and removes its schema. On another workstation supply a PostgreSQL URL selecting a dedicated test-named database. Run `pnpm build` to create the frontend and service distributions.

## Next milestone

Use expedition timing, control accessibility and real-network play observations to prioritize the next balance pass.
