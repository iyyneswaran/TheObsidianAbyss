import type { FastifyInstance } from "fastify";
import { API_SERVICE, type HealthResponse } from "@obsidian/shared";

export function registerHealth(app: FastifyInstance) {
  app.get<{ Reply: HealthResponse }>("/health", async () => ({
    status: "ok",
    service: API_SERVICE,
  }));
}
