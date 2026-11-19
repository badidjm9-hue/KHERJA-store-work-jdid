# Deploying KHERJA-STAGING on Render (staging only)

**Status: NOT DEPLOYED.** The workspace that prepared this repository has no network route to gitlab.com or render.com and no Render/GitLab credentials, so no service was created and nothing was pushed from there. `render.yaml` is a ready blueprint; create the service from it yourself. Never touch the existing n8n service.

## Facts verified locally (production mode, test-only credentials, temp database)
- Start: `node backend/server.js`; build: `node app/build-shell.js && node app/build-apps.js` (the built pages are committed, so build is a safety net).
- Port: reads `PORT` (Render injects it); default 8787. Health check: `GET /api/health` -> 200 `{"ok":true,"db":"ok"}`.
- Node must be exactly 22.23.4 (`NODE_VERSION` env on Render): the server refuses other versions.
- `/` `/index.html` `/driver` answer 302 -> `/app` `/app/driver`; `/app`, `/app/driver`, `/admin`, fonts answer 200.
- Admin login with correct test password -> 200, wrong -> 401. Secrets do not appear in the log.

## Required environment variables (test values only)
| Variable | Value |
|---|---|
| NODE_ENV | production (never set KHERJA_DEV / KHERJA_DEV_ADMIN: startup is refused) |
| ADMIN_PHONE, ADMIN_PASSWORD | test admin; password >= 16 chars; set in the Render dashboard, never in git |
| DB_PATH, UPLOAD_DIR | `/var/data/kherja.db`, `/var/data/uploads` on a persistent disk |
| TRUSTED_PROXY_IPS | Render's proxy IPs, if known (see caveat) |

## Persistent storage
SQLite and uploads need a persistent disk (1 GB, mounted at `/var/data`). Render disks require a paid instance type; free instances lose data on every deploy.

## Known staging limits (decisions needed from the owner)
1. **Passenger/driver login is impossible in staging.** In production mode `/api/auth/otp` answers `503 sms_unavailable` because no SMS provider is wired (verified). Only the admin password login works. Options: (a) wire a provider that has a test mode, (b) add a dedicated, explicitly approved test-OTP mechanism. I did not add (b): a fixed code on a public URL is an authentication bypass and needs your explicit decision.
2. Without `TRUSTED_PROXY_IPS`, every request appears to come from Render's proxy, so IP-based rate limits (e.g. 20 OTP requests / 10 min / IP) are shared by all visitors. The proxy IPs must be supplied; matching is exact-IP only.
3. No payments, SMS, push, maps or GPS are connected. See `PRODUCTION-INTEGRATIONS.md` for the provider choices and owner inputs required before activation.

## Steps
1. Push this repository to GitLab (`git remote add origin https://gitlab.com/badi212-group/khardja.git`, push `main`).
2. Render dashboard -> New -> Blueprint -> select the repo -> review `render.yaml` -> fill the `sync: false` variables.
3. After deploy: check `/api/health`, `/app`, `/admin` login.
Rollback: Render "Rollback" to the previous deploy, or redeploy the previous commit; see `OPERATIONS.md` for database backup/restore.
