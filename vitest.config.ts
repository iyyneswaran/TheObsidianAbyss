import { defineConfig } from "vitest/config";

export default defineConfig({
  ssr: { noExternal: [/^@obsidian\//] },
  test: {
    include: ["apps/*/tests/**/*.test.ts", "packages/*/tests/**/*.test.ts"],
  },
});
