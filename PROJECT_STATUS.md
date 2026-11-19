# KHERJA Project Status — 2026-11-18

## Source
Resumed from `KHERJA-work-in-progress.zip`. Worktree is a clean extraction plus this session's changes.

## Completed in this session
- Server-authoritative fare calculator `backend/fare.js` with Algerian timezone calculation.
- `POST /api/fare/quote` endpoint restricted to authenticated riders.
- Passenger UI now requests server quote when pickup/dropoff points exist; latest-response sequencing prevents stale quotes from overwriting newer vehicle/location selections. Local fallback remains if quote service is unavailable.
- Minimum fare validation (350 DZD) enforced for ride requests server-side; deliveries retain their custom negotiated pricing.
- Regression and integration tests for fare calculator, quote endpoint, and min fare.
- Rebuilt passenger, driver, and admin app outputs.

## Verified tests in this environment
- `npm run test:pricing`: 11/11 passed.
- `npm run test:backend`: 136 passed, 1 skipped, 0 failed (137 total).
- `npm run test:e2e`: blocked; Playwright module is absent in this runtime. 15 suites fail to load because `require('playwright')` cannot resolve. This is an environment dependency failure, not evidence that the app's UI tests failed.
- `node app/build-shell.js` and `node app/build-apps.js`: completed.

## Pricing behavior
- Car: 250 DZD base + 60 DZD/km; daytime promo 5%; night +15%; peak +10%.
- Moto: 200 DZD base + 20 DZD/km; daytime promo 10%; night +15%; peak +10%.
- Minimum ride fare: 350 DZD; rounding to nearest 50 DZD.
- Note: request price remains a rider-selected/negotiated value, not forcibly overwritten by quote. Backend minimum prevents below-floor manipulation, and quote API supplies server recommendation. A policy decision is still needed on permissible quote deviation / bargaining bounds.

## Next
1. Review request/offer lifecycle for price mutation and quote/request parity.
2. Add fare request abuse tests (invalid coordinates, vehicle, unauthorized quote, quote/offer parity).
3. Security audit all API routes, upload, session, rate-limit, admin boundaries.
4. Add user-facing export/download UI for `GET /api/me/export`; resolve E2E dependency availability and run browser suite.
5. Visual audit of actual generated screens, design references are still unavailable.
6. Maps vendor files, privacy/legal docs, deployment credentials, domain, SMS provider, hosting persistence, legal review remain blockers.

## Status
Backend and pricing regression tests pass. Not visually verified in browser in this environment. Not production-ready or deployed.
