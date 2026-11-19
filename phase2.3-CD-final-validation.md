# Kherja Phase 2.3 C+D — final independent validation (corrected)

Scope: validation only. Phase 3 was not started. No production data was used.
Input checkpoint `kherja-phase2_3-CD.tgz`, SHA-256
`2a56e05d41ce23b85bbbd36c2d7bbc7d59109ad965a6d41dfbb6183fccec375b`, was verified and never modified.

## Correction history (read this first)
- First delivery archive: SHA-256 `966e0dbe00a132a6346c2cd5c235325aae65c6c4059bcc4de4ee59f0dd9026ce`.
  Its embedded copy of this report claimed **E2E 42/42 PASS**. That was **wrong**: the first full E2E run from the extracted
  archive produced **41 pass / 1 fail** (`e2e/delivery.test.js:31`). The claim has been removed; this file replaces it.
- An intermediate archive with SHA-256 `de717a03e3132d824d749b54337f247650bc82bbe7ddd0ff818e99a9c000c7cc` was found in the outputs folder
  before this correction. It was not produced or verified in the audited flow and is **superseded**; do not use it.
- The audited `966e0dbe…` archive was reproduced byte-for-byte from its verified extraction and used as the baseline for this fix.

## E2E failure: root cause
- Verdict: **test synchronization race; the application is correct.**
- Mechanism (verified in `app/index.html`): after the rider accepts an offer, the UI shows the confirmation text immediately.
  The contact phone is fetched afterwards with `GET /api/rides/:id`, and only then is `#d-phone` given its `href`
  (phones are deliberately withheld until accept). The tests read the attribute right after the text wait.
- Deterministic reproduction on the audited baseline: delaying `GET /api/rides/:id` by 1.5 s in a scratch copy makes
  both `delivery.test.js:31` and `shell-legacy-delivery.test.js:33` fail with the identical error
  (`The "string" argument must be of type string. Received type object (null)`).
- Application check: with the same delay and the fix applied, both tests pass and the link is the exact expected `tel:+213666000022`.
- Fix (tests only, assertion not weakened): wait until `#d-phone` has an `href` (8 s timeout), then run the unchanged `assert.match(..., /^tel:\+213666000022$/)`.
  Files: `e2e/delivery.test.js`, `e2e/shell-legacy-delivery.test.js`. No application code changed.
- Observation, not changed: `app/index.html` swallows a failed `GET /api/rides/:id` (`.catch(()=>{})`), so a network failure leaves the call link hidden with no message.

## Environment
- Node.js `v22.23.4` (pin unchanged), SQLite `3.53.4`, Playwright `1.63.0`, Chromium `153.0.8010.12` (pre-installed; nothing installed by me).
- Playwright resolved via `NODE_PATH=/home/claude/.npm-global/lib/node_modules` (not a project dependency).

## Results recorded before packaging (working tree identical to the archive except this file)
| Item | Result |
|---|---|
| Backend `npm run test:backend` | 86 tests, 86 pass, 0 fail, 0 skipped |
| Ops validation `node validation/ops-validate.js <root>` | 92 checks, 92 pass, 0 fail |
| E2E, final extracted-archive runs | **Not recorded in this file.** The exact counts are in the delivery message, because embedding them would change the archive hash. Treat any E2E figure inside the archive as unverified. |

## Verified defects fixed earlier (unchanged, still covered by tests 8-13 of `backend/ops.test.js`)
1. Backup snapshot mode 0644 -> 0600.
2. Restore accepted a symlinked `uploads/`.
3. Backup accepted a destination inside the upload dir.
4. `UPLOAD_DIR` equal to or containing the DB was accepted.
5. `HOST=999.999.999.999` passed config validation.
6. Restore `.`/`..` DB basename, dangling-symlink targets and target-inside-backup are now rejected explicitly.

## Remaining limitations
- Backup is documented as offline; a live snapshot of the DB is consistent but the uploads copy is not atomic with it.
- E2E needs Playwright and Chromium outside the project; `package.json` was not changed.
- `node:sqlite` prints Node's ExperimentalWarning on every start.
- Health failure returns HTTP 500, not 503.
- A second SIGTERM/SIGINT falls back to the default signal behavior.
- In-memory rate limiter; exact-IP trusted-proxy matching only.
- TLS/Nginx/systemd examples reviewed as text only.

## Files changed versus the input checkpoint
- Modified: `backend/server.js` (config validation only), `backend/ops.test.js`, `scripts/backup.js`, `scripts/restore.js`, `OPERATIONS.md`, `e2e/delivery.test.js`, `e2e/shell-legacy-delivery.test.js`, `architecture-as-built.md` (test inventory), `phase2.3-CD-report.md` (superseded banner).
- Added: `validation/` (harness, regenerated result and log), `phase2.3-CD-final-validation.md`.
- Not touched: phone search, fare negotiation, roles, sessions, authentication, `.nvmrc`, `package.json`, `backend/runtime.js`, `app/`.
