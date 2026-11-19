import cors from "@fastify/cors";
import Fastify from "fastify";
import { allowedWebOrigins } from "@obsidian/shared/guest";
import { registerGuestSession } from "./routes/guestSession.js";
import { registerHealth } from "./routes/health.js";

export function createApi(
  webOrigin: string,
  logger = false,
  guestSecret?: string,
) {
  const app = Fastify({ logger });
  app.register(cors, {
    origin: allowedWebOrigins(webOrigin),
    methods: ["GET", "HEAD", "POST"],
    credentials: true,
  });
  registerHealth(app);
  registerGuestSession(app, webOrigin, guestSecret);
  return app;
}
