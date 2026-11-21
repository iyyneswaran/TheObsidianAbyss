# Windows development

## Persistent progression

Run these commands from the repository root. For a fresh PostgreSQL installation using Docker Desktop, generate a local password once and keep the same password for that volume. Set the root `.env` values `POSTGRES_PASSWORD` and `DATABASE_URL` to matching values for subsequent sessions. The API and game server require the same database and guest signing secret.

```powershell
pnpm install --frozen-lockfile
$env:POSTGRES_PASSWORD = node -e "process.stdout.write(require('node:crypto').randomBytes(24).toString('hex'))"
$env:DATABASE_URL = "postgresql://obsidian:$($env:POSTGRES_PASSWORD)@localhost:55432/obsidian"
docker compose up -d --wait postgres
pnpm db:generate
pnpm db:validate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

A native PostgreSQL service also works. Point `DATABASE_URL` at its game database, then run the same Prisma commands. `GET /health/database` checks database access and the migrated catalog. Set `PROGRESSION_OUTBOX_DIRECTORY` to a private, writable, persistent directory for each game-server instance.

For full release verification, create a dedicated test database once, then run the suite. The following uses the same Compose instance.

```powershell
docker compose exec -T postgres createdb -U obsidian obsidian_test
$env:TEST_DATABASE_URL = "postgresql://obsidian:$($env:POSTGRES_PASSWORD)@localhost:55432/obsidian_test"
pnpm exec playwright install chromium --only-shell
pnpm verify:progression
```

The verifier creates and drops its own unique schema inside the test database. It checks formatting, types, lint, production builds, Vitest, browser gameplay and a fresh production service startup. Its default web, game and API ports are 5180, 2574 and 3012. Set `WEB_PORT`, `GAME_PORT` and `API_PORT` to override them. The browser harness uses API port plus 1000 for its loopback-only positioning fixture. Ordinary `pnpm test` without an isolated test URL skips PostgreSQL-dependent cases.

Online combat uses **left click** for the free basic, **Q/E/R/F** for the selected wizard's abilities, **G** for the Shadow Gate, and **F3** for development diagnostics. Private team setup remains at `/party`. The inspector and solo movement routes use the original map. See [Milestone 4](milestone-4.md) for combat tests and screenshots.

Use PowerShell in the repository root. `pnpm dev` starts the web, game server, and API together. For independent development, run a single workspace command.

| Service  | Command                                   | Default                 |
| -------- | ----------------------------------------- | ----------------------- |
| Web      | `pnpm --filter @obsidian/web dev`         | `http://localhost:5173` |
| API      | `pnpm --filter @obsidian/api dev`         | `http://localhost:3001` |
| Colyseus | `pnpm --filter @obsidian/game-server dev` | `ws://localhost:2567`   |

Use the root `.env` for overrides. If changing a port, update its corresponding URL as well. Set `WEB_ORIGIN` to the exact browser origin, which includes the hostname and port. Vite exposes the two `VITE_` URLs to browser code. `VITE_API_URL` identifies the API for future browser features.

If pnpm fails to reach the registry, inspect `pnpm config get registry`. You can run `pnpm install --frozen-lockfile --registry=https://registry.npmjs.org/` to use the official HTTPS registry.

If a port is occupied, use `Get-NetTCPConnection -State Listen -LocalPort 5173,3001,2567` to identify the listener. Restart services after changing `.env`. For browser tests, use `pnpm exec playwright install chromium --only-shell`. To use installed Microsoft Edge, set `$env:PLAYWRIGHT_CHANNEL = 'msedge'` before running `pnpm test:browser`.

OneDrive sync can briefly lock generated files or delay watcher events. If a save does not reload, check that the file is available locally and restart the affected watcher. For persistent Vite watcher delays, set `$env:CHOKIDAR_USEPOLLING = 'true'` before starting the web app.

## Dungeon preview

Start the web workspace and open [the dungeon](http://localhost:5173/dungeon). Use **WASD** or the **arrow keys** to pan and the **mouse wheel** over the map to step through zoom levels. **R** returns to the entrance at 0.5× zoom. The room buttons center the camera on the named room at the current zoom. **F3** toggles the development overlay for solids, lava, named zones, and pointer coordinates.

See [Dungeon map](DUNGEON_MAP.md) for the room graph and Tiled editing workflow. To rebuild the baseline map and original art, run `node tools/dungeon/generate.mjs` from the root. The generator overwrites the committed map and atlas, so carry hand-edited map changes into the generator before regenerating if both workflows are in use.

`pnpm test:unit` validates camera bounds, map metadata, and route connectivity. `pnpm test:browser` tests the actual Phaser view, camera controls, animated regions, and navigation to the original playground. Dungeon screenshots are captured under `test-results/`.

## Wizard movement

Open [character selection](http://localhost:5173/characters), choose a wizard, and select **Enter Dungeon**. The playable route uses **WASD** or **arrow keys** to move, the **mouse wheel** to zoom, and **F3** for the development movement panel. **Change wizard** returns to selection.

The Milestone 2 Playwright tests save captures in the ignored `artifacts/milestone-2/` folder. If your local servers are already running, the suite can use alternate ports. From a separate PowerShell session set `$env:WEB_PORT='5179'`, `$env:GAME_PORT='2573'`, and `$env:VITE_GAME_SERVER_URL='ws://localhost:2573'`, then run `pnpm test`.

## Private co-op

Run `pnpm dev` and open [Private teams](http://localhost:5173/party), or select a wizard and choose **Play Online**. Choose **Create Team**, or enter a team code and select **Join Team**. The leader starts the dungeon. A different tab in the same browser profile shares the guest cookie. Separate browser profiles or private contexts represent different guests.

`pnpm dev` prepares an ignored random local key before starting the apps. When running the services separately for the first time, run `node tools/prepare-guest.mjs` from the root first. For a built production smoke run, configure the same 64-hex-character `GUEST_SESSION_SECRET` for the API and game processes. Use one host across the web, API, and game server so the host-only cookie reaches both services. The configured `WEB_ORIGIN` must match the web URL exactly. HTTPS origins use a Secure guest cookie.

The default recovery window is 120 seconds and the brief cooldown applies after more than six drops per minute. Configure these through `PARTY_RECOVERY_SECONDS` and `PARTY_DROP_LIMIT`. A refresh on the online route attempts recovery automatically. On a new tab in the same profile, enter the old code and choose **Reconnect**. **Leave Session** is an explicit forfeiture of the seat.

The Playwright suite starts the API, game server, and web app on loopback and uses its own temporary key. To avoid running servers, override all three test ports with `$env:WEB_PORT='5179'`, `$env:GAME_PORT='2573'`, and `$env:API_PORT='3011'` before `pnpm test`. Co-op browser captures are under `artifacts/milestone-3/`.

## Five-zone expedition

New private teams default to the five-zone expedition. Select **Classic dungeon** for the original co-op arena. Press G near a mechanism or passage and M for the expanded expedition map. Use `pnpm exec vitest run packages/game-core/tests/expedition.test.ts` for connectivity and deterministic walkthroughs. The release suite also exercises the real four-browser route. See [Milestone 6](milestone-6.md) for the Windows database and release commands.

## Release validation

Set TEST_DATABASE_URL to a disposable test-named database and run pnpm verify:progression. The runner creates a unique schema and removes it in a finally block. For a focused four-client comparison set M7_BENCH to before or after and invoke the same runner. Clear the variable for the complete release gate. Built-service tests use the existing loopback-only staging controller. See [container verification](DEPLOYMENT.md).
