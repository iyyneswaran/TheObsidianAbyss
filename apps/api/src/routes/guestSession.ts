import type { FastifyInstance } from "fastify";
import {
  createGuestSessions,
  createRequestLimit,
} from "@obsidian/shared/guest";

export function registerGuestSession(
  app: FastifyInstance,
  webOrigin: string,
  secret?: string,
) {
  const guests = secret ? createGuestSessions(secret) : undefined;
  const allowIssue = createRequestLimit(20, 60_000, 2048);
  const secure = new URL(webOrigin).protocol === "https:";

  app.post("/session/guest", { bodyLimit: 1024 }, (request, reply) => {
    reply.header("Cache-Control", "no-store");
    if (request.headers.origin !== webOrigin)
      return reply
        .code(403)
        .send({ error: "This origin cannot start a guest session." });
    if (!guests)
      return reply.code(503).send({ error: "Guest sessions are unavailable." });
    if (!allowIssue(request.ip))
      return reply
        .code(429)
        .send({ error: "Too many guest requests. Try again shortly." });
    return reply
      .header("Set-Cookie", guests.issue(request.headers.cookie, secure))
      .code(204)
      .send();
  });
}
