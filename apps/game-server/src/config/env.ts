import { localPorts } from "@obsidian/shared";
import { z } from "zod";

const configSchema = z.object({
  GAME_PORT: z.coerce.number().int().min(1).max(65535).default(localPorts.game),
});

export function readConfig(env: NodeJS.ProcessEnv = process.env) {
  return configSchema.parse(env);
}
