import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { readConfig } from "./config/env.js";
import { createGameServer } from "./server.js";

const envFile = new URL("../../../.env", import.meta.url);
if (existsSync(envFile)) loadEnvFile(envFile);

const { GAME_PORT } = readConfig();
const { server } = createGameServer();
await server.listen(GAME_PORT, "127.0.0.1");
console.log(`Colyseus test room listening on ws://127.0.0.1:${GAME_PORT}`);
