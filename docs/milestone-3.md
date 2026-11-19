# Milestone 3 — Private online co-op

Implemented and verified on November 19, 2026. One to four guests can form a private party, select wizards, enter the existing dungeon together, and recover a dropped connection with the same browser identity. Earlier routes for the dungeon inspector, solo wizard controls, and Frost Nova remain available.

## Files

| Area                      | Files and responsibilities                                                                                                                                                                                                                                                                                                                                           |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared contracts          | `packages/shared/src/coop.ts` defines the strict Zod requests and the Colyseus room and player schemas. `packages/shared/src/guest.ts` signs and verifies guest cookies and implements bounded request counting. `packages/shared/package.json` and `tsconfig.json` expose the two subpaths.                                                                         |
| Fastify                   | `apps/api/src/routes/guestSession.ts` issues or renews guest credentials. `apps/api/src/app.ts` and `index.ts` wire the endpoint, CORS, and secret configuration.                                                                                                                                                                                                    |
| Colyseus                  | `apps/game-server/src/rooms/CoopDungeonRoom.ts` owns membership, leadership, simulation, and reconnection. `src/party/directory.ts`, `routes.ts`, and `simulation.ts` allocate codes, authenticate seat requests, and reuse dungeon collision. `src/server.ts`, `src/config/env.ts`, `src/index.ts`, and `package.json` wire the transport and runtime dependencies. |
| Web routes                | `apps/web/src/pages/Party.tsx` and `OnlineDungeon.tsx` implement the routes, roster, and controls. `components/PartyConfirm.tsx` and `PartyRoster.tsx` provide confirmation and seat cards. `src/main.tsx`, `pages/Landing.tsx`, and `pages/CharacterSelection.tsx` wire navigation.                                                                                 |
| Web connection and Phaser | `apps/web/src/multiplayer/party.ts` and `useParty.ts` share one connection across pages. `src/game/characters/onlineActors.ts`, `characters/player.ts`, `config/createDungeonGame.ts`, `dungeon/debug.ts`, `dungeon/preview.ts`, and `scenes/DungeonScene.ts` render synchronized wizards with the existing map, animations, and camera.                             |
| Verification              | `packages/shared/tests/guest.test.ts`, `apps/game-server/tests/partyRules.test.ts`, `apps/game-server/tests/coop.test.ts`, `tests/browser/coop.spec.ts`, and `playwright.config.ts` cover credentials, deterministic simulation, real sockets, and browser interactions.                                                                                             |
| Setup and documentation   | `tools/prepare-guest.mjs`, `package.json`, `pnpm-lock.yaml`, `.env.example`, and `.gitignore` wire development setup and ignore local credentials and captures. `docs/ARCHITECTURE.md`, `DEVELOPMENT.md`, `MILESTONES.md`, and this report record the workflow.                                                                                                      |

## Multiplayer architecture and lobby

1. The browser calls Fastify's `POST /session/guest` to obtain a 12-hour signed guest cookie. The API and game server share the signing key. The HTTP seat request and WebSocket upgrade verify the exact configured web origin and the guest's credential.
2. Colyseus 0.17 serves the private `coop_dungeon` room. `POST /party/connect` accepts create, join, and reconnect requests. A room checks membership and phase before reserving a seat. The usual public Colyseus join path for this room rejects requests. `test_room` remains available for the playground.
3. Creation picks a six-character code with Node's cryptographic randomness, omits ambiguous characters, and retries collisions. The server assigns the creator leadership and picks the lowest available slot. On explicit lobby departure, leadership transfers to the connected member in the lowest-numbered slot. A temporary loss preserves the leader's reserved seat.
4. The four-slot roster replicates guest names, classes, leadership, and connection states. All seven classes are valid, duplicates are welcome, and class changes are possible until start. The lobby shows the code, copy control, occupied and open seats, and start and leave controls.
5. A connected leader may start. With one to three connected guests, the confirmation modal offers **Cancel** and **Enter Dungeon**, and the server independently requires confirmation. Four connected guests can enter directly. The same dungeon and movement rules apply to every party size.
6. The room transitions through `LOBBY`, `STARTING`, `ACTIVE`, and `ENDED`. Start locks the roster and assigns deterministic non-overlapping locations inside the canonical spawn marker. Colyseus Schema patches carry the phase and all player snapshots. A team code remains valid for authorized recovery during the life of the room.

## Movement and rendering

The browser sends `{ sequence, horizontal, vertical }` up to 20 times per second. Directions are integers from −1 through 1. The server accepts input only from the current connection for that player, keeps one latest sample, rejects old sequences, caps accepted input at 32 messages per second, and expires movement after 300 ms of silence. The shared `game-core` simulation advances with fixed 30 Hz steps at 144 px/s. It normalizes diagonals, uses the canonical Tiled collision and bounds, follows the bridge's walkable geometry, and publishes lava hazard state. Absolute position, speed, elapsed time, and target player fields are outside the accepted protocol.

The room configures 15 Hz Schema patches for authoritative transform, facing, motion, acknowledgment, and hazard state. The Phaser scene draws every wizard with the corresponding class sprite and facing/idle/walking animation. It interpolates local and remote positions against server snapshots and follows the local wizard with the camera. This milestone uses interpolation without client prediction. Development F3 shows room and player IDs, roster state, authoritative and rendered positions, input acknowledgment, tick, estimated patch cadence, zone, and hazard state.

## Disconnect and reconnection

- A dropped socket clears its last movement input, freezes the authoritative position, and retains the original player, class, and seat. Teammates can see a **Disconnected · Protected** roster entry and a translucent wizard when the entity is in view. Wizards do not block other players' paths.
- Colyseus can resume a temporarily interrupted socket using its current token. A reload tries to recover the room using the code stored in that tab. For a new tab in the same browser profile, the player enters the team code and selects **Reconnect**. The game server verifies the cookie before issuing the owner an existing seat ticket, and verifies the cookie again with the reservation and current token on upgrade.
- Successful resume reuses the original player entity and authoritative transform, clears the protected state, and invalidates the prior Colyseus token. The app keeps the team code in session storage. Credentials and raw tokens stay out of app diagnostics and browser storage.
- A protected seat defaults to a 120-second recovery window. After more than six drops within a minute, the seat enters a brief retry cooldown. Both thresholds are configurable. **Leave Team** releases a lobby seat, and confirming **Leave Session** permanently releases that seat in the current run. An abandoned run is disposed after its last reservation expires. Connected games have no time limit.
- The replicated life-state field is separate from connection state. Combat, actual damage immunity, death, and spectating are deferred.

## Acceptance checklist

- [x] Preserve the M0–2 routes and behaviors, including health, Frost Nova, `test_room`, inspector, character selection, and solo movement.
- [x] Create a private team with a secure code and join by code. Enforce four seats, reject invalid entries, preserve reserved slots, and prevent late joins.
- [x] Synchronize all seven valid wizard choices, duplicate classes, names, open slots, leader, connection state, and phase. Enforce leader-only start and deterministic lobby leadership transfer.
- [x] Require explicit confirmation for an incomplete four-slot team. Cancel keeps the lobby open. Parties of one, two, three, and four can enter the same dungeon session for their team.
- [x] Render all teammates with their class sprites and movement states. Give each browser control of its own wizard and follow it with the camera.
- [x] Assign distinct safe spawn positions. Verify normalized diagonal motion, walls, pillars, bridge traversal, hazard state contract, and synchronized movement.
- [x] Freeze and retain a protected character on a drop. Distinguish voluntary forfeiture, refresh, resume, and expiration. Restore class, position, and the original entity without duplication.
- [x] Enforce ownership on reconnect. Reject unauthorized, stale, forged, cross-team, duplicate, and flooded input or seat requests as covered below.
- [x] Verify real four-context browser play, production co-op, and earlier milestones. Generate all ten browser captures and record the results.
- [x] Run the full automated suite, formatting, typechecking, lint, and production build before committing.

## Executed automated validation

| Executed check                                                                      | Pass | Fail | Skip |
| ----------------------------------------------------------------------------------- | ---: | ---: | ---: |
| Vitest unit and deterministic simulation cases, including ten new cases             |   42 |    0 |    0 |
| Vitest integration cases for Fastify health, traditional room, and cooperative room |    3 |    0 |    0 |
| Playwright browser cases, including two cooperative cases                           |   11 |    0 |    0 |
| Built-app smoke with an actual API, game server, and two Chromium contexts          |    1 |    0 |    0 |
| TypeScript, ESLint, Prettier, and production build commands                         |    4 |    0 |    0 |

The standard `pnpm test` suite ran 45 Vitest cases and 11 Playwright cases. The regression subset contains 34 Vitest cases and nine Playwright cases. Coverage percentages were not collected.

- The real Colyseus integration used the official SDK, verified cookies issued through Fastify's request injector, and exercised isolated rooms, roster changes, starts with 1–4 players, late and duplicate join rejection, original-seat recovery, automatic reconnect, voluntary departure, and expiration of an abandoned room.
- Security assertions in the above cases covered unsigned, modified, expired, and wrong-key credentials, foreign origin, oversized requests, capacity, non-leader start, fabricated position and player IDs, invalid directions, old/duplicate inputs, movement flood bounds, protected entity targeting, wrong-identity reconnect, copied reconnect ticket under a foreign identity, and replay of the previous ticket.
- Four independent Chromium contexts picked Fire, Ice, Healer, and Defense. Every context saw the same room and four entities. Fire and Ice moved independently. The leader went around a pillar and crossed the bridge, and wall and pillar attempts stopped. A closed Healer tab recovered the same displaced player in a new tab using the team code and original cookie. Defense kept its seat on refresh. The other browser case tested solo confirmation cancellation, entry, and explicit exit with canvas disposal.
- The production build ran with a matching guest key in both processes. Two independent Chromium contexts created and joined a team, confirmed entry, rendered the dungeon and roster, and exercised movement. The Fastify health response and the absence of the development debug panel were checked.

## Browser screenshots

Playwright writes actual app captures to `artifacts/milestone-3/`. Run the browser suite to regenerate these local files.

| Capture                                             | Visible evidence                                                            |
| --------------------------------------------------- | --------------------------------------------------------------------------- |
| `artifacts/milestone-3/create-team.png`             | Wizard selection and creation controls                                      |
| `artifacts/milestone-3/join-team.png`               | Code entered by a second browser                                            |
| `artifacts/milestone-3/lobby-one-player.png`        | Creator, code, and three open slots                                         |
| `artifacts/milestone-3/lobby-four-players.png`      | Four synced names and classes, with leader marked                           |
| `artifacts/milestone-3/incomplete-team-warning.png` | Warning with Cancel and Enter Dungeon                                       |
| `artifacts/milestone-3/four-player-dungeon.png`     | Four wizard sprites and roster inside the shared entrance                   |
| `artifacts/milestone-3/two-player-movement.png`     | Fire and Ice at distinct positions after independent input                  |
| `artifacts/milestone-3/player-disconnected.png`     | Protected teammate in the roster and diagnostics                            |
| `artifacts/milestone-3/player-reconnected.png`      | Reconnected teammate and restored identity                                  |
| `artifacts/milestone-3/multiplayer-debug.png`       | Development room, player, position, acknowledgment, and cadence diagnostics |

## Security and limitations

Guest cookies are temporary bearer credentials for one browser profile. They are signed, host-only, HttpOnly, and SameSite=Lax. HTTPS configuration marks the cookie Secure. Reconnect requires the valid guest cookie and a live reservation owned by that guest. Cookie deletion or expiry prevents recovery. A game process restart discards all reservations. The system is in-memory on one game server and assumes the configured origins, shared key, and TLS termination are controlled by the operator. A party code acts as a limited lobby invitation. A person with the code can join an available lobby seat using their own guest identity.

The game server limits active teams to 64, caps request bodies at 1 KiB, and rate-limits team lookups. The room enforces socket-message and movement bounds. Integration checked room disposal after the last protected seat expired. These tests do not measure sixty-four-room load or persistent storage.

A four-client loopback run saw four active player entities and 13 state updates in the previous second while the leader was moving. The configured patch rate is 15 Hz. A short production Chromium sample of 45 animation-frame intervals measured 16.7 ms median and 16.8 ms p95. No sustained FPS, server tick jitter, long-session listener or heap counts, wide-area latency, packet loss, or network bandwidth were measured. Deterministic protocol tests covered expired inputs, late/out-of-order and duplicate sequences, temporary disconnect, malformed input, recovery, and rapid inputs. The production build emitted Vite's size advisory for the existing Phaser chunk. Combat effects, durable accounts, cross-restart recovery, and production deployment are outside this milestone.

## Git and operation

The milestone uses `main` and commit message `feat: implement milestone 3 online cooperative sessions`. The introducing commit recorded in Git is the authoritative hash for this report. Compare the local revision and `refs/heads/main` on `origin` and inspect the worktree with the commands below.

```powershell
Set-Location 'C:\Users\pdee5\OneDrive\Desktop\TheObsidianAbyss'
git log --diff-filter=A -1 --format=%H -- docs/milestone-3.md
git status --short --branch
git ls-remote --exit-code origin refs/heads/main
```

```powershell
Set-Location 'C:\Users\pdee5\OneDrive\Desktop\TheObsidianAbyss'
pnpm install --frozen-lockfile
pnpm dev
```

Open `http://localhost:5173/party` or choose **Play Online** from `/characters`. Starting or resuming an active run opens `/dungeon/online`. Move with **WASD** or the arrow keys, scroll over the map to zoom, and use **F3** for diagnostics in development. Existing offline and playground routes are `/dungeon/play`, `/dungeon`, and `/playground`.

```powershell
pnpm typecheck
pnpm lint
pnpm format:check
pnpm build

$env:WEB_PORT = '5179'
$env:GAME_PORT = '2573'
$env:API_PORT = '3011'
pnpm test
```

See [Development](DEVELOPMENT.md) for service configuration and [Architecture](ARCHITECTURE.md) for the server and client boundaries.

## Next milestone

Milestone 4 remains planned for combat and encounters, including class abilities, enemies, a boss, and run-specific death rules.
