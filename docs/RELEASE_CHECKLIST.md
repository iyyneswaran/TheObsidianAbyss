# Release checklist

Run the release checks on a clean checkout and disposable PostgreSQL. Use `pnpm release:gates` after collecting evidence for the current candidate. The generated decision distinguishes missing evidence from failed checks.

| Check                                                                                                   | Evidence                                            |
| ------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Frozen lockfile, source checks, application build and existing regressions pass                         | Release workflow and `release-validation.json`      |
| All main party sizes complete the authoritative expedition                                              | Playwright journey checks                           |
| Account, session, rewards, purchases and claims retain server authority                                 | PostgreSQL, Fastify and Colyseus integration checks |
| Wallet, store, loadout, quests and settled runs survive database recovery                               | `backup-restore.json` and database-only drill       |
| Chrome, Edge, Firefox and Playwright WebKit complete critical browser flows                             | Browser compatibility results and PNGs              |
| Simulated WebSocket impairment preserves authoritative movement and seat recovery                       | `network.json`                                      |
| Bounded multi-room workloads dispose cleanly                                                            | `load.json`                                         |
| The local production stack migrates and serves live Phaser and WebSocket traffic                        | `containers.json` and container workflow            |
| Release source and artifact hashes identify the candidate                                               | `release-manifest.json` and verified GitHub commit  |
| Public DNS, certificates, WSS, live backups and rollback are verified against an authorized environment | Staging or production operator evidence             |

The operator must confirm the public infrastructure checks before any launch. Record availability and exceptions in the [milestone report](milestone-8.md).
