# Backend status (Kherja)

Stack here: Node 22 built-ins only (http, node:sqlite, crypto), no installs. Production target stays Postgres/PostGIS per `schema.sql`; `backend/migrations/001_init.sql` is the SQLite flavour for local and tests.
Run (secure mode, the default): `node backend/server.js` then open http://localhost:8787. Run for local development: `KHERJA_DEV=1 KHERJA_DEV_ADMIN=1 node backend/server.js` (loopback only). Tests: `node --test backend/test.js backend/security.test.js`; browser suites: `node --test e2e/api.test.js e2e/onboarding.test.js e2e/landing.test.js`.

## Done
- Phone OTP login (fixed code 123456 only when KHERJA_DEV=1; otherwise a random code that must go through the SMS gateway), http-only cookie sessions, logout, real account deletion.
- Requests, offers, accept with immutable `locked_price` (DB trigger), ride status machine (idempotent), ratings, reports, safety contacts, history.
- Driver feed within 8 km, women-only filter, one bid per driver, bid capped at 150% of rider price, one active ride per driver (partial unique index).
- Driver card shows rating, rides and cancel %.

## Not done (needs user)
- SMS gateway account and key (`SMS_GATEWAY_*` in `.env`). Without it production OTP cannot be sent.
- Realtime push (now polling), real maps/routing, card payments (SATIM/CIB merchant account).
- Stripe is not used: cash-only at launch.

## Security checklist
- [x] secrets only in env vars, `.env*` ignored
- [x] input validated on every route
- [x] authorisation on every read/write, tested with a second user
- [x] rate limits on OTP send/verify and request creation
- [ ] webhooks (none yet)
- [ ] uploads (none yet)
- [x] no user data in URLs
- [x] no dependencies to audit
- [ ] privacy policy (written in /replica-launch)
Known gap: in-memory rate limiter resets on restart and is per-process; move to Redis or the DB before scaling.

## Apps and admin console (added)
| URL | Who | What |
|---|---|---|
| `/` | rider | order ride / delivery, negotiate, track, rate |
| `/driver` | driver | OTP login, profile (car/moto, model, plate), 4 document uploads, online switch, bids, ride control, call links |
| `/admin` | team | password login, overview, drivers + document review (approve / reject with reason), suspend, rides search + detail, reports |

- Required documents: vehicle photo, driving licence, carte grise, insurance. Driver can go online only when all 4 are approved (`requireApproval`, on by default in production).
- Files: JPEG/PNG/WebP checked by magic bytes, max ~2 MB, random file name on disk, served only to owner or admin (nosniff + CSP). Client downsizes to 1280 px before upload.
- Admin: separate cookie `asid` (SameSite=Strict). The dev login `0550000000` / `admin-dev-pass` exists only when both KHERJA_DEV=1 and KHERJA_DEV_ADMIN=1 are set. Otherwise set `ADMIN_PHONE` and `ADMIN_PASSWORD`; the dev password is refused, and a leftover dev password in an old database is disabled at startup.
- Every review/suspend action is written to the `audit` table.
- Build: `node app/build-apps.js` regenerates `driver.html` and `admin.html` from `*.template.html` plus the rider app CSS/sprite.
- Tests: backend 9, e2e 15 (incl. `e2e/onboarding.test.js`). All green.
- Still open: admin 2FA, retention/deletion policy for ID documents (legal), expiry reminders for licence/insurance, S3-style storage instead of local disk.

## Development mode (opt-in only)
- Never inferred from NODE_ENV. `KHERJA_DEV=1` enables: fixed OTP 123456, `/api/dev/role`, relaxed document gating, non-Secure cookies. `KHERJA_DEV_ADMIN=1` additionally enables the dev admin and requires KHERJA_DEV=1.
- Dev mode binds to 127.0.0.1 and refuses any other HOST.
- With NODE_ENV=production, any dev flag makes startup fail with a non-zero exit.
