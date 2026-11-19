# Kherja Phase 2.1 — Security remediation report

Scope: only the approved items F-1 (HIGH), F-3 (MEDIUM), F-4 (MEDIUM), F-2 (design only).
**No cutover. No Phase 3.** `/`, `/driver`, `/admin` and their files were not touched.
Base: `kherja-project-phase2.tgz` (SHA-256 `4c71c75f5f147b7d28ede8a9540a42d285a350e73682e8712bc5f8977f4a62fa`), left unchanged; all work was done in a fresh extracted copy.

## 1. Result summary

| Item | Status | Evidence |
|---|---|---|
| F-1 Admin/OTP session separation | **DONE** | Session `kind` (`user`/`admin`); `auth()` accepts only `user`, `authAdmin()` only `admin`. The Phase 2 exploit (admin OTP token as `asid` → 200) now returns **401** in dev and secure mode. 15 regression tests. |
| F-3 Secure OTP messaging | **DONE** | Secure mode without an SMS sender → `503 sms_unavailable`, no OTP stored, no "test code" in the UI; localized AR/FR message. Dev mode keeps `123456`. 4 backend + 4 browser tests. |
| F-4 Passenger logout | **DONE** | Visible Logout chip on the passenger map; existing `POST /api/auth/logout`; back to the shared gate; AR RTL and FR LTR. 4 browser tests. |
| F-2 Commission | **DESIGN ONLY** | `commission-design.md`. Nothing implemented. |
| Not changed | — | `/`, `/driver`, `/admin`, `locked_price` model/trigger, route table, architecture. |

## 2. Test results (exact)

Method: every test file run separately with `node --test <file>` in a copy of the final tree, Node v22.23.4, Playwright Chromium. (`tools/run-all.js` still does not exist in the project; I did not create one.)

| File | tests | pass | fail | Origin |
|---|---|---|---|---|
| backend/test.js | 9 | 9 | 0 | existing |
| backend/security.test.js | 19 | 19 | 0 | existing (**2 assertions amended**, see 2.1) |
| backend/roles.test.js | 7 | 7 | 0 | existing |
| e2e/api.test.js | 1 | 1 | 0 | existing |
| e2e/onboarding.test.js | 2 | 2 | 0 | existing |
| e2e/landing.test.js | 1 | 1 | 0 | existing |
| e2e/delivery.test.js | 2 | 2 | 0 | existing |
| e2e/prototype.test.js | 9 | 9 | 0 | existing |
| e2e/shell.test.js | 16 | 16 | 0 | existing |
| e2e/shell-legacy-api.test.js | 1 | 1 | 0 | existing |
| e2e/shell-legacy-delivery.test.js | 1 | 1 | 0 | existing |
| e2e/shell-legacy-onboarding.test.js | 1 | 1 | 0 | existing |
| **Existing subtotal** | **69** | **69** | **0** | |
| backend/session-purpose.test.js | 15 | 15 | 0 | **new** (F-1; runs in dev mode and secure mode, plus migration) |
| backend/otp-mode.test.js | 4 | 4 | 0 | **new** (F-3 backend) |
| e2e/shell-phase21.test.js | 8 | 8 | 0 | **new** (F-3 UI, F-4) |
| **New subtotal** | **27** | **27** | **0** | |
| **TOTAL** | **96** | **96** | **0** | skipped 0 |

### 2.1 Existing tests that were modified (disclosure)
Two existing assertions in `backend/security.test.js` expected `POST /api/auth/otp` → `200` in secure mode. That behaviour *is* the defect F-3 asks to remove (it pretended a code was sent). I changed only those two expected status codes `200 → 503` (lines 19 and 99, each annotated "Phase 2.1"). Their actual purpose — the fixed code `123456` is rejected in secure mode (`verify` → 400) — is still asserted, unchanged. No other existing test file was edited.

### 2.2 Tests were written alongside the fixes and prove the bug
I ran the new `session-purpose.test.js` against the **unfixed Phase 2 code**: 13 of 15 failed, including `[dev mode] 1. admin-account OTP token used as asid → 401` (the actual exploit). Tests 2 and 3 (rider/driver token as `asid`) already passed on Phase 2 and remain as regression guards.

### 2.3 Secure mode and development mode tested separately
- `session-purpose.test.js` loops the whole F-1 matrix twice: `[dev mode]` (`dev:true, devAdmin:true`, OTP `123456`) and `[secure mode]` (`dev:false`, strong admin password, random OTP captured through an injected sender, `Secure` cookie flag asserted).
- `otp-mode.test.js` has separate secure (no sender / sender OK / sender throws) and dev cases.
- `shell-phase21.test.js` drives the real UI against a secure-mode server (no SMS; with injected SMS) and a dev-mode server.
- Manual re-probe (my scripts, outside the project) of the audit's reproduction, secure mode, `dev:false`:
  `OTP token as asid → /api/admin/stats 401, /api/admin/drivers 401, /api/admin/me 401`; real admin password login → `/api/admin/stats 200`; admin token used as `sid` on `/api/me` → `401`.
  Dev mode: `admin OTP token replayed as asid → /api/admin/me 401, /api/admin/stats 401`.

## 3. F-1 — Admin vs OTP sessions

### 3.1 Design
`sessions.kind` ∈ {`user`, `admin`}.
- `POST /api/auth/verify` (OTP) → `kind='user'` (30 days, `sid`, unchanged).
- `POST /api/admin/login` (password verified by `checkPw`, unchanged) → `kind='admin'` (12 h, `asid`, unchanged).
- `auth()` (rider/driver/common routes) requires `kind='user'`. `authAdmin()` requires `kind='admin'` **and** `users.role='admin'`.
- Therefore: any OTP token (rider, driver or admin-phone) placed in `asid` → 401; an admin session placed in `sid` → 401 (admin sessions are **admin-only by design**, documented and tested, test 5).
- Revocation is purpose-scoped: `/api/auth/logout` deletes only that user's `user` sessions; `/api/admin/logout` deletes only the presented `admin` session. Logging out of the mobile app does not kill an admin console session of the same account and vice versa (test 6b).
- Not weakened: password hashing/verification, rate limits (`adm:`/`admph:`), `Secure`/`HttpOnly`/`SameSite=Strict`, dev-admin refusal in secure mode, startup guards — all untouched.

### 3.2 Migration (exact)
In `createApp()`, in the existing idempotent column-add loop (`server.js`, same mechanism as `drivers.vehicle_type`):

```sql
ALTER TABLE sessions ADD COLUMN kind text NOT NULL DEFAULT 'user' CHECK(kind IN('user','admin'));
```
- Runs only if the column is missing (`pragma table_info`), so it is **idempotent** (test 7 opens the same database twice).
- Existing rows become `kind='user'`. Consequences, by design: existing rider/driver sessions keep working; **any admin session issued before the upgrade stops working and the admin must log in again** (fail-closed).
- Both `INSERT INTO sessions` statements changed from positional (`values(?,?,?)`) to named columns, otherwise they would fail on a 4-column table.
- No new `.sql` file was added; the migration lives in code like the other column adds. `001_init.sql`/`002_admin.sql` are unchanged (SHA-256 identical).
- Test 7 builds a genuine Phase 2-shape database (sessions without `kind`, with a legacy admin and rider token), opens it with the new code and checks: column added with `NOT NULL`/default `'user'`; users and sessions preserved; legacy rider token still works as `sid`; legacy admin token as `asid` → 401; every admin endpoint → 401 without cookie and with legacy tokens; admin password login then works.
- **Rollback note (verified):** Phase 2 code run on a migrated database fails at login (`table sessions has 4 columns but 3 values were supplied` → 500). Rollback therefore requires `ALTER TABLE sessions DROP COLUMN kind;` first (verified to work on this SQLite; Phase 2 code then logs in normally).

### 3.3 Requested regression tests → test names (all in `backend/session-purpose.test.js`, each in dev and secure mode)
1. Admin OTP token as `asid` → 401 — "1. admin-account OTP token used as asid → 401 on every admin endpoint" (11 admin endpoints).
2. Rider OTP token as `asid` → 401 — "2. …".
3. Driver OTP token as `asid` → 401 — "3. …".
4. Correct admin password → valid admin session — "4. …" (also: wrong password issues nothing; cookie flags; DB row `kind='admin'`; OTP row `kind='user'`).
5. Admin session as ordinary session → rejected — "5. …" (`/api/me`, `/api/rides`, `/api/rides/active`, `/api/driver/me`, `/api/safety/contacts`, `/api/auth/logout` all 401).
6. Expired/revoked admin session → rejected — "6. …" (12 h expiry via injected clock; revoked by admin logout; revoked by row deletion) and "6b." (purpose-scoped logout).
7. Admin endpoints protected after migration — "7. migration: …" (above).

## 4. F-3 — Secure-mode OTP messaging

Behaviour (`POST /api/auth/otp`):
| Mode | Result |
|---|---|
| Secure, no `sendSms` | `503 {"error":"sms_unavailable"}`. No OTP row created, rate-limit counters not consumed, nothing claims a message was sent. |
| Secure, `sendSms(phone, code)` supplied by the host | OTP created, code passed **only** to the hook, response `{ok:true}`. Hook throws → OTP row removed, `502 {"error":"sms_failed"}` (error text never contains the code). |
| Dev (`KHERJA_DEV=1`) | Unchanged: code `123456`, response `{ok:true, dev:true}`; the hook is never called. |

- The shell hides the "Test code: 123456" line by default (`#demo-hint[hidden]`) and shows it **only** when the server answered `dev:true`. Secure-mode UI never contains `123456` (tested: whole-page text).
- Localized messages (AR/FR, tested in RTL and LTR): AR "خدمة رسائل التحقق غير مفعّلة على هذا الخادم بعد…", FR "L'envoi des codes de vérification n'est pas encore configuré sur ce serveur…"; plus `sms_failed` strings. Raw error codes are never shown. The user stays on the phone screen.
- `sendSms` is an **injection point only**. No SMS provider, URL or credential was added or invented. `SMS_GATEWAY_*` variables in `.env.example` remain unused. Secure-mode startup now prints a warning that no SMS sender is wired in.
- The hook is deliberately **synchronous** (must throw on failure) to avoid changing the request pipeline. A real provider is asynchronous, so integrating one later will need a small, separately approved change to await it.

## 5. F-4 — Passenger logout

- `passenger.view.html`: new `#p-logout` chip in the existing map top bar; `passenger.view.js`: handler; `shell.extra.css`: 2 rules. Strings AR "تسجيل الخروج" / FR "Se déconnecter" (failure toasts too).
- Flow: `POST /api/auth/logout` (existing endpoint) → on success stop polling/timers, `location.reload()` → `GET /api/me` = 401 → shared gate. Reload drops all in-memory state; server session and `sid` cookie are cleared; no client-side session keys exist (asserted: only the pre-existing theme key may remain).
- Failure handling: network/server error → toast, **stays signed in** (no reload into the gate, polling untouched); an already-expired session (401) → proceeds to the gate.
- Logout is triggered **only** by this button: the test "no accidental logout" forces `/api/me` abort/403/500, wrong-role navigation (rider on `/app/driver`, driver on `/app`) and reloads, and asserts **0** logout requests and a still-valid session.
- Viewport checks in the tests: visible without scrolling, ≥44×44 px (measured), inside the viewport, no horizontal overflow, at 390 px (AR/RTL) and 360 px (FR/LTR).

## 6. Regression: legacy and routes unchanged
`diff -rq` Phase 2 vs 2.1 — the only differences:

| Path | Change |
|---|---|
| `backend/server.js` | F-1 and F-3 (diff in section 7) |
| `backend/security.test.js` | 2 expected codes 200→503 |
| `app/shell/shell.template.html`, `passenger.view.html`, `passenger.view.js`, `shell.extra.css` | F-3, F-4 |
| `app/kherja.html` | regenerated by `node app/build-shell.js` from the shell sources (96,332 chars) |
| **added:** `backend/session-purpose.test.js`, `backend/otp-mode.test.js`, `e2e/shell-phase21.test.js`, `commission-design.md`, `phase2.1-security-report.md` | new |

Byte-identical to Phase 2 (SHA-256 compared): `app/index.html`, `app/driver.html`, `app/admin.html`, `driver.template.html`, `admin.template.html`, `build-apps.js`, `build-shell.js`, `kherja-prototype.html`, both migrations, `schema.sql`, `design/tokens.css`, `launch/landing.html`. The `PAGES` route table line is textually identical (only its line number moved). Served pages (own probe): `/` = 60,607 B `2ede9aec1d9e…`, `/driver` = 55,177 B `af61ad8c3e02…`, `/admin` = 23,560 B `4afe84fd3ea9…` — the same hashes as in the Phase 2 audit; `/app` and `/app/driver` still serve the same file with headers identical to `/` and `/driver`. `locked_price` trigger and fare flow unchanged (`roles.test.js` #7, `shell.test.js` #13 pass; probe: `UPDATE rides SET locked_price` still aborts).

Note on the audit's statement "Phase 1 baseline missing": Phase 2.1 is verified against the Phase 2 archive only, as instructed. The earlier unverified Phase 1 comparison remains open.

## 7. Exact `server.js` changes
1. `createApp` signature: new optional `sendSms = null`.
2. Migration list: added `['sessions','kind', "text not null default 'user' check(kind in('user','admin'))"]`.
3. `auth()`: query adds `and kind='user'`. `authAdmin()`: query adds `and kind='admin'`.
4. `POST /api/auth/verify`: named-column insert with `'user'`.
5. `POST /api/admin/login`: named-column insert with `'admin'`.
6. `POST /api/auth/logout`: `delete … where user_id=? and kind='user'`. `POST /api/admin/logout`: `delete … and kind='admin'`.
7. `POST /api/auth/otp`: 503 `sms_unavailable` when secure and no sender; call the sender after storing the hash; 502 on sender failure; return `{ok:true,dev:true}` in dev, `{ok:true}` otherwise.
8. Process start: secure-mode `console.warn` about the missing SMS sender.
No other lines changed (full unified diff delivered as `phase2.1-changes.diff`).

## 8. Remaining limitations / open items
1. **Secure mode still cannot log anyone in** (no approved SMS provider). This is now stated honestly (503 + message + startup warning) instead of silently failing; mobile users stay locked out of a secure-mode deployment until a provider is approved and integrated. Dev mode is unaffected.
2. **Legacy `/` and `/driver` pages were not changed** (as required). They still print their own "test code 123456" text and were not tested for the new 503. Only the `/app` shell has the corrected messaging, which is a reason to cut over only after approval of the whole set.
3. Admin-phone accounts can still obtain an ordinary OTP session (needed by the existing "admin account → notice" shell behaviour). It is now powerless against admin endpoints, but it can read that user's own non-admin data (`/api/me`, `/api/rides`) as any account can.
4. Admin sessions issued before this upgrade are invalidated (re-login), and a rollback needs the `DROP COLUMN` step in 3.2.
5. Passenger logout: shown on the map screen only (not on the name-entry screen for brand-new riders); no confirmation prompt, so tapping it mid-ride ends the local session (the app already does not restore an in-progress ride after reload); icon is an "×" glyph from the existing sprite. Mid-ride server behaviour is unchanged.
6. Browser checks are Playwright/Chromium with emulated viewports (390×844 AR, 360×740 FR, plus the existing suites' 360/390): **not** real devices or real touch. Google Fonts are unavailable in the sandbox, so final typography was not seen. No axe/screen-reader run.
7. Still open from the audit and out of this scope: F-5…F-12 (e.g. driver-docs button clipping at 360 px Arabic, permissive CSP, OTP boxes 38 px at 320 px, Phase 1 comparison, `tools/run-all.js`, undeclared Playwright dependency, commission implementation).
8. `sendSms` hook is synchronous (4, above); `README`/`.env.example` unchanged.

*Phase 2.1 stops here. Awaiting your approval; no cutover, no Phase 3.*
