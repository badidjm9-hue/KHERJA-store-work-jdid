# Security review (scoped, defensive, this repository only)

Method: code reading plus automated tests in this repository and a local production-mode smoke run. **Not** a penetration test; no third-party system was touched. No claim of absolute security.

| Area | Result | Evidence |
|---|---|---|
| Role authorization | PASS | `backend/roles.test.js`, `backend/authz-matrix.test.js` (IDOR on rides/report/rating/status, anonymous 401 on protected endpoints, rider/driver refused on admin API) |
| Admin routes | PASS | Separate `asid` session and password login; no public admin registration; bad password 401 (smoke run) |
| Sessions / cookies | PASS (code + tests) | `sid`: HttpOnly, SameSite=Lax, Secure outside dev, 30 days; token stored hashed; account deletion invalidates session (test) |
| Input validation | PASS (inherited tests) | `backend/security.test.js`, strict int/string validators; 400 on bad input |
| CSRF / cross-site requests | IMPROVED / PARTIAL | State-changing `/api/*` requests reject `Sec-Fetch-Site: cross-site` and mismatched or malformed `Origin`; same-origin and absent-Origin API clients remain supported. Regression tests cover cross-site and mismatched Origin. This is not a substitute for an independent browser-based CSRF review. |
| XSS / CSP | PARTIAL | CSP present (`font-src 'self'`, `style-src 'self' 'unsafe-inline'`); UI escapes dynamic values (`esc()`); `'unsafe-inline'` styles remain; no dedicated XSS test pass in this round |
| Rate limiting | PASS with caveat | OTP 3/10 min per phone, 20/10 min per IP; in-memory per process; shared across visitors if `TRUSTED_PROXY_IPS` is not set |
| OTP | PASS in secure mode | Random 6-digit code, hashed, 5 min expiry, tries counter, never logged/returned; 503 when no SMS provider (verified). Dev mode fixed code `123456` is refused in production |
| Uploaded documents | PASS (inherited tests) | Served only to owner/admin through authenticated routes, mime/size checked, nosniff |
| Secrets exposure | PASS | `.gitignore` excludes env/db/uploads; only `backend/.env.example` is tracked; startup refuses dev flags in production; secrets absent from log (smoke run) |
| SQLite / migrations | PASS | Idempotent SQL migrations, FK on, backup/restore tests (`test:ops` 13/13) |
| Legacy routes | PASS | 302 + no-store outside dev (`backend/legacy-redirect.test.js`); legacy pages still contain old SOS/share behaviour but are unreachable in production |
| Dependencies | PASS (trivially) | Zero npm dependencies, no lockfile, `npm audit` not applicable. Playwright (dev/CI only) is not audited |

Open items: CSP without `unsafe-inline`, SMS provider/anti-abuse design before real OTP, shared rate-limit store before scaling, independent penetration test before public launch. HSTS is now sent on production API responses; verify the final TLS/domain configuration before enabling preload.
