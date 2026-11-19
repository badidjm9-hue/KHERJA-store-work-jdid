# Kherja project checklist (checkpoint after Step 4)

Status words are literal. "Verified" means a test that ran and passed; "Open" means not done or not understood.

## Open issues (kept open on purpose)
| # | Issue | State |
|---|-------|-------|
| 1 | Intermittent E2E failure in the passenger countdown test (1 failure in one full run: assertion `bar0 <= 100 && bar0 > 0`, value not captured) | **OPEN, cause not identified.** Not reproduced since: 3 loaded isolated runs, 6 concurrent runs, 4 further full runs all passed. The assertion now prints the value. |
| 2 | `#oempty` regression test | **Done, and corrected.** First attempt was ineffective (passed with the fix removed) and the first diagnosis (CSS override) was wrong. Real cause: the empty-state text stayed visible until the next 250 ms timer tick. Fix: `renderOffers`/decline call `tickCd()` immediately. New MutationObserver test fails without the fix (`empty-state visible with 1 card(s)`). Not shown to explain issue 1. |
| 3 | Re-run `validation/ops-validate.js` | Re-run on the final code, see test report numbers below. |
| 4 | Re-run legacy migration test | Re-run on the final code, see test report numbers below. |
| 5 | Server deadline authoritative for offers | Unchanged and tested (`expires_at` set by the server, immutable by trigger, 14999/15000 ms boundary, multi-process races). The client only displays it. |

## Verified in this checkpoint
- M0 vehicle approval backend: pending requests, append-only events, irreversible `vehicle_locked`, fail-closed legacy migration, DB-level plate triggers, audit-failure rollback, live-ride guard, multi-process race tests.
- 15 s offer expiry: server timestamps, atomic accept, restart persistence.
- Admin API: vehicle-change queue + detail/history, passengers, audit, activity, extended stats, read-only settings; role matrix tests; sensitive reads (document file, passenger detail) audited.
- Admin UI: overview, vehicle-change review (approve confirm, reject with mandatory reason, history, concurrent duplicate refused), passengers, audit log, settings (language, theme, optional sound/haptics, read-only server config), AR RTL / FR LTR, light/dark, mobile bottom sheet, reduced motion. Screenshots inspected for AR/FR x light/dark (4 sets).
- Passenger: server-driven 15 s countdown cards. Driver: offer outcomes + vehicle-change sheet.

## Not done / known limitations (do not treat as complete)
- Admin **legacy views are Arabic-only**: drivers + document review, driver detail, rides, ride detail, reports (a notice is shown in French). They still work and are tested in Arabic.
- Admin settings are **read-only** for server values: nothing is editable because no setting is runtime-configurable yet.
- "Revenue" is not shown: the platform takes no commission yet. The overview shows gross completed fares, labelled as such.
- Passengers have no account status/suspension feature in the backend, so none is displayed.
- Sound/haptic feedback is implemented but only tested for its default-off state and persistence, not audibly/physically.
- Passenger and driver apps: remaining screens and states from the master prompt are **not finished** (offline/error/empty coverage, notifications, safety contacts UI, report-a-problem, full history/earnings views). A complete passenger-to-driver journey exists only as far as the pre-existing E2E suite covers it.
- Real integrations (SMS OTP, maps/routing, push, live GPS, payments) are not connected; no fake success is shown.
- Concurrency tests use two OS processes on one SQLite file; no load testing was done.
- Security report, deployment/backup guides and the final archive are **not final**. This archive is a checkpoint.
