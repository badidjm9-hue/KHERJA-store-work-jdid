# Development Log — 2026-11-18

- Extracted current KHERJA WIP archive to isolated worktree.
- Confirmed pricing module test initially had an incorrect daytime car expectation; aligned test to established pricing rules (car promo 5%, moto promo 10%) and fixed server module to apply moto promo at 10%.
- Restricted fare quote API to authenticated riders.
- Connected passenger UI route quote refresh to server quote API; sequence token protects against stale async responses.
- Existing request endpoint enforces minimum ride fare 350 DZD server-side; delivery remains negotiated.
- Pricing suite: 11/11 passing.
- Backend suite: 136 pass, 1 skip, 0 fail.
- E2E blocked in current runtime due missing Playwright module; 15 test files cannot load.
- Rebuilt app output via build-shell and build-apps.


## Personal data export
- Added authenticated `GET /api/me/export`, versioned JSON output scoped to current account.
- Includes account, ride history, ratings, safety contacts, submitted reports, driver profile, vehicle-change history, and document metadata only. Does not expose document file paths/files, session tokens, OTPs, or password hashes.
- Regression test: authenticated export succeeds; anonymous access returns 401.
