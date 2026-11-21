import { defineConfig } from "vitest/config";

export default defineConfig({
  ssr: { noExternal: [/^@obsidian\//] },
  test: {
    // Integration files share a disposable database and several native Prisma pools.
    maxWorkers: 1,
    include: ["apps/*/tests/**/*.test.ts", "packages/*/tests/**/*.test.ts"],
  },
});
