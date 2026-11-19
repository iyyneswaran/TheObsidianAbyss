import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import type { PrismaClient } from "../generated/client/index.js";
import {
  databaseCode,
  ProgressionError,
  transaction,
  type Transaction,
} from "./db.js";

const cookieKey = "obsidian_account";
const seconds = 14 * 86400;
const keyOptions = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
const dummySalt = Buffer.alloc(16);
const dummyDigest = Buffer.alloc(64);
const digest = (token: string) =>
  createHash("sha256").update(token).digest("hex");
const invalidLogin = () =>
  new ProgressionError(
    "INVALID_CREDENTIALS",
    "Username or password is incorrect.",
    401,
  );

function derive(password: string, salt: Buffer) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, 64, keyOptions, (error, result) =>
      error ? reject(error) : resolve(result),
    );
  });
}

function sessionToken(cookie?: string | null) {
  const token = cookie
    ?.split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(cookieKey + "="))
    ?.slice(cookieKey.length + 1);
  return token && /^[A-Za-z0-9_-]{43}$/.test(token) ? token : undefined;
}

export function accountCookie(token: string, secure: boolean) {
  return `${cookieKey}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${token ? seconds : 0}${secure ? "; Secure" : ""}`;
}

async function replaceSession(
  tx: Transaction,
  accountId: string,
  previous?: string | null,
) {
  const old = sessionToken(previous);
  if (old)
    await tx.playerSession.updateMany({
      where: { tokenHash: digest(old), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + seconds * 1000);
  await tx.playerSession.create({
    data: { tokenHash: digest(token), accountId, expiresAt },
  });
  return token;
}

export async function sessionAccount(db: PrismaClient, cookie?: string | null) {
  const token = sessionToken(cookie);
  if (!token) return null;
  return db.playerSession.findFirst({
    where: {
      tokenHash: digest(token),
      revokedAt: null,
      expiresAt: { gt: new Date() },
      account: { active: true },
    },
    select: {
      account: {
        select: {
          id: true,
          username: true,
          profile: { select: { id: true, displayName: true } },
        },
      },
    },
  });
}

export async function resolveProfile(
  db: PrismaClient,
  cookie?: string | null,
  guestId?: string,
) {
  const session = await sessionAccount(db, cookie);
  if (session?.account.profile)
    return { ...session.account.profile, username: session.account.username };
  if (!guestId) return null;
  const profile = await transaction(db, async (tx) =>
    tx.playerProfile.upsert({
      where: { guestId },
      create: {
        guestId,
        displayName: "Guest " + guestId.slice(0, 4).toUpperCase(),
        wallet: { create: {} },
      },
      update: {},
      select: { id: true, displayName: true },
    }),
  );
  return { ...profile, username: null };
}

export async function registerAccount(
  db: PrismaClient,
  username: string,
  password: string,
  cookie?: string,
  guestId?: string,
) {
  if (await sessionAccount(db, cookie))
    throw new ProgressionError(
      "ALREADY_SIGNED_IN",
      "Sign out before registering another account.",
    );
  const salt = randomBytes(16);
  const hash = await derive(password, salt);
  const passwordHash = `scrypt-32768:${salt.toString("hex")}:${hash.toString("hex")}`;
  try {
    return await transaction(db, async (tx) => {
      if (
        await tx.playerAccount.findUnique({
          where: { username },
          select: { id: true },
        })
      )
        throw new ProgressionError(
          "USERNAME_UNAVAILABLE",
          "That username is unavailable.",
        );
      const account = await tx.playerAccount.create({
        data: { username, passwordHash },
        select: { id: true },
      });
      const guest = guestId
        ? await tx.playerProfile.findUnique({ where: { guestId } })
        : null;
      // Update the same profile so every ledger, run and inventory reference stays intact.
      if (guest && !guest.accountId)
        await tx.playerProfile.update({
          where: { id: guest.id },
          data: { accountId: account.id, guestId: null, displayName: username },
        });
      else
        await tx.playerProfile.create({
          data: {
            accountId: account.id,
            displayName: username,
            wallet: { create: {} },
          },
        });
      return replaceSession(tx, account.id, cookie);
    });
  } catch (error) {
    if (databaseCode(error) === "P2002")
      throw new ProgressionError(
        "USERNAME_UNAVAILABLE",
        "That username is unavailable.",
      );
    throw error;
  }
}

export async function loginAccount(
  db: PrismaClient,
  username: string,
  password: string,
  cookie?: string,
) {
  const account = await db.playerAccount.findUnique({
    where: { username },
    select: { id: true, active: true, passwordHash: true },
  });
  const parts = account?.passwordHash.match(
    /^scrypt-32768:([a-f0-9]{32}):([a-f0-9]{128})$/,
  );
  const actual = await derive(
    password,
    parts ? Buffer.from(parts[1]!, "hex") : dummySalt,
  );
  const expected = parts ? Buffer.from(parts[2]!, "hex") : dummyDigest;
  if (!timingSafeEqual(expected, actual) || !account?.active || !parts)
    throw invalidLogin();
  return transaction(db, (tx) => replaceSession(tx, account.id, cookie));
}

export async function revokeSession(db: PrismaClient, cookie?: string) {
  const token = sessionToken(cookie);
  if (token)
    await db.playerSession.updateMany({
      where: { tokenHash: digest(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
}
