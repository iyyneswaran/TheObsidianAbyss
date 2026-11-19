import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const [source, id] = process.argv.slice(2);
if (!source || !id || !/^[a-z0-9-]+\/[a-z0-9-]+$/.test(id)) {
  throw new Error(
    "Usage: node tools/export-effects/export.mjs <PixelFX root> <category/effect>",
  );
}

const [category, name] = id.split("/");
const sourceDir = resolve(source);
const assets = fileURLToPath(
  new URL("../../apps/web/public/assets/fx/", import.meta.url),
);
const temporary = mkdtempSync(join(tmpdir(), "obsidian-pixelfx-"));

try {
  const result = spawnSync(
    process.execPath,
    ["tools/render.mjs", id, "--sheet", "--out", temporary],
    { cwd: sourceDir, stdio: "inherit" },
  );

  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`PixelFX export failed for ${id}.`);

  const target = join(assets, category);
  mkdirSync(target, { recursive: true });
  for (const extension of ["png", "json"]) {
    const file = `${name}.${extension}`;
    copyFileSync(join(temporary, category, name, file), join(target, file));
  }

  copyFileSync(join(sourceDir, "LICENSE"), join(assets, "PIXELFX-LICENSE.txt"));
  copyFileSync(join(sourceDir, "NOTICE.md"), join(assets, "PIXELFX-NOTICE.md"));
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
