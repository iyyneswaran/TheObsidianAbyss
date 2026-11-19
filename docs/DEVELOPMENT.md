# Windows development

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
