# Architecture

The online room's combat simulation lives in `packages/game-core/src/combat`. The room owns cast validation, fixed-step combat, hazard and shrine processing, encounters, boss phase transitions, and run results. Colyseus replicates compact actor and spell state and publishes numbered combat events. Phaser handles input and presentation. See [Milestone 4](milestone-4.md) for loadout configuration, authority and recovery rules, and test results.

## Browser

React owns routing, controls, and connection status. The playground lazily imports Phaser and owns one game instance for the lifetime of the route. BootScene loads the atlas. PlaygroundScene positions the effect at a fixed anchor and gives React a typed playback callback. Phaser owns the canvas and its animation loop. Route cleanup destroys the game and leaves any joined room.

## Dungeon

`/dungeon` uses the shared Phaser stage lifecycle. It loads a finite Tiled map, resolves each embedded tileset image relative to the map URL, and creates depth-ordered Phaser tile layers. Tiled animation frames drive the lava, torches, and shrine crystal in batches. The scene reuses one radial light texture for warm and cyan glows.

The [canonical map](DUNGEON_MAP.md) stores gameplay semantics and named regions alongside the visual tiles. `@obsidian/game-core` reads the same JSON without Phaser and exposes world or tile queries for walkability, solids, lava, and sight obstruction. A future Colyseus deployment can package and read that same map file with the engine-independent reader and use its results for authoritative validation.

The preview camera keeps a bounded world center and discrete zoom, then applies that state to the pixel-rounded Phaser camera. Development builds can show collision and region boundaries with F3. Debug geometry is built once on demand, and the React readout samples at most ten times per second. The dungeon route renders locally without opening a Colyseus connection.

## Wizard play

`/characters` reads the typed wizard catalog in `@obsidian/game-assets` and hands the chosen ID to `/dungeon/play` through browser history state. The playable mode reuses the inspector's Phaser stage, scene, tilemap, and environment animation. Phaser loads the selected sheet and owns the local character transform. React receives a read-only development sample when F3 is enabled.

Phaser captures directional input. `@obsidian/game-core` normalizes it and advances a 14 × 10 pixel footprint through the canonical terrain grid with axis sweeps. The animation controller reads facing and displacement from the resulting transform. A bounded follow camera interpolates toward the feet. The wizard, walls, and obstacles sort by their floor anchor, with lights and overhead details on their existing layers.

The solo play route runs locally. The online route uses the authoritative simulation described below. See [Milestone 2](milestone-2.md) for the original local movement and rendering.

## Cooperative sessions

Fastify issues a signed temporary guest cookie. Colyseus checks the configured web origin and cookie on both the private seat endpoint and each cooperative WebSocket upgrade. A team code locates a private room, and only the signed guest who owns a disconnected seat can recover it. Colyseus rotates its native reconnect token after the upgrade. The browser saves just the team code in session storage.

The private `coop_dungeon` room owns membership, roster phase, leader authority, classes, spawn, and transforms. It advances the canonical movement implementation at 30 Hz and publishes Schema patches at 15 Hz. Each client sends sequenced directions. Phaser draws and interpolates server snapshots, and the camera follows only the local participant. The solo route, inspector, and co-op route share dungeon loading, animation, layers, and sprite code.

Unexpected drops reserve a protected seat until the recovery window expires. Voluntary exit releases the seat. Once a run starts, the roster closes to new guests. Room state and reservations are in memory.

## Services

The Colyseus server exposes the temporary `test_room` and the private `coop_dungeon` room through its WebSocket transport. The browser uses the official Colyseus SDK for seat consumption and reconnection.

The Fastify API starts independently. Its health route returns a typed service response, and Zod validates the service configuration. CORS authorizes the configured frontend origin. Fastify and the Colyseus process use separate Prisma connections to the same PostgreSQL database. The browser receives explicit response contracts for account, profile, wallet, store, loadout and quest data.

Each private seat binds a signed guest ID to its verified profile. The room copies the selected class and owned abilities at dungeon start. Actual combat contributions flow into per-player, per-day batches. The game process writes batches and the final roster receipt to a private disk outbox. A worker applies them in serializable PostgreSQL transactions. Durable run, event, purchase and claim keys make retry safe. The game publishes settlement status to every connected roster member.

## Packages

- `@obsidian/shared` owns service identifiers, local ports, health, and the cooperative wire schemas. Its separate Node-only guest entry point handles credential signing and verification.
- `@obsidian/game-core` owns the logical viewport, Tiled map reader, and engine-independent terrain and zone queries.
- `@obsidian/game-assets` owns effect paths, metadata types, and playback configuration.
- `@obsidian/progression` owns Prisma migrations and the server-only identity, currency, equipment and quest services. The shared combat engine owns the fourteen alternate ability definitions.

The workspace builds packages before dependent apps. Development uses source exports and production builds resolve compiled package exports. The small set of React controls lives in the web app.

## Five-zone expedition

The expedition packs five editable Tiled sections into one shared world-coordinate grid. Each Colyseus room owns its CombatRun and Expedition. Only an accepted proximity interaction can advance the section, open a secret or enter the throne. Current-room and discovery state is shared as a change-driven chart snapshot, while existing movement and combat continue through incremental schema fields. Stable exploration event IDs use the existing durable progression outbox.

## Presentation and timing

The Web Audio mixer belongs to the browser tab. Dungeon scenes select the score and emit positional cues from server combat events. Preferences live in local storage. A capped accumulator advances the authoritative simulation in fixed steps after delayed callbacks. Rendering reuses occluders within the camera view and samples debug data only when the overlay is collecting it. See [production topology](DEPLOYMENT.md).
