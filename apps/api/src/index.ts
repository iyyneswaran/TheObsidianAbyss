import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { readGuestSecret } from "@obsidian/shared/guest";
import { createApi } from "./app.js";
import { readConfig } from "./config/env.js";

const envFile = new URL("../../../.env", import.meta.url);
if (existsSync(envFile)) loadEnvFile(envFile);

const config = readConfig();
const app = createApi(config.WEB_ORIGIN, true, readGuestSecret());

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => void app.close());
}

await app.listen({ host: "127.0.0.1", port: config.API_PORT });
