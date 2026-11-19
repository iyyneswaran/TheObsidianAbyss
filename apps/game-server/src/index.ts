import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import {
  createDatabase,
  ProgressionOutbox,
  readDatabaseUrl,
} from "@obsidian/progression";
import { fileURLToPath } from "node:url";
import { readGuestSecret } from "@obsidian/shared/guest";
import { readConfig } from "./config/env.js";
import { createGameServer } from "./server.js";

const envFile = new URL("../../../.env", import.meta.url);
if (existsSync(envFile)) loadEnvFile(envFile);

const { GAME_PORT, WEB_ORIGIN, PARTY_RECOVERY_SECONDS, PARTY_DROP_LIMIT } =
  readConfig();
const secret = readGuestSecret();
const databaseUrl = readDatabaseUrl();
const db = databaseUrl ? createDatabase(databaseUrl) : undefined;
const outbox = db
  ? new ProgressionOutbox(
      db,
      process.env.PROGRESSION_OUTBOX_DIRECTORY ??
        fileURLToPath(new URL("../../../.progression-outbox", import.meta.url)),
    )
  : undefined;
const { server } = createGameServer(
  true,
  secret
    ? {
        secret,
        webOrigin: WEB_ORIGIN,
        recoverySeconds: PARTY_RECOVERY_SECONDS,
        dropLimit: PARTY_DROP_LIMIT,
        ...(db && outbox ? { progression: { db, outbox } } : {}),
      }
    : undefined,
);
await server.listen(GAME_PORT, "127.0.0.1");
console.log(`Colyseus listening on ws://127.0.0.1:${GAME_PORT}`);
