import { localPorts } from "@obsidian/shared";
import { z } from "zod";

const configSchema = z.object({
  API_PORT: z.coerce.number().int().min(1).max(65535).default(localPorts.api),
  WEB_ORIGIN: z
    .url({ protocol: /^https?$/, normalize: true })
    .transform((url) => new URL(url).origin)
    .default(`http://127.0.0.1:${localPorts.web}`),
});

export function readConfig(env: NodeJS.ProcessEnv = process.env) {
  return configSchema.parse(env);
}
