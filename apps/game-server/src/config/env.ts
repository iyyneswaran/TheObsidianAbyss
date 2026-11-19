import { localPorts } from "@obsidian/shared";
import { z } from "zod";

const configSchema = z.object({
  GAME_PORT: z.coerce.number().int().min(1).max(65535).default(localPorts.game),
  WEB_ORIGIN: z
    .url({ protocol: /^https?$/ })
    .transform((url) => new URL(url).origin)
    .default(`http://127.0.0.1:${localPorts.web}`),
  PARTY_RECOVERY_SECONDS: z.coerce.number().int().min(5).max(900).default(120),
  PARTY_DROP_LIMIT: z.coerce.number().int().min(1).max(30).default(6),
});

export function readConfig(env: NodeJS.ProcessEnv = process.env) {
  return configSchema.parse(env);
}
