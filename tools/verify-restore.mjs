import { spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const source = new URL(process.env.TEST_DATABASE_URL ?? "");
const schema = source.searchParams.get("schema") ?? "";
if (
  !["postgresql:", "postgres:"].includes(source.protocol) ||
  !["localhost", "127.0.0.1", "[::1]"].includes(source.hostname) ||
  !/^\/[a-z0-9_]*test[a-z0-9_]*$/i.test(source.pathname) ||
  !/^m5_test_[a-f0-9]{32}$/.test(schema)
)
  throw Error("Run the restore drill within the isolated release verifier.");

const sourceName = source.pathname.slice(1);
const restoreName = "obsidian_restore_test_" + randomUUID().replaceAll("-", "");
const temp = await mkdtemp(join(tmpdir(), "obsidian-backup-"));
const dump = join(temp, "progression.dump");
const env = {
  ...process.env,
  PGHOST: source.hostname.replace(/^\[|\]$/g, ""),
  PGPORT: source.port || "5432",
  PGUSER: decodeURIComponent(source.username),
  PGPASSWORD: decodeURIComponent(source.password),
  PGCONNECT_TIMEOUT: "8",
};

function pg(tool, name, ...args) {
  const binary = process.env.PG_BIN ? join(process.env.PG_BIN, tool) : tool;
  const container = process.env.PG_TOOL_CONTAINER;
  if (container && !/^postgres:\d+-alpine$/.test(container))
    throw Error(
      "PG_TOOL_CONTAINER must select an official PostgreSQL Alpine major image.",
    );
  const command = container
    ? [
        "run",
        "--rm",
        "--network",
        "host",
        "-v",
        temp + ":/backup",
        "-e",
        "PGHOST",
        "-e",
        "PGPORT",
        "-e",
        "PGUSER",
        "-e",
        "PGPASSWORD",
        "-e",
        "PGCONNECT_TIMEOUT",
        container,
        tool,
      ]
    : [];
  const params = args.map((arg) =>
    container && arg === dump ? "/backup/progression.dump" : arg,
  );
  const result = spawnSync(
    container ? "docker" : binary,
    [...command, "--dbname=" + name, ...params],
    {
      encoding: "utf8",
      env,
      timeout: 60_000,
      windowsHide: true,
    },
  );
  if (result.error || result.status !== 0)
    throw Error(`${tool} failed (${result.error?.code ?? result.status}).`);
  return result.stdout.trim();
}

function query(name, sql) {
  return pg("psql", name, "-XAtq", "-v", "ON_ERROR_STOP=1", "-c", sql);
}

const history = [
  "PlayerAccount",
  "Wallet",
  "WalletTransaction",
  "RunResult",
  "RunParticipant",
  "OwnedAbility",
  "EquippedLoadout",
  "StorePurchase",
  "QuestClaim",
  "QuestProgress",
];
function snapshot(name) {
  const parts = history.map((table) => {
    const excluded = table === "PlayerAccount" ? " - 'passwordHash'" : "";
    return `SELECT '${table}' AS name, count(*) AS rows, md5(coalesce(string_agg(entry, '' ORDER BY entry), '')) AS digest FROM
      (SELECT (to_jsonb(t)${excluded})::text AS entry FROM "${schema}"."${table}" t) items`;
  });
  return JSON.parse(
    query(
      name,
      `SELECT jsonb_object_agg(name, jsonb_build_object('rows', rows, 'digest', digest)) FROM (${parts.join(" UNION ALL ")}) counts`,
    ),
  );
}

let created = false;
try {
  const version = query(sourceName, "SHOW server_version");
  const original = snapshot(sourceName);
  for (const required of [
    "PlayerAccount",
    "RunResult",
    "StorePurchase",
    "EquippedLoadout",
    "QuestClaim",
  ]) {
    if (!original[required].rows)
      throw Error(`Missing browser-generated test data in ${required}.`);
  }
  const started = new Date().toISOString();
  pg(
    "pg_dump",
    sourceName,
    "-Fc",
    "--no-owner",
    "--no-acl",
    "--schema=" + schema,
    "-f",
    dump,
  );
  query(sourceName, `CREATE DATABASE "${restoreName}" TEMPLATE template0`);
  created = true;
  pg(
    "pg_restore",
    restoreName,
    "--exit-on-error",
    "--single-transaction",
    "--no-owner",
    "--no-acl",
    dump,
  );
  const restored = snapshot(restoreName);
  if (JSON.stringify(original) !== JSON.stringify(restored))
    throw Error("Restored rows differ from the source database.");
  const walletErrors = query(
    restoreName,
    `SELECT count(*) FROM "${schema}"."Wallet" w LEFT JOIN (
    SELECT "profileId", sum(amount) FILTER (WHERE currency = 'COINS') AS coins,
      sum(amount) FILTER (WHERE currency = 'GEMS') AS gems
    FROM "${schema}"."WalletTransaction" GROUP BY "profileId"
  ) l USING ("profileId") WHERE w.coins <> coalesce(l.coins,0) OR w.gems <> coalesce(l.gems,0)`,
  );
  if (walletErrors !== "0")
    throw Error("Restored ledger does not reconcile with wallet balances.");
  const bytes = await readFile(dump);
  const evidence = {
    status: "PASS",
    started,
    postgres: version,
    archiveBytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    walletErrors: Number(walletErrors),
    rows: Object.fromEntries(
      Object.entries(restored).map(([k, v]) => [k, v.rows]),
    ),
  };
  const folder = "artifacts/milestone-8";
  await mkdir(folder, { recursive: true });
  await writeFile(
    join(folder, "backup-restore.json"),
    JSON.stringify(evidence, null, 2) + "\n",
  );
  console.log(
    "Backup and restore passed, including a complete wallet-ledger reconciliation.",
  );
} finally {
  try {
    if (created) query(sourceName, `DROP DATABASE "${restoreName}"`);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
}
