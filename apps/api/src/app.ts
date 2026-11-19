import cors from "@fastify/cors";
import Fastify from "fastify";
import { createDatabase } from "@obsidian/progression";
import { allowedWebOrigins } from "@obsidian/shared/guest";
import { registerGuestSession } from "./routes/guestSession.js";
import { registerHealth } from "./routes/health.js";
import { registerProgression } from "./routes/progression.js";
import { progressionContracts } from "./routes/progressionContracts.js";

export function createApi(
  webOrigin: string,
  logger = false,
  guestSecret?: string,
  databaseUrl?: string,
) {
  const app = Fastify({ logger });
  app.register(cors, {
    origin: allowedWebOrigins(webOrigin),
    methods: ["GET", "HEAD", "POST"],
    credentials: true,
  });
  registerHealth(app);
  registerGuestSession(app, webOrigin, guestSecret);
  if (databaseUrl) {
    const db = createDatabase(databaseUrl);
    registerProgression(app, db, webOrigin, guestSecret);
    app.addHook("onClose", () => db.$disconnect());
  } else {
    app.get("/auth/session", async (_request, reply) =>
      reply.header("Cache-Control", "no-store").send(null),
    );
    for (const url of [...Object.keys(progressionContracts), "/auth/logout"]) {
      if (url === "/auth/session") continue;
      app.route({
        method: [
          "/auth/register",
          "/auth/login",
          "/auth/logout",
          "/store/purchase",
          "/vault/equip",
          "/quests/claim",
        ].includes(url)
          ? "POST"
          : "GET",
        url,
        handler: async (_request, reply) =>
          reply.code(503).send({
            code: "SERVICE_UNAVAILABLE",
            error: "Progression database is not configured.",
          }),
      });
    }
  }
  return app;
}
