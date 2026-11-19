# KHERJA — Phase 0 Baseline Report (2026-11-18)

Everything below was measured in this session on Node v22.23.4 (the pinned version). Nothing is copied from earlier reports.

## Stack
Node 22.23.4, `node:sqlite` (3 migrations + `schema.sql`), vanilla HTML/CSS/JS with no npm dependencies. One shell (`app/kherja.html`) serves passenger (`/app`) and driver (`/app/driver`); admin is at `/admin`. It is built from `app/shell/*` with `node app/build-shell.js` and `node app/build-apps.js`. Fonts are self-hosted (Tajawal, Plus Jakarta Sans). Backend: `backend/server.js` (554 lines). Deployment files: `render.yaml`, `.gitlab-ci.yml`, `deploy/` (systemd + nginx examples).

## Measured test results

| Suite | Before fixes | After fixes |
|---|---|---|
| Backend (`npm run test:backend`) | 131/131 pass | 131/131 pass |
| Pricing (`test:pricing`) | 6/6 pass | 6/6 pass |
| Ops (`test:ops`) | 13/13 pass | 13/13 pass |
| E2E (`test:e2e`, Playwright + Chromium) | most suites failing on CSP console errors (`shell.test.js`: 0/16); after fix 1+2: 70/71 | **71/71 pass** |

`CONTINUATION-ROADMAP.md` said E2E could not run because Playwright was missing. Playwright and Chromium are available here, so the E2E suite was run for the first time.

## Defects found and fixed in this session

1. **HIGH — Map library blocked by the app's own CSP.** `shell.template.html` loaded Leaflet from `unpkg.com`, but the server sends `script-src 'self'` and `style-src 'self'`. The browser blocked it on every page load, so the live map never worked (the app silently fell back to the static drawing) and each page logged CSP errors. This was the cause of 16 of 16 failing shell E2E tests. Fix: external tags removed. The map now initialises only if a self-hosted Leaflet is present (see "Blocked").
2. **HIGH — Leaflet global `L` shadowed by the language variable.** `passenger.view.js` declares `let L = lang` ('ar'/'fr'), so `L.map(...)` could never work, even with Leaflet loaded. Fix: Leaflet is accessed through a captured handle (`LF` / `window.L`) and the init guard checks `typeof window.L.map === 'function'`.
3. **MEDIUM — Route-search panel covered the Ride/Delivery toggle on small screens (360 px).** The `.map-search` overlay (z-index 8) sat on top of the bottom sheet, so users could not tap "توصيل" (delivery). Fix: the sheet is capped at `calc(100% - 262px)` and scrolls inside that space. Verified by the 360 px E2E test.

## Feature status (from code and tests, not from earlier claims)

**Working and tested:** OTP login (dev code only in dev mode; secure mode refuses without an SMS sender), role-based sessions, driver onboarding + admin document review + gating, vehicle choice (car/moto) enforced server-side, offers with 15 s server expiry and locked accepted fare, one active ride per driver, ride lifecycle with invalid transitions refused, cash payment confirmation, history, notifications (in-app), contacts, SOS links (tel/sms only), report, account deletion, admin rides/reports/audit, backup/restore (ops suite), authorization matrix (IDOR, anonymous, cross-role).

**Partially working:** passenger map (needs vendored Leaflet, below), pricing (formula is client-side in `passenger.view.js`; see risks), admin settings (read-only), driver earnings (gross fares, by ride creation date, no commission), Arabic/French coverage (E2E checks key screens only).

**Missing / not implemented (stated in the README and confirmed):** SMS provider (Twilio sender code exists, no credentials), push notifications, online payments, real GPS tracking for drivers, geocoding/routing provider abstraction, admin-configurable pricing, promotions/referrals/loyalty, passenger suspension, legal documents (privacy policy, terms), PostgreSQL migration path, monitoring/error tracking.

## Security and risk observations (not yet audited in depth)
- **Pricing is computed in the browser** (`suggestedFare()` in `passenger.view.js`). The server locks the accepted offer, but the suggested fare and the 350 DA floor are not enforced server-side. This is a fare-manipulation risk to verify and fix in Phase 5 / 9.
- Public OSM tiles, Nominatim and OSRM are called directly from the browser. That breaks the CSP `connect-src 'self'` / `img-src` policy and violates OSM fair-use for production. A server-side provider abstraction is required (Phase 6).
- Reverse-geocode and route requests send exact coordinates straight to third parties (privacy, Phase 10).
- SQLite single file: concurrency was tested across two processes but no load test exists.
- No dependency audit is needed (zero npm dependencies), but no full penetration test was run. Row 9 of `docs/RELEASE-GATE.md` ("Critical security findings: NOT VERIFIED") remains true.

## Deployment blockers
SMS credentials, domain/TLS, persistent disk and backups on a real host, legal review, and the vendored map library.

## Blocked on the user (cannot be obtained from this session)
1. **Leaflet 1.9.4 files.** The sandbox cannot reach unpkg/jsDelivr (HTTP 403) and package installs are disabled. Place `leaflet.js`, `leaflet.css` and `images/` in `app/vendor/leaflet/`. The server then needs a static route for them plus an `img-src` entry for the tile host, which I will wire when the files are supplied.
2. SMS provider credentials, hosting account and domain.
3. Algerian legal review of every document produced in Phase 10.
4. The reference design screenshots for the Phase 1 screen-by-screen comparison (the repository has `design/tokens.*` and `components.md` only).

## Current classification
**Tested (backend + E2E), not feature complete, not staging ready, not production ready, not deployed.**
