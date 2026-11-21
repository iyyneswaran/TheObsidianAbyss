import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { readGuestSecret } from "@obsidian/shared/guest";
import { readDatabaseUrl } from "@obsidian/progression";
import { createApi } from "./app.js";
import { readConfig } from "./config/env.js";

const envFile = new URL("../../../.env", import.meta.url);
if (existsSync(envFile)) loadEnvFile(envFile);

const config = readConfig();
if (
  process.env.NODE_ENV === "production" &&
  (!readGuestSecret() || !readDatabaseUrl() || !process.env.WEB_ORIGIN)
)
  throw Error("Production requires database, signing key and web origin.");
const app = createApi(
  config.WEB_ORIGIN,
  true,
  readGuestSecret(),
  readDatabaseUrl(),
);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => void app.close());
}

await app.listen({
  host: process.env.BIND_HOST || "127.0.0.1",
  port: config.API_PORT,
});
