import { randomBytes, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// This command creates and removes only its own newly-created schema.
const source = new URL(process.env.TEST_DATABASE_URL ?? "");
if (
  !["postgresql:", "postgres:"].includes(source.protocol) ||
  !/^\/[a-z0-9_]*test[a-z0-9_]*$/i.test(source.pathname)
)
  throw new Error(
    "Select a disposable test-named PostgreSQL database with TEST_DATABASE_URL.",
  );
const schema = "m5_test_" + randomUUID().replaceAll("-", "");
source.searchParams.set("schema", schema);
const web = process.env.WEB_PORT || "5180";
const game = process.env.GAME_PORT || "2574";
const api = process.env.API_PORT || "3012";
const outbox = await mkdtemp(join(tmpdir(), "obsidian-release-outbox-"));
const env = {
  ...process.env,
  DATABASE_URL: source.href,
  TEST_DATABASE_URL: source.href,
  WEB_PORT: web,
  GAME_PORT: game,
  API_PORT: api,
  VITE_API_URL: "http://localhost:" + api,
  VITE_GAME_SERVER_URL: "ws://localhost:" + game,
  WEB_ORIGIN: "http://localhost:" + web,
  GUEST_SESSION_SECRET: randomBytes(32).toString("hex"),
  PROGRESSION_OUTBOX_DIRECTORY: outbox,
  M5_SMOKE_USER: "release_" + randomUUID().slice(0, 8),
  M5_SMOKE_PASSWORD: randomUUID(),
};
async function run(...args) {
  const cli = process.env.npm_execpath;
  if (!cli)
    throw new Error("Invoke this command using pnpm verify:progression.");
  const script = /\.[cm]?js$/i.test(cli);
  await new Promise((resolve, reject) => {
    const child = spawn(
      script ? process.execPath : cli,
      script ? [cli, ...args] : args,
      { env, stdio: "inherit", windowsHide: true },
    );
    child.once("error", reject);
    child.once("exit", (code) =>
      code === 0
        ? resolve()
        : reject(
            new Error("Failed pnpm " + args.join(" ") + " (" + code + ")"),
          ),
    );
  });
}
await run("db:generate");
// Release the database process between commands so Windows can regenerate Prisma's DLL.
async function schemaCommand(sql) {
  const controlUrl = new URL(source.href);
  controlUrl.searchParams.set("schema", "public");
  await new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        "node_modules/prisma/build/index.js",
        "db",
        "execute",
        "--stdin",
        "--schema",
        "prisma/schema.prisma",
      ],
      {
        cwd: "packages/progression",
        env: { ...env, DATABASE_URL: controlUrl.href },
        stdio: ["pipe", "inherit", "inherit"],
        windowsHide: true,
      },
    );
    child.once("error", reject);
    child.once("exit", (code) =>
      code === 0 ? resolve() : reject(new Error("Test schema command failed.")),
    );
    child.stdin.end(sql);
  });
}
let created = false;
try {
  await schemaCommand('CREATE SCHEMA "' + schema + '"');
  created = true;
  if (env.M7_BROWSER_FILTER) {
    await run("db:migrate");
    await run("db:seed");
    await run("exec", "playwright", "test", "--grep", env.M7_BROWSER_FILTER);
  } else if (["before", "after"].includes(env.M7_BENCH)) {
    await run("db:migrate");
    await run("db:seed");
    await run(
      "exec",
      "playwright",
      "test",
      "tests/browser/expedition.spec.ts",
      "--grep",
      "4 browser seats",
    );
  } else {
    for (const task of [
      "db:validate",
      "db:migrate",
      "db:seed",
      "format:check",
      "typecheck",
      "lint",
      "build",
      "test",
    ])
      await run(task);
    await run(
      "exec",
      "playwright",
      "test",
      "--config",
      "playwright.production.config.ts",
    );
    env.M7_PRODUCTION = "1";
    await run(
      "exec",
      "playwright",
      "test",
      "tests/browser/expedition.spec.ts",
      "--grep",
      "4 browser seats",
    );
    env.M7_SILENT = "1";
    await run(
      "exec",
      "playwright",
      "test",
      "tests/browser/expedition.spec.ts",
      "--grep",
      "1 browser seats",
    );
  }
} finally {
  try {
    if (created) await schemaCommand('DROP SCHEMA "' + schema + '" CASCADE');
  } finally {
    await rm(outbox, { recursive: true, force: true });
  }
}
