import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { readGuestSecret } from "@obsidian/shared/guest";
import { readConfig } from "./config/env.js";
import { createGameServer } from "./server.js";

const envFile = new URL("../../../.env", import.meta.url);
if (existsSync(envFile)) loadEnvFile(envFile);

const { GAME_PORT, WEB_ORIGIN, PARTY_RECOVERY_SECONDS, PARTY_DROP_LIMIT } =
  readConfig();
const secret = readGuestSecret();
const { server } = createGameServer(
  true,
  secret
    ? {
        secret,
        webOrigin: WEB_ORIGIN,
        recoverySeconds: PARTY_RECOVERY_SECONDS,
        dropLimit: PARTY_DROP_LIMIT,
      }
    : undefined,
);
await server.listen(GAME_PORT, "127.0.0.1");
console.log(`Colyseus listening on ws://127.0.0.1:${GAME_PORT}`);
