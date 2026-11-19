import { fileURLToPath } from "node:url";
import { localPorts } from "../../packages/shared/src/index.js";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

const envDir = fileURLToPath(new URL("../../", import.meta.url));

export default defineConfig(({ mode }) => {
  const { WEB_PORT } = loadEnv(mode, envDir, "WEB_PORT");
  const port = Number(WEB_PORT ?? localPorts.web);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("WEB_PORT must be an integer from 1 to 65535.");
  }

  return {
    envDir,
    plugins: [react(), tailwindcss()],
    server: { host: "127.0.0.1", port, strictPort: true },
  };
});
