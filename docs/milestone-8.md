# The Obsidian Abyss · Milestone 8

## Release status

November 22, 2026. Candidate `v1.0.0-rc.1` passed the local release suite and isolated recovery drills. The ten-minute browser soak also passed. The starting revision was `cc78ac08f10e35b64402436fea7795eb0083a1ba` on `main`. The Milestone 7 workflow passed at that revision. [Baseline workflow](https://github.com/iyyneswaran/TheObsidianAbyss/actions/runs/44930291147).

## Implementation summary

The durable progression worker quarantines invalid jobs so they cannot block the settlements behind them. A patch to the pinned Colyseus SDK uses the browser WebSocket constructor directly, avoiding the protocol error that WebKit reported when it saw Node options. The production proxy rejects dotfiles and restricts form submissions and device permissions. The release tooling covers browser compatibility, TCP-delayed multiplayer, active rooms, database recovery, and checksums.

## Source map

| Area                                 | Files                                                                                                                              |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| Outbox validation and recovery       | `packages/progression/src/outbox.ts`, `packages/progression/src/outboxRecord.ts`, `packages/progression/tests/progression.test.ts` |
| Functional and network browser tests | `playwright.compatibility.config.ts`, `tests/compatibility/`                                                                       |
| Multiplayer load                     | `apps/game-server/tools/verify-load.ts`                                                                                            |
| Recovery and artifacts               | `tools/verify-restore.mjs`, `tools/release-manifest.mjs`, `tools/release-gates.mjs`                                                |
| Packaging and CI                     | `deployment/nginx.conf`, `tools/verify-progression.mjs`, `tools/verify-containers.mjs`, `.github/workflows/release.yml`            |

The browser fix is stored in `patches/@colyseus__sdk@0.17.43.patch` and applied by the frozen lockfile in native and container builds.

## Gameplay verification

The existing simulation and browser suites cover the seven class definitions, dungeon geometry, gate objectives, the three Shadow Overlord phases, death, spectating, identity-verified reconnect, account rewards and equip restrictions. All four party sizes completed the five-zone expedition. The four-account scenario won twice and verified rewards, purchases, equipped abilities, and a claimed quest. The compiled four-seat expedition verified recovery, permanent death, victory, and per-player settlement. The compiled solo expedition won with audio disabled.

## Cross-browser compatibility

The compatibility projects target installed Google Chrome and Microsoft Edge, Playwright Firefox, and Playwright WebKit. WebKit results describe that test engine. The suite records browser version and platform next to its gameplay capture.

Windows passes include Chrome `157.0.8103.79`, Edge `158.0.4370.33`, Playwright Firefox `159.0`, and Playwright WebKit `27.2`. Chrome, Edge and Firefox exercised two independent browser seats. WebKit passed the solo private-room journey after the SDK patch. Earlier multi-context WebKit runs showed intermittent movement input, so two-seat WebKit support remains unverified. The captures show the actual HUD, sprites, effects, and minimap in each engine.

## Network testing

A TCP proxy bound to loopback relays the real WebSocket connection and HTTP requests. It adds 50–300 ms round-trip latency with deterministic jitter. A brief connection interruption exercises the protected seat and same-player recovery. The resulting payload byte counts include TCP framing boundaries from the proxy. A TCP chunk count is independent of application frames and IP packets.

The four RTT settings passed with both seats returning after the interruption. From reopening the path to both authoritative seats becoming active took 419 ms. Browser polling observed state changes in 472–933 ms across the settings. These timings include desktop scheduling and polling. TCP packet loss and real WAN routes remain separate checks. [Network data](../artifacts/milestone-8/network.json).

## Load testing

The loopback SDK workload starts one solo room followed by one, four, eight, and sixteen four-player rooms. Clients send normal movement and cast inputs. The report records state isolation, patch counts, simulation cadence, resident memory, event-loop delay, process CPU, reconnect, and disposal. CPU and memory cover the process hosting the local test clients and services.

The first complete 16-room run admitted 64 players, recorded 267 combat events on the observed sockets, and disposed all rooms. At that load, individual rooms measured 20.2–21.1 ticks/s, the process ended at 163.2 MB RSS, and the reconnect probe took 381 ms. The Windows host was also running browser and build verification. This establishes functional concurrency on that run. The roughly 30 Hz target remains below threshold at 16 rooms on this host. [Load data](../artifacts/milestone-8/load.json).

## Sustained performance and pacing

The browser soak samples frame intervals, scene and audio resources, heap, tick cadence, and received bytes. It also repeats navigation through a real Phaser scene. Human playtime near 30–45 minutes and subjective audio quality require representative play sessions. Fixture-assisted expedition timings are lower bounds on traversal and combat work and omit human decision time.

The 601-second four-browser soak averaged 55.7 FPS across 40 Phaser samples and measured 29.0 server ticks/s. The leader frame interval was 17.9 ms at p95 and 66.5 ms at p99. Textures and listeners stayed at 49 and 57 across the reported start and end samples. Ten repeated scene disposals each ended with 221 DOM nodes and 203 listeners. Post-collection heap ranged from 31.0 to 31.6 MB over those navigation checks. This is a bounded observation on one Windows host. [Soak evidence](../artifacts/milestone-8/soak.json).

## Security and economy

Tests cover authenticated profile ownership, request origin, signed guest identity, old session rejection, protected seats, server-owned combat, and transactional rewards and purchases. The local HTTPS dependency audit reported zero known runtime advisories in its registry response. Production containers should serve behind an HTTPS edge with the exact configured origin. The proxy enforces content policy, request size, and frame embedding restrictions.

## Database durability

The PostgreSQL drill takes a custom-format dump of the isolated test schema and restores it into a new database. It compares restored account, wallet, ledger, purchase, loadout, quest, and run data. Quarantined outbox files require operator review. A process crash before the outbox writes its final file can lose the job. Running rooms live in process memory. The Windows PostgreSQL 18.7 restore checked 21 accounts, 30 runs, six purchases, three quest claims, two equipped loadouts and 111 ledger rows. All 72 wallets reconciled. The 94,230-byte archive was discarded after verification. [Recovery evidence](../artifacts/milestone-8/backup-restore.json).

## Deployment configuration

Compose packages PostgreSQL, the migration task, Fastify, Colyseus, and NGINX. The game and PostgreSQL retain separate volumes. The frontend binds a host loopback port for an operator-selected edge. See [production setup](DEPLOYMENT.md).

The patched candidate container smoke passed on PostgreSQL 17 Alpine and Chromium `159.0.8154.6`. It exercised database readiness, signed guest admission, a private room, WebSocket upgrade, authoritative MP and the proxy security headers. [Container evidence](../artifacts/milestone-8/containers.json).

## Rollback readiness

The isolated Compose drill started the Milestone 7 images, registered a synthetic account, started candidate images with the same PostgreSQL and outbox volumes, and restored the prior image IDs after stopping the candidate. The profile matched before, during, and after the switch. The separate database restore drill exercises history and balances. [Rollback evidence](../artifacts/milestone-8/rollback.json) · [Operations](OPERATIONS.md).

## CI/CD

The release workflow preserves the existing browser verification and container smoke jobs. It adds a browser matrix, bounded load, backup recovery, dependency audit, and release evidence aggregation. [Workflow history](https://github.com/iyyneswaran/TheObsidianAbyss/actions/workflows/release.yml).

## Release artifacts

The manifest command records the checked-out revision, version, build time, Node and pnpm versions, migration names, production entry bundle and SHA-256 checksums. The candidate uses the frozen lockfile and the packaged asset tree.

## Automated verification

| Suite                                           | Passed | Failed | Skipped |
| ----------------------------------------------- | -----: | -----: | ------: |
| Vitest game, progression, API and service tests |    150 |      0 |       0 |
| Development Chromium journeys                   |     25 |      0 |       0 |
| Compiled services restart and persistence       |      1 |      0 |       0 |
| Compiled solo and four-seat expeditions         |      2 |      0 |       0 |
| Total release suite                             |    178 |      0 |       0 |
| Separate browser compatibility                  |      4 |      0 |       0 |
| Separate TCP impairment journey                 |      1 |      0 |       0 |
| Separate ten-minute browser soak                |      1 |      0 |       0 |

Frozen installation, migration, seed, typecheck, lint, formatting, and production build passed. The separate container, restore, rollback, and 16-room workload drills passed. Coverage was not collected. See the [release checklist](RELEASE_CHECKLIST.md).

## Gameplay acceptance and browser evidence

The browser evidence contains 26 PNG captures, covering the 22 requested views and four engine-specific captures.

| Area                     | Captures                                                                                                                                                                                                                                                                                                              |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Opening screens          | [Launch screen](../artifacts/milestone-8/launch-screen.png), [Character selection](../artifacts/milestone-8/character-selection.png), [Private lobby](../artifacts/milestone-8/private-lobby.png)                                                                                                                     |
| Dungeon and combat       | [Four-player HUD](../artifacts/milestone-8/four-player-dungeon.png), [Fire combat](../artifacts/milestone-8/fire-combat.png), [Healer](../artifacts/milestone-8/healer-support.png), [Minimap](../artifacts/milestone-8/minimap.png)                                                                                  |
| World                    | [Molten Passages](../artifacts/milestone-8/molten-passages.png), [Forgotten Crypt](../artifacts/milestone-8/forgotten-crypt.png), [Corrupted Sanctum](../artifacts/milestone-8/corrupted-sanctum.png)                                                                                                                 |
| Final encounter          | [Phase 1](../artifacts/milestone-8/boss-phase-1.png), [Phase 2](../artifacts/milestone-8/boss-phase-2.png), [Phase 3](../artifacts/milestone-8/boss-phase-3.png), [Spectator](../artifacts/milestone-8/spectator.png), [Victory](../artifacts/milestone-8/victory.png), [Defeat](../artifacts/milestone-8/defeat.png) |
| Progression and settings | [Profile rewards](../artifacts/milestone-8/profile-rewards.png), [Store](../artifacts/milestone-8/store.png), [Vault](../artifacts/milestone-8/vault.png), [Quest Board](../artifacts/milestone-8/quest-board.png), [Audio settings](../artifacts/milestone-8/audio-settings.png)                                     |
| Browser coverage         | [Chrome](../artifacts/milestone-8/compatibility-chrome.png), [Edge](../artifacts/milestone-8/compatibility-edge.png), [Firefox](../artifacts/milestone-8/compatibility-firefox.png), [WebKit](../artifacts/milestone-8/compatibility-webkit.png)                                                                      |

## Known limitations and release decision

**Public launch is NO-GO.** Public DNS, HTTPS/WSS, geographic latency, and production backup integration require an authorized environment. **Release candidate is a conditional GO for staging.** The local functional, production-equivalent, and recovery gates passed. Hosted results are available from the workflow history. Full-capacity performance, two-seat Windows WebKit, and public infrastructure remain outstanding. Test combinations cover desktop browser engines. Single-process active-room state does not survive a game process restart.

## Git and operations

Use `git rev-parse HEAD` and `git ls-remote --exit-code origin refs/heads/main` to verify the candidate revision. The release reports and asset files use synthetic accounts.

```powershell
pnpm install --frozen-lockfile
pnpm dev
```

```powershell
$env:TEST_DATABASE_URL = (Get-Content .postgres-test/suite.env -Raw).Trim()
$env:PG_BIN = 'C:/Program Files/PostgreSQL/18/bin'
$env:M8_RESTORE = '1'
pnpm verify:progression
Remove-Item Env:M8_RESTORE
$env:M8_VERIFY = 'compatibility'
$env:M8_BROWSER = 'chrome'
pnpm verify:progression
Remove-Item Env:M8_BROWSER
$env:M8_VERIFY = 'network'
pnpm verify:progression
$env:M8_VERIFY = 'load'
pnpm verify:progression
$env:M8_VERIFY = 'soak'
pnpm verify:progression
Remove-Item Env:M8_VERIFY
$env:M8_CONTAINER_EVIDENCE = '1'
node tools/verify-containers.mjs
pnpm release:manifest --capture
pnpm release:gates
```

Install Firefox and WebKit with `pnpm exec playwright install firefox webkit`. Repeat the compatibility check with `edge`, `firefox`, and `webkit`. Docker build and rollback commands are in the [deployment guide](DEPLOYMENT.md) and [operations runbook](OPERATIONS.md).

## Final milestone conclusion

The production-equivalent candidate is ready for isolated staging. A public launch requires verified TLS and WSS, production backup integration, and a measured operating limit on representative hosting.
