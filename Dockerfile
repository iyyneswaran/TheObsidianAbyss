FROM node:24-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
RUN npm install --global pnpm@12.18.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY patches ./patches
COPY apps/web/package.json apps/web/
COPY apps/api/package.json apps/api/
COPY apps/game-server/package.json apps/game-server/
COPY packages/game-assets/package.json packages/game-assets/
COPY packages/game-core/package.json packages/game-core/
COPY packages/shared/package.json packages/shared/
COPY packages/progression/package.json packages/progression/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build
FROM build AS service-bundle
RUN pnpm --filter @obsidian/api deploy --legacy --prod /release/api && pnpm --filter @obsidian/game-server deploy --legacy --prod /release/game
FROM build AS migration-bundle
RUN pnpm --filter @obsidian/progression deploy --legacy /release/migrate && cp -r packages/progression/generated /release/migrate/ && cp -r packages/progression/dist /release/migrate/
FROM node:24-bookworm-slim AS runtime
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production BIND_HOST=0.0.0.0
FROM runtime AS migrate
COPY --from=migration-bundle /release/migrate /app/migrations
USER node
WORKDIR /app/migrations
CMD ["sh","-ec","node node_modules/prisma/build/index.js migrate deploy && node dist/seed.js"]
FROM runtime AS api
COPY --from=service-bundle /release/api /app/apps/api
COPY --from=build /app/packages/progression/generated /tmp/prisma
RUN cp -r /tmp/prisma/. /app/apps/api/node_modules/@obsidian/progression/generated && rm -rf /tmp/prisma
USER node
CMD ["node","apps/api/dist/index.js"]
FROM runtime AS game
COPY --from=service-bundle /release/game /app/apps/game-server
COPY --from=build /app/packages/progression/generated /tmp/prisma
RUN cp -r /tmp/prisma/. /app/apps/game-server/node_modules/@obsidian/progression/generated && rm -rf /tmp/prisma && mkdir /app/outbox && chown node /app/outbox
COPY apps/web/public/assets/dungeon/*.tmj /app/apps/web/public/assets/dungeon/
USER node
CMD ["node","apps/game-server/dist/index.js"]
FROM nginxinc/nginx-unprivileged:stable-alpine AS web
COPY deployment/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
