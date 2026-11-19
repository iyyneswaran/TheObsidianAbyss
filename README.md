# The Obsidian Abyss

The Obsidian Abyss is a cooperative pixel-art dungeon crawler for desktop browsers. Up to four wizards can fight the Shadow Overlord in a private party. Dungeon rewards fund class abilities in the Store, equipment choices in the Vault, and account progression.

The workspace uses React, Vite, Tailwind CSS and Phaser 3 in the browser, Colyseus for multiplayer, and Fastify and Zod for the API.

## Run locally on Windows

Use Node.js 22.13 or newer, pnpm 12.18.0, Git, and a desktop browser.

```powershell
pnpm install --frozen-lockfile
if (!(Test-Path .env)) { Copy-Item .env.example .env }
pnpm dev
```

The example environment is optional with the default ports. If `.env` already exists, keep your local settings.

For persistent accounts and wallets, configure PostgreSQL and run `pnpm db:migrate` and `pnpm db:seed` before starting the services. The setup commands and disposable-database release checks are in [Windows development](docs/DEVELOPMENT.md#persistent-progression).

Open [the landing page](http://localhost:5173/), then select **Explore dungeon** to inspect the three connected rooms. Select **Open playground** for Frost Nova and the Colyseus test room. The API health endpoint is at [http://localhost:3001/health](http://localhost:3001/health).

## Checks

```powershell
pnpm exec playwright install chromium --only-shell
pnpm typecheck
pnpm lint
pnpm format:check
pnpm build
pnpm test
```

`pnpm test:unit` runs Vitest. `pnpm test:browser` starts its own frontend, API and game server. Use separate ports when running the development stack concurrently. For release checks with persistence and a production restart, use `pnpm verify:progression` with a dedicated PostgreSQL test database.

See [Architecture](docs/ARCHITECTURE.md), [Tech stack](docs/TECH_STACK.md), [Milestones](docs/MILESTONES.md), [Asset registry](docs/ASSET_REGISTRY.md), and [Windows development](docs/DEVELOPMENT.md).
