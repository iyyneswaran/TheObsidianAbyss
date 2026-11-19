import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";

const cookieName = "obsidian_guest";
const lifetimeSeconds = 12 * 60 * 60;

export function allowedWebOrigins(webOrigin: string): string[] {
  const configured = new URL(webOrigin).origin;
  const url = new URL(configured);
  if (
    url.protocol === "http:" &&
    (url.hostname === "localhost" || url.hostname === "127.0.0.1")
  ) {
    const port = url.port ? `:${url.port}` : "";
    return [`http://localhost${port}`, `http://127.0.0.1${port}`];
  }
  return [configured];
}

export function isAllowedWebOrigin(
  origin: string | null | undefined,
  webOrigin: string,
): boolean {
  return Boolean(origin && allowedWebOrigins(webOrigin).includes(origin));
}

export function readGuestSecret(
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  const configured = env.GUEST_SESSION_SECRET;
  if (configured !== undefined) {
    if (!/^[a-f0-9]{64}$/i.test(configured))
      throw new Error("GUEST_SESSION_SECRET must be 64 hex characters.");
    return configured;
  }
  if (env.NODE_ENV === "production") return undefined;
  try {
    const key = readFileSync(
      new URL("../../../.guest-key", import.meta.url),
      "utf8",
    ).trim();
    if (!/^[a-f0-9]{64}$/i.test(key))
      throw new Error("The development guest key is invalid.");
    return key;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    return undefined;
  }
}

export function createGuestSessions(secret: string) {
  const key = Buffer.from(secret, "hex");
  if (key.length !== 32)
    throw new Error("Guest sessions require a 32-byte key.");

  const sign = (payload: string) =>
    createHmac("sha256", key).update(payload).digest();
  function verify(cookie: string | null | undefined, now = Date.now()) {
    const token = cookie
      ?.split(";")
      .map((entry) => entry.trim())
      .find((entry) => entry.startsWith(cookieName + "="))
      ?.slice(cookieName.length + 1);
    const parsed = token?.match(
      /^(v1\.([a-f0-9-]{36})\.(\d{10}))\.([A-Za-z0-9_-]{43})$/,
    );
    if (!parsed) return undefined;
    const expiresAt = Number(parsed[3]);
    if (expiresAt <= Math.floor(now / 1000)) return undefined;
    const candidate = Buffer.from(parsed[4]!, "base64url");
    if (
      candidate.toString("base64url") !== parsed[4] ||
      !timingSafeEqual(sign(parsed[1]!), candidate)
    )
      return undefined;
    return { guestId: parsed[2]!, expiresAt };
  }
  return {
    verify,
    issue(
      existing: string | null | undefined,
      secure: boolean,
      now = Date.now(),
    ) {
      const guestId = verify(existing, now)?.guestId ?? randomUUID();
      const expiresAt = Math.floor(now / 1000) + lifetimeSeconds;
      const payload = `v1.${guestId}.${expiresAt}`;
      const value = sign(payload).toString("base64url");
      return `${cookieName}=${payload}.${value}; Path=/; Max-Age=${lifetimeSeconds}; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;
    },
  };
}

/** A bounded fixed-window limiter. Each key has at most one counter. */
export function createRequestLimit(
  capacity: number,
  windowMs: number,
  maxKeys: number,
) {
  const counters = new Map<string, { count: number; expires: number }>();
  return (key: string, now = Date.now()) => {
    const counter = counters.get(key);
    if (counter && counter.expires > now) {
      if (counter.count >= capacity) return false;
      counter.count++;
      return true;
    }
    if (!counter && counters.size >= maxKeys) {
      for (const [id, entry] of counters) {
        if (entry.expires <= now) counters.delete(id);
      }
      if (counters.size >= maxKeys) return false;
    }
    counters.set(key, { count: 1, expires: now + windowMs });
    return true;
  };
}
