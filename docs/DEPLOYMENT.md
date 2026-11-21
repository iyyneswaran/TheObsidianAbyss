# Running a production build

The browser talks to one public origin. The web container serves Vite's static files, forwards `/api/*` to Fastify, and passes private team and WebSocket requests to the authoritative Colyseus process. The deployment runs one game instance. Active rooms live in process memory. PostgreSQL stores accounts, inventory, quest claims and settled rewards. A named volume holds pending settlements across game process restarts.

## Local stack

Use Docker Compose v2. Supply a random 64-character hexadecimal `GUEST_SESSION_SECRET`, a URL-safe random `POSTGRES_PASSWORD`, and `WEB_ORIGIN`. Keep both credentials in the service environment or a private environment file outside source control. The local defaults bind the frontend to loopback port 8080. For local testing set `WEB_ORIGIN=http://127.0.0.1:8080`. Set `WEB_PORT` to change the port. PostgreSQL, the API and the game service are reachable inside the Compose network.

```sh
docker compose -f compose.production.yaml up --build --wait
docker compose -f compose.production.yaml ps
docker compose -f compose.production.yaml down
```

The migration service waits for PostgreSQL, applies pending Prisma migrations, and seeds the catalog using the repository seed command. Both runtime services wait for migration success. The web service waits for the API and game readiness checks. Back up PostgreSQL and the outbox together before upgrades. Stop accepting new rooms and let active teams finish before replacing the authoritative process. Preserve the same signing secret across releases.

## HTTPS edge

Terminate TLS at a reverse proxy on the same host or a managed private network. Set `WEB_ORIGIN` to the exact HTTPS browser origin. Forward the original host and WebSocket upgrades. This Caddy example assumes the frontend is bound to loopback port 8080 on the proxy host. Substitute your own hostname and provide DNS and certificates for that deployment.

```caddyfile
game.example.org {
    reverse_proxy 127.0.0.1:8080
}
```

The production frontend derives its API and WSS URLs from the browser origin. Leave the Vite endpoint overrides unset for the packaged proxy. The gateway permits small request bodies, revalidates stable asset paths, and caches content-hashed JS and CSS. Authentication cookies use HttpOnly, SameSite=Lax and Secure on HTTPS. Team entry and socket admission verify the configured origin and signed identity.

## Health and diagnostics

Fastify serves `/health` for liveness and `/health/database` for database readiness. Colyseus serves internal `/health` and `/ready`. The latter checks PostgreSQL through the configured progression client. The public Fastify probe is `/api/health/database`. Inspect `docker compose -f compose.production.yaml logs api game migrate` locally for startup, room lifecycle, timing and settlement failures. Room identifiers support correlation. Protect logs and volumes according to your hosting environment.

## Isolated verification

After a frozen dependency install and Chromium installation, run `node tools/verify-containers.mjs`. The script creates an isolated Compose project, generates ephemeral secrets, waits for readiness, opens the real frontend in Chromium, casts a spell through the proxy and verifies server-controlled MP. It removes its own containers and test volumes on exit. Use `CONTAINER_TEST_PORT` for an alternate loopback port and `POSTGRES_IMAGE` to test a specific PostgreSQL version. The default database image is PostgreSQL 17 Alpine.
