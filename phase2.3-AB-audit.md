# Kherja Phase 2.3 A+B: independent audit and validation

Source checkpoint: `kherja-phase2_3-AB-reconstructed.tgz`, SHA-256 `843ea00074fa4957eddcdbdbcdb77b96c85a9e1e0980c6ae058dd9ee5d56d413` (verified before extraction; uploaded archive not modified).
Compared against: `kherja-project-phase2_1.tgz` (Phase 2.1), to isolate exactly what A+B changed.

## Verdict

**A+B is sound but was not complete as delivered.** The runtime pin, SQLite canaries and named-parameter change work and are behavior-preserving. One verified defect and several documentation inaccuracies were found and fixed, with regression tests. No business logic, roles, sessions, authentication or fare logic was changed.

## Runtime used

| Item | Value |
|---|---|
| Node.js | v22.23.4 (the pinned version; actually used) |
| SQLite (node:sqlite) | 3.53.4 |
| Playwright Chromium | 153.0.8010.12 |
| Other Node versions available | none (so behavior on any other Node was not tested) |

## What A+B changed (diff against Phase 2.1)

Added: `.nvmrc`, `package.json`, `backend/runtime.js`, `backend/runtime.test.js`, `architecture-as-built.md`. Modified: `backend/server.js` (two hunks: the named-parameter query in `GET /api/admin/rides`, and the startup runtime hook), `architecture.md`. Everything else is byte-identical to Phase 2.1.

## Findings

| # | Finding | Severity | Status |
|---|---|---|---|
| 1 | `npm run test:backend` names `backend/admin-rides.test.js`, which did not exist. Node 22 ignores a missing path when other paths match, so the script exited 0 with "58 pass". The suite gave false confidence. | High (test integrity) | **Fixed**: file written (7 tests); `backend/manifest.test.js` now fails if a script names a missing file |
| 2 | `/api/admin/rides` had only incidental coverage (one name search, one status filter). Phone search, driver-name search, combined filters, wildcard stripping, injection strings, auth, response shape, ordering and the 100-row cap were untested. | Medium | **Fixed**: `backend/admin-rides.test.js` |
| 3 | Runtime enforcement was tested only through the helper functions. Nothing proved `server.js`, run as a process, enforces the pin before opening the database. Two tests in `runtime.test.js` are duplicates of each other. | Medium | **Fixed**: `backend/runtime-startup.test.js` (the existing tests were not changed or removed) |
| 4 | `architecture-as-built.md` said the canaries use "an isolated in-memory database" and list three canaries. The code has four; the WAL canary uses a temporary file in the OS temp dir. | Low (doc) | **Fixed** |
| 5 | `architecture-as-built.md` claimed the named parameters avoid "a Node SQLite binding compatibility issue". **Not reproducible**: the original numbered `?1/?2` query returns identical results on Node 22.23.4 / SQLite 3.53.4. | Low (unverified claim) | **Doc corrected.** The named form is kept as a harmless defensive change; the claimed incompatibility remains unverified because no other Node was available |
| 6 | The documented backend test command (`backend/*.test.js backend/test.js`) did not match `package.json`. | Low (doc) | **Fixed** |
| 7 | `package.json` does not declare Playwright; `npm run test:e2e` fails with `MODULE_NOT_FOUND` unless Playwright is made resolvable. | Low | **Documented** (command in `architecture-as-built.md`); dependency not added (no lockfile or network to vet a version) |
| 8 | Admin ride search by local-format phone (`05…`) returns nothing because phones are stored as `+213…`. International form and digit substrings work. Also present in Phase 2.1. | Low (usability) | **Not fixed** (changes search behavior; needs approval). Documented |
| 9 | `PORT` is parsed with `+env.PORT` and `HOST` is unvalidated. | n/a | **Out of scope**: this is Section C and was deliberately not touched |

Confirmed correct: `.nvmrc` and `package.json` `engines` equal the pin in `runtime.js`; no remaining numbered SQL parameters in `server.js`; no real secrets, `.env` files or database files in the tree (the only credential literal is the documented dev-only admin password, which startup checks refuse outside dev mode).

## Test results (Node v22.23.4)

Backend, `npm run test:backend`: **73 tests, 73 pass, 0 fail, 0 skipped** (exit 0).

| File | Tests | Origin |
|---|---|---|
| backend/test.js | 9 | existing |
| backend/otp-mode.test.js | 4 | existing |
| backend/roles.test.js | 7 | existing |
| backend/security.test.js | 19 | existing |
| backend/session-purpose.test.js | 15 | existing |
| backend/runtime.test.js | 4 | existing (A+B) |
| backend/runtime-startup.test.js | 4 | **new** |
| backend/admin-rides.test.js | 7 | **new** |
| backend/manifest.test.js | 4 | **new** |

E2E, `npm run test:e2e`: **42 tests, 42 pass, 0 fail, 0 skipped** (see the delivery message for the exact command and exit code). No existing test was modified, removed or weakened.

New-test strength (mutation checks, run on scratch copies): breaking the `:st` binding, raising the row cap, reversing the order, removing wildcard stripping, dropping driver-name search, removing the startup runtime check, and moving it after database creation were each detected. The manifest test fails on the original tree with `references "backend/admin-rides.test.js" which matches no file`.

## Remaining limitations

- Behavior on any Node other than 22.23.4 is untested; one startup test skips itself on other versions.
- E2E needs Playwright and Chromium supplied by the environment.
- SMS delivery, payments, commission and Phase 3 are not implemented. Sections C and D (config validation, reverse proxy) are not started.
- This checkpoint does not authorize production deployment.
