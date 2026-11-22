import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as wait } from "node:timers/promises";

const previous =
  process.env.ROLLBACK_BASE ?? "cc78ac08f10e35b64402436fea7795eb0083a1ba";
assert(/^[a-f0-9]{40}$/.test(previous), "Use the full prior commit SHA.");
const project = "obsidian-rollback-" + randomBytes(5).toString("hex");
const port = process.env.ROLLBACK_PORT || "18109";
assert(/^\d{4,5}$/.test(port));
const origin = "http://127.0.0.1:" + port;
async function waitForProxy() {
  const deadline = performance.now() + 45000;
  do {
    const ready = await fetch(origin + "/api/health/database", {
      headers: { connection: "close" },
      signal: AbortSignal.timeout(3000),
    }).catch(() => undefined);
    if (ready?.ok) return;
    await wait(500);
  } while (performance.now() < deadline);
  throw Error("The rollback stack did not become ready through the proxy.");
}
const env = {
  ...process.env,
  WEB_PORT: port,
  WEB_ORIGIN: origin,
  POSTGRES_PASSWORD: randomBytes(24).toString("hex"),
  GUEST_SESSION_SECRET: randomBytes(32).toString("hex"),
};
const temporary = await mkdtemp(join(tmpdir(), "obsidian-rollback-"));
const archive = join(temporary, "previous.tar");
const priorRoot = join(temporary, "previous");
const candidateRoot = resolve(".");
const units = ["api", "game", "web"];
const known = [];
let started = false;

function run(command, args, stdio = "inherit") {
  const result = spawnSync(command, args, {
    env,
    stdio,
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.status !== 0)
    throw Error(
      `${command} ${args[0]} failed (${result.error?.code ?? result.status})`,
    );
  return result.stdout?.trim();
}
function compose(root, ...args) {
  run("docker", [
    "compose",
    "-p",
    project,
    "--project-directory",
    root,
    "-f",
    join(root, "compose.production.yaml"),
    ...args,
  ]);
}
function digest(tag) {
  const value = run(
    "docker",
    ["image", "inspect", "--format", "{{.Id}}", tag],
    "pipe",
  );
  assert(/^sha256:[a-f0-9]{64}$/.test(value));
  return value;
}

try {
  await mkdir(priorRoot);
  run("git", ["archive", "-o", archive, previous]);
  run("tar", ["-xf", archive, "-C", priorRoot]);
  started = true;
  compose(priorRoot, "up", "--build", "--wait", "--wait-timeout", "240");
  const identity = {
    username: "restore_" + randomUUID().slice(0, 8),
    password: randomUUID(),
  };
  const headers = {
    origin,
    "content-type": "application/json",
    connection: "close",
  };
  await waitForProxy();
  const registered = await fetch(origin + "/api/auth/register", {
    method: "POST",
    headers,
    body: JSON.stringify(identity),
  });
  assert.equal(registered.status, 201);
  const profile = async () => {
    await waitForProxy();
    const login = await fetch(origin + "/api/auth/login", {
      method: "POST",
      headers,
      body: JSON.stringify(identity),
    });
    assert.equal(login.status, 200);
    const cookie = login.headers.get("set-cookie")?.split(";")[0];
    assert(cookie);
    const response = await fetch(origin + "/api/profile", {
      headers: { cookie, connection: "close" },
    });
    assert.equal(response.status, 200);
    return response.json();
  };
  const expected = await profile();
  const previousImages = {};
  for (const unit of units) {
    previousImages[unit] = digest(`${project}-${unit}`);
    const tag = `${project}-previous-${unit}`;
    run("docker", ["tag", previousImages[unit], tag]);
    known.push(tag);
  }
  compose(candidateRoot, "up", "--build", "--wait", "--wait-timeout", "240");
  const candidateImages = Object.fromEntries(
    units.map((unit) => [unit, digest(`${project}-${unit}`)]),
  );
  assert.deepEqual(await profile(), expected);
  await fetch(origin + "/.env").then((response) =>
    assert.equal(response.status, 404),
  );
  compose(candidateRoot, "stop", ...units);
  for (const unit of units)
    run("docker", ["tag", previousImages[unit], `${project}-${unit}`]);
  compose(
    priorRoot,
    "up",
    "--no-build",
    "--force-recreate",
    "--no-deps",
    "--wait",
    "--wait-timeout",
    "240",
    ...units,
  );
  assert.deepEqual(await profile(), expected);
  for (const unit of units)
    assert.equal(digest(`${project}-${unit}`), previousImages[unit]);
  const output = "artifacts/milestone-8";
  await mkdir(output, { recursive: true });
  await writeFile(
    join(output, "rollback.json"),
    JSON.stringify(
      {
        status: "PASS",
        previous,
        postgresImage: env.POSTGRES_IMAGE ?? "postgres:17-alpine",
        previousImages,
        candidateImages,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    "Rollback kept the same account and volumes across both application versions.",
  );
} finally {
  try {
    if (started)
      compose(
        candidateRoot,
        "down",
        "--volumes",
        "--remove-orphans",
        "--rmi",
        "local",
      );
    for (const tag of known) {
      const lookup = spawnSync("docker", ["image", "inspect", tag], {
        stdio: "ignore",
        windowsHide: true,
      });
      if (lookup.status === 0) run("docker", ["image", "rm", tag]);
    }
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}
