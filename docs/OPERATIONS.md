# Operating the release candidate

## PostgreSQL backup

Run these commands from PowerShell with the production Compose project selected. Use a private backup directory outside the checkout. The database container supplies the PostgreSQL client at the same major version as the server. Use a unique timestamp for each archive.

```powershell
$stamp = Get-Date -Format yyyyMMdd-HHmmss
$archive = "obsidian-$stamp.dump"
$destination = Join-Path $env:LOCALAPPDATA 'ObsidianBackups'
New-Item -ItemType Directory -Path $destination -Force | Out-Null
docker compose -f compose.production.yaml exec -T postgres psql -U obsidian -d obsidian -c 'SHOW server_version'
docker compose -f compose.production.yaml exec -T postgres pg_dump -U obsidian -d obsidian -Fc --no-owner --no-acl -f "/tmp/$archive"
if ($LASTEXITCODE) { throw 'Backup failed' }
docker compose -f compose.production.yaml cp "postgres:/tmp/$archive" (Join-Path $destination $archive)
if ($LASTEXITCODE) { throw 'Backup copy failed' }
Get-FileHash -Algorithm SHA256 (Join-Path $destination $archive)
docker compose -f compose.production.yaml exec -T postgres rm "/tmp/$archive"
```

Keep the archive, timestamp, PostgreSQL version, checksum, and the most recent restore result together. Restrict archive access to operators and encrypt the destination at rest. Use separate storage for a daily backup and a pre-release backup. Start with seven daily and four weekly copies, then adjust retention to the recovery objectives. Preserve the outbox alongside a coordinated database backup. Restore drills must use synthetic data or approved backups in an isolated environment. [PostgreSQL restore documentation](https://www.postgresql.org/docs/17/app-pgrestore.html).

## Restore verification

The verification command creates a schema in the named test database, generates accounts and rewards through the real browser journey, restores that schema into its own fresh database, and checks saved records and ledger totals. The PostgreSQL role must be able to create and drop the drill database.

```powershell
$env:TEST_DATABASE_URL = (Get-Content .postgres-test/suite.env -Raw).Trim()
$env:PG_BIN = 'C:/Program Files/PostgreSQL/18/bin'
$env:M8_RESTORE = '1'
pnpm verify:progression
Remove-Item Env:M8_RESTORE
```

For an operator restore, create an empty database on the designated recovery server. Confirm the target and archive hash, then run `pg_restore --exit-on-error --single-transaction --no-owner --no-acl --dbname=obsidian_restore_test <archive>`. Supply credentials through the PostgreSQL password file or environment. Perform the application checks on that fresh database before changing service routing.

## Outbox recovery

A database write failure leaves the finalized job on the outbox volume for retry. A restart processes the same immutable run and event IDs. Files with a `.quarantine` suffix remain in place for operator inspection. Preserve a copy, investigate the record with access restricted to operators, then recover any valid payload through the current schema and original ID. A database commit followed by a lost acknowledgement can replay safely. A process crash before the job reaches a finalized file can lose that job. In-memory room progress and sessions end with the game process.

## Application rollback

Preserve the previous API, game, and web image digests ahead of a release. Stop routing new parties to the unhealthy build. Let existing rooms finish when possible, then replace the three application images with the previous compatible digest set using a Compose override. Keep PostgreSQL and outbox volumes attached. Leave the database schema at its current revision when the previous version is compatible. Use a separately restored database when a migration requires a data rollback. Check `/api/health/database`, the game readiness probe, browser authentication, private-room entry, a cast and saved account history after the switch.

Run `node tools/verify-rollback.mjs` to rehearse the image switch against a disposable Compose project. The drill uses the verified Milestone 7 revision as its previous build. Set `ROLLBACK_BASE` to another full, locally available commit SHA for a later release.

## Monitoring

Probe API and game liveness separately from database readiness. Start with an alert after three failed readiness probes. Review game timing logs when cadence falls below 27 ticks/s for two minutes or p95 work exceeds the 33.3 ms tick budget. Alert on repeated outbox retries, any new quarantine, and a sustained increase in reconnect failures. Use service and room identifiers to correlate logs. Keep read access to diagnostics and the outbox restricted to operators.
