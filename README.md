# The Obsidian Abyss

The Obsidian Abyss is an online cooperative 2D pixel-art fantasy dungeon crawler for desktop browsers. Milestone 0 provides the development workspace, a Phaser playground with Frost Nova playback, a Colyseus test room, and a Fastify health endpoint.

The workspace uses React, Vite, Tailwind CSS and Phaser 3 in the browser, Colyseus for multiplayer, and Fastify and Zod for the API.

## Run locally on Windows

Use Node.js 22.13 or newer, pnpm 12.18.0, Git, and a desktop browser.

```powershell
pnpm install --frozen-lockfile
Copy-Item .env.example .env
pnpm dev
```

The example environment is optional with the default ports. If `.env` already exists, keep your local settings.

Open [the landing page](http://localhost:5173/), then select **Open playground**. Select **Play Frost Nova** to preview the effect and **Connect** to join `test_room`. The API health endpoint is at [http://localhost:3001/health](http://localhost:3001/health).

## Checks

```powershell
pnpm exec playwright install chromium --only-shell
pnpm typecheck
pnpm lint
pnpm format:check
pnpm build
pnpm test
```

`pnpm test:unit` runs Vitest. `pnpm test:browser` starts its own frontend and game server, so stop `pnpm dev` before running it.

See [Architecture](docs/ARCHITECTURE.md), [Tech stack](docs/TECH_STACK.md), [Milestones](docs/MILESTONES.md), [Asset registry](docs/ASSET_REGISTRY.md), and [Windows development](docs/DEVELOPMENT.md).
