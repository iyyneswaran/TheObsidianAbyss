# Milestone 5 — Persistent progression

November 19–20, 2026 · Release branch `main` · Introducing commit lookup under **Git**.

**Complete.** The full release run passed 140 tests with zero failures and zero skips.

## What shipped

Private parties can earn permanent account XP, coins and gems. Players can buy and equip class abilities, track quest progress, and collect completed rewards. The landing page links to the game, Profile, Store, Vault and Quest Board. The original solo previews, guest teams, default loadouts and Shadow Overlord encounter remain available. The boss and army use the existing twelve directional sheets.

## Source map

| Location                                                         | Responsibility                                                                          |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `packages/progression/prisma/`                                   | PostgreSQL schema, migration and SQL constraints                                        |
| `packages/progression/src/`                                      | Sessions, profiles, wallet, inventory, settlement, outbox, rotations, claims and seed   |
| `packages/game-core/src/combat/`                                 | Alternate abilities, cast resolution, real damage, healing, mitigation and event credit |
| `packages/shared/src/{coop,combat}.ts`                           | Replicated equipment and settlement status                                              |
| `apps/api/src/routes/progression*.ts`                            | Validated public requests and responses, authentication and private data projection     |
| `apps/game-server/src/party/` and `rooms/CoopDungeonRoom.ts`     | Seat ownership, locked loadouts, event batching and result persistence                  |
| `apps/web/src/progression/`                                      | Account forms, Profile, Store, Vault, Quest Board and navigation                        |
| `tests/browser/`, `tests/production/`, package and service tests | Browser gameplay, restart verification, simulations, database and API checks            |
| `tools/verify-progression.mjs`                                   | Disposable schema lifecycle and release checks                                          |

## Database and identity

Fourteen Prisma models cover accounts, sessions, profiles, wallets, ledger entries, run headers and participants, purchases, ownership, equipped loadouts, processed events, quest progress, claims and a versioned catalog. The migration creates foreign keys, unique indexes and database checks for nonnegative balances, signed ledger reasons, one identity per profile and valid roster slots. Profile, ledger time, per-run participation and quest deadline indexes support the public views. The seed upserts 14 abilities and 17 quest templates.

Registration normalizes usernames and requires 12–128 character passwords. Node scrypt uses an independent 128-bit salt, N=32768, r=8 and p=3. A successful login rotates the presented session. PostgreSQL stores only the SHA-256 digest of the random 256-bit session token. The host-only cookie is HttpOnly, SameSite=Lax, valid for fourteen days and Secure on HTTPS. Logout revokes it. Auth rate limiting applies per IP and globally, with bounded password-hash concurrency. State-changing API calls require an allowed Origin.

Registration with a valid guest credential converts its existing profile in place. Its ledger, ownership, quests and run references keep the same ID. Returning as a guest after conversion gets a new profile. An unrecoverable guest credential has no cross-device recovery. The room binds both signed guest and verified profile when reserving a seat and verifies that binding on reconnect. Starting a dungeon locks the roster, class and equipment. Login in another browser cannot acquire the existing seat.

## Wallet, XP and authoritative settlement

| Locked players | Victory coins per eligible player | Qualifying defeat coins per eligible player |
| -------------: | --------------------------------: | ------------------------------------------: |
|              1 |                               240 |                                          24 |
|              2 |                               120 |                                          12 |
|              3 |                                80 |                                           8 |
|              4 |                                60 |                                           6 |

Victory adds 3 gems and 100 XP per eligible seat. A qualifying defeat adds 20 XP and zero gems. A defeat requires an actual hostile exchange. Death and temporary disconnect protection preserve reward eligibility. Forfeiture loses the share and keeps the original divisor. Reward rules are version 1. Level is `1 + floor(total XP / 100)`. Recent run history includes the run ID, outcome and personal awards.

The authoritative game room assigns a UUID and submits a terminal receipt. A single serializable transaction inserts the run, locked participants, wallet ledger entries and profile totals. Run, participant and ledger keys enforce idempotency. Purchases use an atomic conditional debit, ownership insertion, request key and ledger reference. Claims use a unique profile/quest instance key and a ledger credit in one transaction. Recognized write conflicts retry with bounded backoff.

The room batches event contributions per participant, UTC day and metric each second and at completion. A local outbox writes and syncs a temporary file, renames it, then retries delivery to PostgreSQL. Committed games can replay safely after a process restart. The clients display a pending state until the server observes the committed run. Trusted settlement and event ingestion have no public HTTP routes.

## Store, Vault and combat

Alternate Skill 3 costs **180 coins** and occupies **R**. An alternate ultimate costs **6 gems** and occupies **F**. Each class retains its basic attack, Q and E. The Store filters by category and wizard, shows affordability and confirms the price. The Vault saves each class independently, validates ownership and compatibility, previews effective abilities and can restore defaults. A run uses the loadout captured when the leader starts it, including after reconnection.

| Class     | R / F | Ability           |  MP | Cooldown | Server effect                                        | Existing visual            |
| --------- | ----- | ----------------- | --: | -------: | ---------------------------------------------------- | -------------------------- |
| Fire      | R     | Meteor            |  27 |    5.4 s | Delayed 67 damage in a circle plus Burning           | fire/flame-pillar          |
| Fire      | F     | Inferno Core      |  43 |   16.7 s | Five 24-damage pulses around the casting position    | fire/fire-ring             |
| Ice       | R     | Ice Spikes        |  19 |    3.8 s | 42 damage in a line and 2.5 s slow                   | ice/frost-breath           |
| Ice       | F     | Glacial Prison    |  41 |   17.2 s | Delayed 58 area damage and freeze                    | ice/frost-nova             |
| Lightning | R     | Static Field      |  21 |    4.8 s | Four ground pulses of 16 damage                      | lightning/lightning-strike |
| Lightning | F     | Storm Surge       |  43 |   15.8 s | 91 damage per target across up to five enemies       | lightning/chain-lightning  |
| Earth     | R     | Stone Guard       |  19 |    5.3 s | 54-point self shield lasting up to 3.7 s             | scifi/force-field          |
| Earth     | F     | Seismic Cataclysm |  42 |   16.7 s | Three delayed 36-damage shockwaves                   | nature/quake               |
| Wind      | R     | Cyclone           |  21 |    4.3 s | 35 area damage and pull up to 41 px                  | nature/tornado             |
| Wind      | F     | Hurricane         |  39 |     17 s | Four 22-damage pulses with outward displacement      | nature/leaf-storm          |
| Healer    | R     | Healing Bloom     |  24 |    4.9 s | Four pulses restoring up to 14 missing HP each       | holy/heal-aoe              |
| Healer    | F     | Radiant Renewal   |  47 |   17.1 s | Five nearby team healing pulses of up to 21 HP       | holy/heal                  |
| Defense   | R     | Iron Guard        |  18 |    4.7 s | 72% damage reduction for 2.6 s                       | impacts/shield-block       |
| Defense   | F     | Obsidian Ward     |  39 |   16.7 s | Taunt, 98-point shield and 42% block for up to 5.2 s | scifi/force-field          |

## Quest Board and progression security

The five daily slots are hunt (2 kills or assists, 30 coins), offense (160 damage, 35), mana (40 restored MP, 25), explorer (1 qualifying run, 35) and a rotating class challenge (40). The seven weekly slots cover two boss wins (170), twelve kills or assists (110), 1,800 damage (145), five runs (125), 220 teammate HP healed as Healer (160), 200 damage mitigated as Defense (160) and a rotating offensive class challenge (150). All reward claims are manual and coins-only.

Daily periods start at midnight UTC and weekly periods on Monday at midnight UTC. Version, period start and template key identify each instance globally. The daily class cycles through all seven wizards. The weekly offensive class cycles through five. Completed quests have a 24-hour claim grace period. New rotations start with independent progress.

Only the game simulation produces progress events. Healing counts actual missing teammate HP, mitigation counts real hostile damage stopped, and shrine credit counts restored MP. Required monsters grant kill credit to the finisher and eligible teammates contributing at least 20% of maximum HP. Temporary enemy summons and illusions are excluded from kill and offensive quest credit. Protected participants cease earning gameplay credit. Death or defeat preserves prior progress. Repeated event IDs, settlements, purchases and claims cannot duplicate the underlying wallet change.

## Acceptance and executed checks

| Final release command or suite                                     | Actual result                                                                                                                                                                                   |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frozen pnpm installation                                           | Passed for eight workspace projects                                                                                                                                                             |
| Prisma generate, validate, migrate and seed                        | Passed on a fresh PostgreSQL schema. One migration applied and 31 catalog entries seeded.                                                                                                       |
| Prettier, workspace and test typechecks, ESLint, production builds | Passed. Vite emitted its large-chunk size advisory.                                                                                                                                             |
| Vitest                                                             | **122 passed, 0 failed, 0 skipped**, across 14 files. Includes 11 progression-package checks, the public progression API test and the real SDK/account defeat integration.                      |
| Playwright regression and progression journeys                     | **17 passed, 0 failed, 0 skipped**, in 5.3 minutes, one worker. Includes the previous milestones and a 390-pixel viewport check.                                                                |
| Playwright production smoke                                        | **1 passed, 0 failed, 0 skipped**. Fresh compiled services and a fresh browser context authenticated the same account, loaded its two victories and saved equipment, and cast in a new dungeon. |

The successful run generated all 20 named captures. Visual inspection covered forms, currency labels, store portraits and purchase states, quest bars, equipped slots and the combat HUD. All 14 effect references resolved to texture/atlas pairs. A four-client co-op capture observed 14 state updates over one second. Code coverage was not instrumented.

| Feature                       | Verification                                                                                                                                                                                                              |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Accounts, guests and sessions | Salted hashes, rotation, revoked and expired sessions, zero-balance start, guest conversion in place, authenticated API boundaries and sign-out/sign-in                                                                   |
| Wallet, XP and settlement     | PostgreSQL tests for all four team sizes, dead and protected seats, forfeit with no redistribution, qualifying and inactive defeats, ledger signs, concurrent settlement and durable replay after database unavailability |
| Store and Vault               | Insufficient funds, competing debits, duplicate keys, ownership, wrong class/slot and a server-locked loadout after reconnect                                                                                             |
| Combat                        | 62 deterministic combat tests include one independent case per new ability and checks for real HP loss, overhealing, finite shields and protected targets                                                                 |
| Quest Board                   | Daily/weekly size, class assignment, UTC boundaries, contribution caps, death and defeat, manual claims, simultaneous claims and grace-period expiry                                                                      |
| Multiplayer                   | Official SDK clients and Chromium connected to actual Fastify, Colyseus and PostgreSQL services. The four-seat defeat paid each participant 6 coins and 20 XP. The outsider's quest progress stayed at zero.              |
| Persistence                   | After the native PostgreSQL process restarted, a direct read of the earlier browser account returned 2 victories, 200 XP, 110 coins, 0 gems, 2 owned abilities, both saved equipment selections and 1 claim.              |

## Browser screenshots

The [screenshot directory](../artifacts/milestone-5/) contains actual Chromium captures. Browser assertions against live balances, run history, quest responses, mana and enemy HP accompany the images.

| Screenshots                                                                              | Verified state                                                 |
| ---------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `registration.png`, `login.png`, `profile-initial.png`                                   | Account forms, signed-in identity and initial XP               |
| `wallet-before-reward.png`, `wallet-after-victory.png`, `profile-progressed.png`         | Initial balance, four-seat awards and accumulated run history  |
| `store-skills.png`, `store-ultimates.png`, `skill-purchase.png`, `ultimate-purchase.png` | Both catalogs, server prices, ownership and resulting balances |
| `vault-default.png`, `vault-custom-loadout.png`                                          | Class portrait, five slots and saved alternates                |
| `daily-quests.png`, `weekly-quests.png`, `role-specific-quest.png`, `quest-progress.png` | Rotation sizes, role restriction and actual progress           |
| `quest-claim.png`, `quest-claimed.png`                                                   | Explicit coin claim and persistent claimed state               |
| `equipped-skill-combat.png`, `equipped-ultimate-combat.png`                              | Locked Meteor and Inferno Core in a live Phaser dungeon        |

## Operational limits

A measured native PostgreSQL sample on the Windows loopback host took **94.5 ms** to commit a four-seat victory, **27.4 ms** for a purchase and refreshed Store, **31.3 ms** for a claim and refreshed board, and **3.3 ms** for a Profile read. These are single observations during local testing. Service-to-browser latency and percentile distributions were unmeasured. The game simulates at 30 Hz and emits progress batches every 30 ticks. Database reads occur at equipment lock and settlement status checks, outside the per-cast path.

Active rooms and the current one-second metric buffer live in memory. A hard process or disk failure before an outbox file is synced and renamed can lose the unflushed batch or terminal receipt. A committed database transaction survives a delivery retry. Production requires durable, writable outbox storage and database backups. An unavailable database blocks new persistent seats or loadout locks, and earned receipts already on disk wait for recovery. Public profile history shows the latest 12 runs and 30 wallet transactions.

The Windows verification host used native PostgreSQL 18.7 because the local Docker Engine endpoint was unavailable. Compose execution, WAN latency, sustained load, production TLS termination, long-run heap growth and code coverage percentages were unmeasured. Account password recovery, OAuth and email verification remain deferred. Combat and economy balance are provisional.

## Run on Windows

For a fresh checkout, use the [PostgreSQL setup commands](DEVELOPMENT.md#persistent-progression). On the verified checkout the ignored root environment points to the local game database. From the project directory:

```powershell
pnpm install --frozen-lockfile
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Open the web URL configured by `WEB_PORT`. The persistent routes are `/register`, `/login`, `/profile`, `/store`, `/vault` and `/quests`. The game starts from `/party`. Supply a dedicated test database through `TEST_DATABASE_URL` and run `pnpm verify:progression` for the full release suite.

On this Windows checkout the native server listens on 127.0.0.1 port 55438. To restart it after a machine reboot, use the cluster created for this checkout:

```powershell
$clusterPath = (Get-Content .postgres-test/cluster-path -Raw).Trim()
$pgCtl = '.postgres-test/package/native/bin/pg_ctl.exe'
& $pgCtl status -D $clusterPath
if ($LASTEXITCODE -eq 3) {
  & $pgCtl start -D $clusterPath -l (Join-Path (Get-Location) '.postgres-test/postgres.log') -o '-h 127.0.0.1 -p 55438' -w
}
pnpm dev
```

## Git

The release targets `main` on the configured GitHub remote. Commit message: `feat: implement milestone 5 progression store vault and quests`. Resolve the introducing hash and compare the remote branch with:

```powershell
git log --diff-filter=A -1 --format=%H -- docs/milestone-5.md
git status --short --branch
git ls-remote --exit-code origin refs/heads/main
```

Milestone 6 has not started.
