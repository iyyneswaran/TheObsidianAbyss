import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const directory = "artifacts/milestone-8";
await mkdir(directory, { recursive: true });
const cli = process.env.npm_execpath;
if (!cli) throw Error("Invoke using pnpm release:gates.");
const script = /\.[cm]?js$/i.test(cli);
const audit = spawnSync(
  script ? process.execPath : cli,
  [
    ...(script ? [cli] : []),
    "audit",
    "--prod",
    "--json",
    "--registry=https://registry.npmjs.org/",
  ],
  {
    encoding: "utf8",
    windowsHide: true,
    timeout: 60000,
  },
);
let vulnerabilities;
try {
  vulnerabilities = JSON.parse(audit.stdout).metadata.vulnerabilities;
} catch {
  console.error("Dependency registry returned no usable audit counts.");
}
const gates = [];
for (const file of [
  "release-validation",
  "backup-restore",
  "network",
  "load",
  "soak",
  "containers",
  "rollback",
  "compatibility-chrome",
  "compatibility-edge",
  "compatibility-firefox",
  "compatibility-webkit",
]) {
  try {
    const record = JSON.parse(
      await readFile(`${directory}/${file}.json`, "utf8"),
    );
    gates.push({
      check: file,
      status: record.status === "PASS" ? "PASS" : "FAIL",
      evidence: `${file}.json`,
    });
  } catch {
    gates.push({
      check: file,
      status: "BLOCKED",
      reason: "No readable test evidence in this run.",
    });
  }
}
try {
  const manifest = JSON.parse(
    await readFile(`${directory}/release-manifest.json`, "utf8"),
  );
  gates.push({
    check: "release-manifest",
    status:
      /^v1\.0\.0-rc\.1$/.test(manifest.version) &&
      /^[a-f0-9]{40}$/.test(manifest.commit) &&
      Object.keys(manifest.artifacts).length > 0
        ? "PASS"
        : "FAIL",
  });
} catch {
  gates.push({
    check: "release-manifest",
    status: "BLOCKED",
    reason: "No readable checksum manifest.",
  });
}
gates.push({
  check: "production-dependency-audit",
  status: vulnerabilities
    ? vulnerabilities.high || vulnerabilities.critical
      ? "FAIL"
      : "PASS"
    : "BLOCKED",
  vulnerabilities,
});
for (const check of [
  "public-tls",
  "production-domain",
  "wan-geographies",
  "production-backup-integration",
])
  gates.push({
    check,
    status: "BLOCKED",
    reason: "No authorized staging or public infrastructure was supplied.",
  });
const candidate = gates.slice(0, -4).every(({ status }) => status === "PASS")
  ? "GO"
  : "NO-GO";
await writeFile(
  `${directory}/release-gates.json`,
  JSON.stringify({ candidate, publicLaunch: "NO-GO", gates }, null, 2) + "\n",
);
console.log(`Release candidate ${candidate}. Public launch NO-GO.`);
if (candidate !== "GO") process.exitCode = 1;
