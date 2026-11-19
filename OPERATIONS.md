# Kherja operations: Phase 2.3 C+D

## Runtime and environment

- Runtime is pinned to Node `22.23.4` in `.nvmrc`, `package.json` and `backend/runtime.js`.
- Set `NODE_ENV=production`; do not set `KHERJA_DEV` or `KHERJA_DEV_ADMIN`.
- `PORT` must be an integer from 0 to 65535 (`0` is for ephemeral test listeners); default 8787.
- `HOST` must be an IP address, `localhost` or a valid hostname (a name whose last label is all digits, such as `999.999.999.999`, is rejected). It defaults to `0.0.0.0` in secure mode. For a reverse-proxy deployment, bind to `127.0.0.1` and firewall the listener.
- `ADMIN_PHONE` and `ADMIN_PASSWORD` must be supplied together. Secure-mode password minimum is 16 characters. Supply secrets via a root-owned environment file, not source control.
- `DB_PATH` should be an absolute persistent file path. `UPLOAD_DIR` should be a separate persistent directory and must not equal or contain `DB_PATH` (startup is refused otherwise). If omitted, uploads default to a sibling `uploads/` directory.
- `SQLITE_BUSY_TIMEOUT_MS` defaults to 5000 and accepts 0..60000.
- `TRUSTED_PROXY_IPS` is a comma-separated exact-IP allowlist of immediate reverse-proxy peers. It is empty by default. Forwarded headers are ignored unless the socket peer is allowlisted. The proxy must overwrite `X-Forwarded-For` with the actual client IP; do not append untrusted client values. CIDR ranges are deliberately unsupported.

## Storage permissions

The service creates the database parent and upload directory if missing. It attempts database mode `0600` and upload directory mode `0700`; uploaded files are created `0600`. Run the service under a dedicated unprivileged account and set `UMask=0077`. The service manager must grant write access only to the configured persistent data directory.

## Reverse proxy and TLS

Terminate TLS at a maintained reverse proxy. Keep the Node listener private and allow only the proxy to connect. The Nginx example overwrites `X-Forwarded-For`, redirects HTTP to HTTPS, and sets HSTS. Set `TRUSTED_PROXY_IPS` to the exact address from which Node sees the proxy (commonly `127.0.0.1` for a local proxy). Do not trust all proxies or public client-supplied forwarded headers.

## Health and shutdown

`GET /api/health` now executes `SELECT 1` against SQLite; a successful response includes `{"ok":true,"db":"ok"}`. SIGTERM and SIGINT stop accepting new connections, allow active requests to finish, then close SQLite. The process exits with failure if graceful shutdown exceeds 10 seconds. The systemd example gives the process a 15-second stop window.

## Backup (offline)

**Stop the Kherja service before backup.** The database snapshot uses SQLite `VACUUM INTO`, so it includes committed WAL content; the source database integrity is checked first. Upload files are copied with a SHA-256 manifest. Restore verifies the DB and upload checksums and runs SQLite `integrity_check`. Stopping the service prevents a database/upload mismatch while the two stores are copied.

```sh
sudo systemctl stop kherja
DB_PATH=/var/lib/kherja/kherja.db UPLOAD_DIR=/var/lib/kherja/uploads \
  node scripts/backup.js /var/backups/kherja-$(date +%Y%m%d-%H%M%S)
sudo systemctl start kherja
```

The destination must not already exist. Store backups off-host and protect them as sensitive data. Test backups regularly.

Validated path rules (Phase 2.3 final validation): the destination must not exist (a dangling symlink counts as existing), must not be inside the upload directory, and `UPLOAD_DIR` must not equal or contain the database file. The database snapshot is written with mode `0600`. A snapshot taken while the service is running includes committed WAL content (verified), but the uploads copy is not atomic with it, so keep stopping the service for a consistent backup.

## Restore (non-destructive)

Restore only into a **new, empty/nonexistent directory** that is not inside the backup directory. The backup's `uploads/` must be a real directory (symlinks are rejected). The script verifies the manifest and every SHA-256 before writing and refuses to overwrite an existing target.

```sh
node scripts/restore.js /var/backups/kherja-YYYYMMDD-HHMMSS /var/lib/kherja-restore
```

The restored database is `/var/lib/kherja-restore/<original-db-basename>` and uploads are `/var/lib/kherja-restore/uploads`. Review ownership, permissions, and environment paths before starting a separate recovery instance. Do not point production at the restored copy until it has been reviewed.

## Service manager

`deploy/kherja.service.example` is a systemd template. Review paths, user/group, secret file permissions, and Node executable path before installation. It includes restart policy, SIGTERM, a stop timeout, restricted filesystem access, and a private temp directory. It is an example, not an installed service.

## Explicit limitations

- No production deployment or cutover was performed.
- No SMS provider, push provider, payment integration, or commission execution was added.
- The in-memory rate limiter is per process and resets on restart; use a shared store/rate-limit gateway before horizontal scaling.
- Trusted proxy matching is exact-IP only; multi-hop proxy chains require a separately reviewed configuration.
- Backups require service downtime; no online upload/database atomic snapshot is claimed.

## Migrations and rollback (added with the notifications release)
- Migrations are idempotent SQL files applied at every start (`backend/migrations/001_init.sql`, `002_admin.sql`, `003_notifications.sql`). `003` only creates the `notifications` table and its index; it never alters or deletes existing rows.
- **Before upgrading:** stop the service, run `node scripts/backup.js <new-dir>`, then deploy the new code and start it.
- **Rollback:** stop the service, redeploy the previous git commit (tags `checkpoint/pre-autonomous-4795791` and the commit hashes in `docs/RELEASE-GATE.md`). The older code ignores the extra `notifications` table, so the existing database file can be reused as is. If the database itself must be reverted, restore the pre-upgrade backup into a new directory with `node scripts/restore.js` and point `DB_PATH` to it.
- **Admin initialization:** set `ADMIN_PHONE` and `ADMIN_PASSWORD` (>= 16 chars) in the environment file; there is no public admin registration.
- **Dev credentials** (`KHERJA_DEV`, `KHERJA_DEV_ADMIN`, OTP `123456`, admin `admin-dev-pass`) are refused at startup when `NODE_ENV=production` (covered by `backend/runtime-startup.test.js`).
- **Notifications** are in-app rows written by real server events. No push or SMS provider is connected.
