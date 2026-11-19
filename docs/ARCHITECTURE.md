# Architecture

## Browser

React owns routing, controls, and connection status. The playground lazily imports Phaser and owns one game instance for the lifetime of the route. BootScene loads the atlas. PlaygroundScene positions the effect at a fixed anchor and gives React a typed playback callback. Phaser owns the canvas and its animation loop. Route cleanup destroys the game and leaves any joined room.

## Services

The Colyseus game server listens on loopback and exposes the temporary `test_room` through its WebSocket transport. The browser uses the official Colyseus SDK to join and leave. In future milestones, rooms will validate player inputs and run the authoritative simulation. Phaser will render the resulting snapshots and events.

The Fastify API starts independently. Its health route returns a typed service response, and Zod validates the service configuration. CORS authorizes the configured frontend origin. PostgreSQL and Prisma are planned for later persistence work.

## Packages

- `@obsidian/shared` owns service and room identifiers, local port defaults, and the health contract. Network message contracts can be added when the first gameplay messages are defined.
- `@obsidian/game-core` owns the logical viewport and establishes a framework-neutral boundary for future simulation code.
- `@obsidian/game-assets` owns effect paths, metadata types, and playback configuration.

The workspace builds packages before dependent apps. Development uses source exports and production builds resolve compiled package exports. The small set of React controls lives in the web app.
