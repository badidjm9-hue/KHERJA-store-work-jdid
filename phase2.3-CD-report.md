> **Superseded for verification results.** The "Verification" section below records the original implementer's environment at that time (Node v22.16.0, SQLite 3.49.1, E2E not run). The independent validation on Node v22.23.4 is in `phase2.3-CD-final-validation.md`; where the two differ, that file prevails.

# Kherja Phase 2.3 C+D — implementation report

## Scope and source
- Base: audited Phase 2.3 A+B archive (`kherja-phase2_3-AB-audited.tgz`).
- User decision: defer local-format phone search normalization; no phone-search changes made.
- No Phase 3, production deployment, cutover, SMS, payment, commission, fare, role, session, or authentication behavior changes.

## C — Runtime and configuration
- Strict PORT validation (integer 0..65535) and HOST syntax validation.
- ADMIN_PHONE and ADMIN_PASSWORD must be supplied together; phone is normalized/validated and secure-mode password minimum is 16 characters.
- Validated SQLITE_BUSY_TIMEOUT_MS (0..60000), default 5000.
- Added explicit UPLOAD_DIR, separate from DB_PATH; both resolve to absolute paths at startup.
- Added exact-IP TRUSTED_PROXY_IPS allowlist. X-Forwarded-For is ignored unless the immediate TCP peer is allowlisted; only the final address is accepted if syntactically valid. CIDR trust is intentionally not supported.
- SQLite busy_timeout is configured; database file permissions attempted at 0600, upload directory at 0700, uploaded files already use 0600.

## D — Operations and recovery
- `/api/health` now executes `SELECT 1` against SQLite.
- HTTP close callback waits for the server close event before closing SQLite.
- SIGTERM/SIGINT graceful shutdown added with 10-second force timeout.
- Added `scripts/backup.js`: offline SQLite `VACUUM INTO` snapshot, upload copy, manifest and SHA-256 checksums; source/restore SQLite integrity checks. Service must be stopped during backup.
- Added `scripts/restore.js`: verifies manifest/checksums and restores into a new, non-existing target; refuses overwrite and rejects symlink paths.
- Added systemd and Nginx examples, plus `OPERATIONS.md` with configuration, proxy, TLS, permissions, backup and restore instructions.

## Files changed / added
- Modified: `backend/server.js`, `backend/.env.example`, `package.json`, `architecture-as-built.md`.
- Added: `backend/ops.test.js`, `scripts/backup.js`, `scripts/restore.js`, `deploy/kherja.service.example`, `deploy/nginx-kherja.conf.example`, `OPERATIONS.md`, `phase2.3-CD-report.md`.

## Verification
- Environment: Node v22.16.0, SQLite 3.49.1.
- `npm run test:backend`: 80 total, 79 passed, 0 failed, 1 skipped (requires exact Node v22.23.4).
- `npm run test:e2e`: blocked; all 10 test files fail to load because the `playwright` module is not installed in this environment. No E2E pass is claimed.
- `backend/ops.test.js`: 7 passed, 0 failed, covering configuration validation, trusted proxy behavior, DB health, close ordering, backup/restore integrity and overwrite refusal.
- Node v22.23.4 production startup test remains skipped in this environment. Exact pinned runtime behavior is not re-certified here.

## Operational caveats
- No deployment or cutover was performed.
- Backups are offline by design: stop the service before copying database and uploads.
- Trusted proxy IPs are exact addresses, not CIDRs; configure the proxy to overwrite X-Forwarded-For.
- In-memory rate limiting remains process-local and resets on restart; horizontal scaling requires a shared limiter.
- The app still has no SMS provider, push provider, payment gateway, or implemented commission flow.
- User-approved phone-search issue remains deferred and unchanged.
