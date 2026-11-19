import cors from "@fastify/cors";
import Fastify from "fastify";
import { registerHealth } from "./routes/health.js";

export function createApi(webOrigin: string, logger = false) {
  const app = Fastify({ logger });
  app.register(cors, { origin: [webOrigin], methods: ["GET", "HEAD"] });
  registerHealth(app);
  return app;
}
