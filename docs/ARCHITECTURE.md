# Architecture

## Browser

React owns routing, controls, and connection status. The playground lazily imports Phaser and owns one game instance for the lifetime of the route. BootScene loads the atlas. PlaygroundScene positions the effect at a fixed anchor and gives React a typed playback callback. Phaser owns the canvas and its animation loop. Route cleanup destroys the game and leaves any joined room.

## Dungeon

`/dungeon` uses the shared Phaser stage lifecycle. It loads a finite Tiled map, resolves each embedded tileset image relative to the map URL, and creates depth-ordered Phaser tile layers. Tiled animation frames drive the lava, torches, and shrine crystal in batches. The scene reuses one radial light texture for warm and cyan glows.

The [canonical map](DUNGEON_MAP.md) stores gameplay semantics and named regions alongside the visual tiles. `@obsidian/game-core` reads the same JSON without Phaser and exposes world or tile queries for walkability, solids, lava, and sight obstruction. A future Colyseus deployment can package and read that same map file with the engine-independent reader and use its results for authoritative validation.

The preview camera keeps a bounded world center and discrete zoom, then applies that state to the pixel-rounded Phaser camera. Development builds can show collision and region boundaries with F3. Debug geometry is built once on demand, and the React readout samples at most ten times per second. The dungeon route renders locally without opening a Colyseus connection.

## Wizard play

`/characters` reads the typed wizard catalog in `@obsidian/game-assets` and hands the chosen ID to `/dungeon/play` through browser history state. The playable mode reuses the inspector's Phaser stage, scene, tilemap, and environment animation. Phaser loads the selected sheet and owns the local character transform. React receives a read-only development sample when F3 is enabled.

Phaser captures directional input. `@obsidian/game-core` normalizes it and advances a 14 × 10 pixel footprint through the canonical terrain grid with axis sweeps. The animation controller reads facing and displacement from the resulting transform. A bounded follow camera interpolates toward the feet. The wizard, walls, and obstacles sort by their floor anchor, with lights and overhead details on their existing layers.

A future authoritative Colyseus room can accept bounded directional input and sequence numbers, advance the same portable movement code against the canonical map, and send validated transforms to clients. The current play route runs locally. See [Milestone 2](milestone-2.md) for the implementation and evidence.

## Services

The Colyseus game server listens on loopback and exposes the temporary `test_room` through its WebSocket transport. The browser uses the official Colyseus SDK to join and leave. In future milestones, rooms will validate player inputs and run the authoritative simulation. Phaser will render the resulting snapshots and events.

The Fastify API starts independently. Its health route returns a typed service response, and Zod validates the service configuration. CORS authorizes the configured frontend origin. PostgreSQL and Prisma are planned for later persistence work.

## Packages

- `@obsidian/shared` owns service and room identifiers, local port defaults, and the health contract. Network message contracts can be added when the first gameplay messages are defined.
- `@obsidian/game-core` owns the logical viewport, Tiled map reader, and engine-independent terrain and zone queries.
- `@obsidian/game-assets` owns effect paths, metadata types, and playback configuration.

The workspace builds packages before dependent apps. Development uses source exports and production builds resolve compiled package exports. The small set of React controls lives in the web app.
