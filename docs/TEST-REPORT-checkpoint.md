# Test report, Step 4 checkpoint (actual runs, Node 22.23.4, 1 CPU)

| Suite | Command | Result |
|---|---|---|
| Backend | `npm run test:backend` | 116 tests, 116 pass, 0 fail |
| Ops | `npm run test:ops` (= `node --test backend/ops.test.js`) | 13 tests, 13 pass, 0 fail |
| Ops validation | `node validation/ops-validate.js .` | total=92 pass=92 fail=0 |
| Legacy + clean migration | `node validation/m0-legacy-verify.js <original-phase3.1-root> .` | 7 checks pass (legacy DB built by the ORIGINAL code via its API) |
| E2E | `npm run test:e2e` | 54 tests, 54 pass, 0 fail |

Mutation checks performed (each broken on purpose, test failed, code restored byte-identical): rogue `vehicle_locked` writer, removed live-ride guard, audit write outside the transaction, removed onboarding plate check, removed auth on an admin endpoint, dark-theme card background, French string, removed immediate `tickCd()` refresh.

Not covered: the intermittent countdown failure (open, see PROJECT-CHECKLIST.md), audible sound / physical haptics, load testing, real SMS/maps/payments.
