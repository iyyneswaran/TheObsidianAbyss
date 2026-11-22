import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  stat,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";

const output = "artifacts/milestone-8";
const version = "v1.0.0-rc.1";
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const priors = {
  4: {
    "fire-combat": "fire-combat",
    "healer-healing": "healer-support",
    "boss-phase-1": "boss-phase-1",
    "boss-phase-2": "boss-phase-2",
    "boss-phase-3": "boss-phase-3",
    "spectator-mode": "spectator",
    "victory-screen": "victory",
    "defeat-screen": "defeat",
  },
  5: { "wallet-after-victory": "profile-rewards" },
  6: {
    "molten-passages": "molten-passages",
    "forgotten-crypt": "forgotten-crypt",
    "corrupted-sanctum": "corrupted-sanctum",
  },
  7: {
    "main-menu-polished": "launch-screen",
    "character-selection-polished": "character-selection",
    "party-lobby-polished": "private-lobby",
    "four-player-hud": "four-player-dungeon",
    "minimap-polished": "minimap",
    "store-polished": "store",
    "vault-polished": "vault",
    "daily-quests-polished": "quest-board",
    "settings-audio": "audio-settings",
  },
};

await mkdir(output, { recursive: true });
if (process.argv.includes("--capture")) {
  for (const [milestone, images] of Object.entries(priors)) {
    for (const [source, destination] of Object.entries(images)) {
      await copyFile(
        `artifacts/milestone-${milestone}/${source}.png`,
        join(output, destination + ".png"),
      );
    }
  }
  await copyFile(
    join(output, "compatibility-firefox.png"),
    join(output, "browser-compatibility.png"),
  );
}
const frontend = "apps/web/dist";
const entry = await readFile(join(frontend, "index.html"), "utf8");
const frontendBundle = entry.match(/\/assets\/index-[a-zA-Z0-9_-]+\.js/)?.[0];
if (!frontendBundle)
  throw Error("Production entry bundle is missing. Run pnpm build first.");
const lockfile = "pnpm-lock.yaml";
const migrations = (
  await readdir("packages/progression/prisma/migrations", {
    withFileTypes: true,
  })
)
  .filter((migration) => migration.isDirectory())
  .map(({ name }) => name)
  .sort();
const paths = [lockfile, join(frontend, "index.html")];
for (const file of await readdir(join(frontend, "assets"))) {
  if (/\.(?:js|css)$/.test(file)) paths.push(join(frontend, "assets", file));
}
for (const file of await readdir(output)) {
  if (/\.(?:png|json)$/.test(file) && file !== "release-manifest.json")
    paths.push(join(output, file));
}
const artifacts = {};
for (const path of paths.sort()) {
  const bytes = await readFile(path);
  artifacts[path.replaceAll("\\", "/")] = {
    bytes: bytes.length,
    sha256: sha256(bytes),
  };
}
const manifest = {
  version,
  commit: git("rev-parse", "HEAD"),
  sourceStatus: git("status", "--porcelain", "--", ".", ":!artifacts")
    ? "dirty"
    : "clean",
  generatedAt: new Date().toISOString(),
  frontendBuiltAt: (
    await stat(join(frontend, "index.html"))
  ).mtime.toISOString(),
  node: process.version,
  pnpm:
    process.env.npm_config_user_agent?.match(/pnpm\/([^ ]+)/)?.[1] ??
    JSON.parse(await readFile("package.json", "utf8")).packageManager.split(
      "@",
    )[1],
  migrations,
  frontendBundle,
  artifacts,
};
await writeFile(
  join(output, "release-manifest.json"),
  JSON.stringify(manifest, null, 2) + "\n",
);
console.log(
  `Packaged ${version} with ${paths.length} hashed files (${manifest.sourceStatus} source).`,
);
