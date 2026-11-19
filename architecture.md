# Architecture status

For the architecture actually present in this repository, see [`architecture-as-built.md`](architecture-as-built.md). The original proposal below is retained for historical context and is not evidence that these components are implemented.

---

# Architecture: Kherja (working name) — ride-hailing with rider-set fares, Algeria

## Stack (one line each)
- App: PWA first (single codebase, installable, fast to test), later Expo wrapper. Why: ships to any phone with no store review while validating.
- Web/API: Next.js + TypeScript on Vercel. Why: one deploy, server actions.
- DB: Postgres (Supabase). Why: RLS, PostGIS for distance, Realtime for offers.
- Realtime: Supabase Realtime channels (offers, driver location). 
- Auth: phone OTP via Supabase Auth with a local SMS gateway.
- Maps: MapLibre + OpenStreetMap-based tiles with own key. Licensed map data is not cloned.
- Payments: cash at launch. Card (SATIM/CIB) later through the official gateway.
- Jobs: Supabase cron (expire requests, offers).

## Schema
See `schema.sql` (9 tables, RLS on all, exclusion/unique rules for one active offer per driver per request).

## API (routes)
| route | does | who | flow |
| --- | --- | --- | --- |
| POST /api/auth/otp | send code | anon | F02 |
| POST /api/auth/verify | verify, session | anon | F02 |
| POST /api/requests | create request with offered price | rider | F01 |
| GET /api/requests/:id/offers | list offers (realtime too) | rider owner | F01 |
| POST /api/requests/:id/offers | driver bid (accept or counter) | driver within radius | F03 |
| POST /api/offers/:id/accept | rider accepts, locks price | rider owner | F01 |
| POST /api/rides/:id/status | arrived, started, completed | driver | F03 |
| POST /api/rides/:id/rating | rate | participants | F01 |
| POST /api/rides/:id/report | price dispute / safety | participants | F04 |
| POST /api/drivers/location | ping | driver | F03 |
| GET /api/drivers/earnings | totals | driver | F03 |
Jobs: expire requests after 5 min, expire offers after 60 s.

## Parts that bite
- Price lock: final_price is copied from the accepted offer and immutable; disputes go through report.
- Race: two riders accepting one driver -> unique partial index on active rides per driver.
- Idempotent status transitions (retries on bad networks).
- Realtime on weak 3G: poll fallback every 4 s.
- Location privacy: driver location visible to rider only during an active ride.
- Arabic RTL and bidi numbers (Western digits for prices).

## Build order
1. Slice: S02-S11 on fake data (done in `app/index.html`).
2. Must-haves: auth, real requests/offers, tracking, SOS/share, ratings.
3. Should: history, earnings, driver onboarding.
4. Fixes from reviews: price lock, cancel-rate on card, women-rider preference.
