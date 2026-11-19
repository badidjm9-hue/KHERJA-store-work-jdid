# Phase 2 test report

Run: 2026-11-11, Node v22, Playwright Chromium, each file run separately (`node --test <file>`).

| Suite | Tests | Pass | Fail | What it proves |
|---|---|---|---|---|
| backend/test.js | 9 | 9 | 0 | Phase 1 API behaviour (unchanged) |
| backend/security.test.js | 19 | 19 | 0 | Dev-mode protections, admin credentials, config (unchanged) |
| backend/roles.test.js (new) | 7 | 7 | 0 | Role x endpoint matrix; stored role wins over client-sent role (both directions); admin cannot be self-selected; admin OTP session opens no rider/driver/admin route; rider cookie replayed as admin cookie rejected; negotiated fare locked and rider cannot bid on own request |
| e2e/api.test.js | 1 | 1 | 0 | Legacy two-browser ride flow (unchanged route) |
| e2e/onboarding.test.js | 2 | 2 | 0 | Driver docs, admin review, gating, suspension (legacy /driver, /admin) |
| e2e/landing.test.js | 1 | 1 | 0 | Landing page |
| e2e/delivery.test.js | 2 | 2 | 0 | Delivery negotiation + 360px form (paths now repo-relative) |
| e2e/prototype.test.js | 9 | 9 | 0 | Offline demo: flow, RTL/LTR, a11y, sizes (paths now repo-relative) |
| e2e/shell.test.js (new) | 16 | 16 | 0 | One-app shell, see list below |
| e2e/shell-legacy-api.test.js (derived) | 1 | 1 | 0 | Full ride through /app and /app/driver |
| e2e/shell-legacy-delivery.test.js (derived) | 1 | 1 | 0 | Delivery negotiation through the shell |
| e2e/shell-legacy-onboarding.test.js (derived) | 1 | 1 | 0 | Driver onboarding + admin review + gating through the shell |
| **Total** | **69** | **69** | **0** | Phase 1 baseline was 43/43 after the path fix |

## shell.test.js cases
1 passenger entry to map; 2 driver entry to driver interface; 3 picker decides role only for new accounts on either URL; 4 existing accounts use the backend role regardless of URL/picker (both directions, toast shown); 5 wrong entry route never logs out; 6 session resume after reload for both roles; 7 localStorage/sessionStorage/URL/`window.Kherja` tampering has no effect; 8 mounted pages cannot reach the other role's API (403); 9 no switcher and no `/api/dev/role` call; 10 admin-role account gets no mobile interface, Admin console still separate; 11 same browser, two roles in turn, logout hand-over, no driver polling in rider UI; 12 connection failure and forced 403 show a notice and never call logout; 13 negotiated fare end to end, accepted fare locked at 450, HTML in names escaped; 14 French/LTR and no horizontal scroll at 360/390, gate targets >= 44px; 15 legacy routes byte-identical, /app headers (CSP etc.) equal to /, no new external origins; 16 360px passenger delivery form and driver tabs.

## Legacy integrity
Compared with the Phase 1 archive, changed files are only: `backend/server.js` (two `PAGES` entries), `e2e/delivery.test.js` and `e2e/prototype.test.js` (hardcoded `file:///home/claude/replica/...` replaced by repo-relative paths). No legacy page, template, build script, migration, or design file changed.

## Not covered
Real SMS, real maps/GPS, payments, offline/slow network, two tabs on one account, axe scan (package install blocked), PWA install/manifest, restoring an active ride after reload.
