import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  accountCookie,
  claimQuest,
  createDatabase,
  equip,
  getQuestBoard,
  getStore,
  getVault,
  loginAccount,
  profileSummary,
  ProgressionError,
  purchase,
  registerAccount,
  resolveProfile,
  revokeSession,
  walletHistory,
} from "@obsidian/progression";
import { wizardClassSchema } from "@obsidian/shared/coop";
import {
  createGuestSessions,
  createRequestLimit,
  isAllowedWebOrigin,
} from "@obsidian/shared/guest";
import { z } from "zod";
import { progressionContracts } from "./progressionContracts.js";

type Database = ReturnType<typeof createDatabase>;

const username = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{3,24}$/);
const registration = z.strictObject({
  username,
  password: z.string().min(12).max(128),
});
const credentials = z.strictObject({
  username,
  password: z.string().min(1).max(128),
});
const itemId = z.string().regex(/^[a-z][a-z0-9-]{1,47}$/);
const buy = z.strictObject({ itemId, requestKey: z.uuid() });
const vault = z.strictObject({
  wizard: wizardClassSchema,
  skill3: itemId.nullable(),
  ultimate: itemId.nullable(),
});
const claim = z.strictObject({ instanceId: z.string().min(10).max(64) });

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new ProgressionError(
      "INVALID_REQUEST",
      "Check the submitted fields.",
      400,
    );
  return result.data;
}

export function registerProgression(
  app: FastifyInstance,
  db: Database,
  origin: string,
  secret?: string,
) {
  const guests = secret ? createGuestSessions(secret) : undefined;
  const authLimit = createRequestLimit(10, 60_000, 1024);
  const globalAuth = createRequestLimit(160, 60_000, 1);
  const mutationLimit = createRequestLimit(40, 60_000, 4096);
  let hashing = 0;

  const guestId = (request: FastifyRequest) =>
    guests?.verify(request.headers.cookie)?.guestId;
  const secure = new URL(origin).protocol === "https:";
  const profile = (request: FastifyRequest) => {
    const cookie = request.headers.cookie;
    const claimsAccount = /(?:^|;\s*)obsidian_account=/.test(cookie ?? "");
    return resolveProfile(
      db,
      cookie,
      claimsAccount ? undefined : guestId(request),
    );
  };
  const profileId = async (request: FastifyRequest) => {
    const identity = await profile(request);
    if (!identity)
      throw new ProgressionError(
        "NOT_AUTHENTICATED",
        "Sign in or start a guest session.",
        401,
      );
    return identity.id;
  };

  type Action = (
    request: FastifyRequest,
    reply: FastifyReply,
  ) => Promise<unknown>;
  function route(method: "GET" | "POST", url: string, action: Action) {
    app.route({
      method,
      url,
      bodyLimit: 2048,
      async handler(request, reply) {
        reply.header("Cache-Control", "no-store");
        try {
          if (
            method === "POST" &&
            !isAllowedWebOrigin(request.headers.origin, origin)
          )
            throw new ProgressionError(
              "FORBIDDEN_ORIGIN",
              "This origin cannot change progression.",
              403,
            );
          if (method === "POST" && !mutationLimit(request.ip))
            throw new ProgressionError(
              "TOO_MANY_REQUESTS",
              "Try again shortly.",
              429,
            );
          const output = await action(request, reply);
          return reply.sent ? output : progressionContracts[url]!.parse(output);
        } catch (error) {
          if (error instanceof ProgressionError)
            return reply
              .code(error.status)
              .send({ code: error.code, error: error.message });
          request.log.error(
            { errorType: error instanceof Error ? error.name : "unknown" },
            "Progression request failed",
          );
          return reply.code(503).send({
            code: "SERVICE_UNAVAILABLE",
            error: "Progression is temporarily unavailable.",
          });
        }
      },
    });
  }

  const authenticate =
    (action: Action): Action =>
    async (request, reply) => {
      if (!authLimit(request.ip) || !globalAuth("account") || hashing >= 4)
        throw new ProgressionError(
          "TOO_MANY_REQUESTS",
          "Try again shortly.",
          429,
        );
      hashing++;
      try {
        return await action(request, reply);
      } finally {
        hashing--;
      }
    };

  route("GET", "/health/database", async () => {
    await db.$queryRaw`SELECT 1`;
    await db.catalogEntry.count();
    return { status: "ok", service: "obsidian-progression" };
  });
  route("GET", "/auth/session", async (request) => {
    const identity = await profile(request);
    return identity
      ? {
          displayName: identity.displayName,
          permanent: Boolean(identity.username),
        }
      : null;
  });
  route(
    "POST",
    "/auth/register",
    authenticate(async (request, reply) => {
      const form = parse(registration, request.body);
      const token = await registerAccount(
        db,
        form.username,
        form.password,
        request.headers.cookie,
        guestId(request),
      );
      reply.header("Set-Cookie", accountCookie(token, secure));
      reply.code(201);
      return { displayName: form.username, permanent: true };
    }),
  );
  route(
    "POST",
    "/auth/login",
    authenticate(async (request, reply) => {
      const form = parse(credentials, request.body);
      const token = await loginAccount(
        db,
        form.username,
        form.password,
        request.headers.cookie,
      );
      reply.header("Set-Cookie", accountCookie(token, secure));
      return { displayName: form.username, permanent: true };
    }),
  );
  route("POST", "/auth/logout", async (request, reply) => {
    await revokeSession(db, request.headers.cookie);
    reply.header("Set-Cookie", accountCookie("", secure));
    return reply.code(204).send();
  });
  route("GET", "/profile", async (request) =>
    profileSummary(db, await profileId(request)),
  );
  route("GET", "/wallet", async (request) =>
    walletHistory(db, await profileId(request)),
  );
  route("GET", "/store", async (request) =>
    getStore(db, await profileId(request)),
  );
  route("POST", "/store/purchase", async (request) => {
    const identity = await profileId(request);
    const body = parse(buy, request.body);
    return purchase(db, identity, body.itemId, body.requestKey);
  });
  route("GET", "/vault", async (request) =>
    getVault(db, await profileId(request)),
  );
  route("POST", "/vault/equip", async (request) => {
    const identity = await profileId(request);
    const body = parse(vault, request.body);
    return equip(db, identity, body.wizard, {
      skill3: body.skill3,
      ultimate: body.ultimate,
    });
  });
  route("GET", "/quests", async (request) =>
    getQuestBoard(db, await profileId(request)),
  );
  route("POST", "/quests/claim", async (request) => {
    const identity = await profileId(request);
    return claimQuest(db, identity, parse(claim, request.body).instanceId);
  });
}
