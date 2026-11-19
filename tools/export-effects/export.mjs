import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const [source, id, option] = process.argv.slice(2);
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
  const image = join(temporary, category, name, name + ".png");
  const metadata = join(temporary, category, name, name + ".json");
  const outputImage = join(target, name + ".png");
  const outputMetadata = join(target, name + ".json");
  if (option === "--compact") {
    const atlas = JSON.parse(readFileSync(metadata, "utf8"));
    const dimensions = (item) =>
      Object.fromEntries(
        Object.entries(item).map(([key, value]) => [key, value / 2]),
      );
    const scaled = spawnSync(
      "ffmpeg",
      [
        "-y",
        "-v",
        "error",
        "-threads",
        "1",
        "-i",
        image,
        "-vf",
        "scale=iw/2:ih/2:flags=neighbor",
        "-threads",
        "1",
        outputImage,
      ],
      { stdio: "inherit" },
    );
    if (scaled.error) throw scaled.error;
    if (scaled.status !== 0) throw new Error(`Could not compact ${id}.`);
    for (const frame of atlas.frames) {
      frame.frame = dimensions(frame.frame);
      frame.spriteSourceSize = dimensions(frame.spriteSourceSize);
      frame.sourceSize = dimensions(frame.sourceSize);
    }
    atlas.meta.size = dimensions(atlas.meta.size);
    atlas.meta.pixelfx.pivot = atlas.meta.pixelfx.pivot.map(
      (value) => value / 2,
    );
    atlas.meta.pixelfx.frameSize = atlas.meta.pixelfx.frameSize.map(
      (value) => value / 2,
    );
    writeFileSync(outputMetadata, JSON.stringify(atlas) + "\n");
  } else {
    copyFileSync(image, outputImage);
    copyFileSync(metadata, outputMetadata);
  }

  copyFileSync(join(sourceDir, "LICENSE"), join(assets, "PIXELFX-LICENSE.txt"));
  copyFileSync(join(sourceDir, "NOTICE.md"), join(assets, "PIXELFX-NOTICE.md"));
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
