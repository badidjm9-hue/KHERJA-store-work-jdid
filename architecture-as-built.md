# Kherja — architecture as built (reconstructed Phase 2.3 A+B)

This document describes the implementation in this checkpoint, not the earlier proposed target architecture.

## Runtime
- Node.js is pinned to `v22.23.4` in `.nvmrc` and `package.json`.
- Production startup rejects a Node version other than the pinned version. Non-production startup logs a warning and continues, allowing local test environments to run.
- `backend/runtime.js` runs four SQLite behavior canaries at process startup (only when `backend/server.js` is run as the entry point, not when `createApp` is imported): named parameter binding, no-row result semantics, trigger execution, and WAL journal mode with cross-connection visibility.
- The first three use an in-memory database. The WAL canary needs a real file, so it creates a throwaway database in the OS temp directory and deletes it afterwards. No canary touches application data or `DB_PATH`.
- The canary result reports the Node and SQLite versions. Order at startup: resolve config, check the Node pin, run canaries, and only then open the application database. `backend/runtime-startup.test.js` proves this order by running `server.js` as a process.

## Backend
- Single Node.js HTTP server in `backend/server.js`.
- SQLite via `node:sqlite`; migrations are in `backend/migrations/`.
- Admin ride listing (`GET /api/admin/rides`) uses named SQLite parameters (`:st`, `:like`) instead of numbered `?1` / `?2` parameters. Audit finding: on the pinned runtime (Node 22.23.4, SQLite 3.53.4) the original numbered query returns identical results, so the claimed binding incompatibility could not be reproduced here; only one Node version was available to test. The named form is behaviorally equivalent and is kept as a defensive change. `backend/admin-rides.test.js` covers it.
- Known admin search limitation (unchanged, not fixed): phones are stored as `+213XXXXXXXXX`, so searching with the local `05…` form matches nothing; international form and digit substrings work. `%`, `_` and `\` are stripped from the search term before matching.
- Passenger, driver, and admin authentication/session-purpose behavior remains as implemented in Phase 2.1.
- Fare negotiation remains rider-proposed fare with driver counteroffers; accepting an offer locks the agreed fare.

## Tests
- Backend: `npm run test:backend`, an explicit list of files in `package.json`. Caution: on Node 22, `node --test` exits 0 when some listed paths exist and others do not, so a missing file is skipped silently. `backend/manifest.test.js` fails if a script names a missing file, if a backend test file is not in the script, or if the Node pin differs between `.nvmrc`, `package.json` and `runtime.js`.
- Browser E2E: `npm run test:e2e` (`e2e/*.test.js`). It needs Playwright and a Chromium binary, which are not bundled and not declared in `package.json`. Make `playwright` resolvable (for example `NODE_PATH=<dir containing node_modules/playwright>`) and set `PLAYWRIGHT_BROWSERS_PATH` if needed.
- Test inventory at the Phase 2.3 C+D final-validation checkpoint: backend 86 tests, E2E 42 tests (10 files), 0 skipped when run on Node 22.23.4; the exact runs are recorded in `phase2.3-CD-final-validation.md`. One backend test skips itself on any other Node version.
- `tools/run-all.js` from Phase 1 does not exist in this project.

## Explicitly not implemented by this checkpoint
- SMS provider integration, real push notifications, maps/routing/geocoding, live rider map tracking, functional SOS/share dispatch, online payments, and production deployment orchestration.
- This checkpoint does not authorize production deployment or legacy-route cutover.

## Phase 2.3 C+D — operational hardening

The server now validates PORT/HOST, paired admin credentials and secure-mode password strength, SQLite busy timeout, and exact trusted-proxy IP entries before opening the database. Forwarded client-IP headers are ignored unless the immediate socket peer is explicitly allowlisted. Database and upload paths can be configured independently; file permissions are tightened where supported. The health endpoint performs a SQLite query. Server close waits for HTTP connections before closing SQLite, and the process handles SIGTERM/SIGINT with a bounded graceful-shutdown window.

Operational scripts in `scripts/` create an offline `VACUUM INTO` database snapshot plus a checksummed upload copy, and restore only into a new destination after verifying all checksums. Backups require the service to be stopped to keep the DB and upload directory consistent. Deployment examples are in `deploy/`; see `OPERATIONS.md` for configuration and recovery procedures. These are deployment artifacts only; no service has been installed and no production cutover was performed.
