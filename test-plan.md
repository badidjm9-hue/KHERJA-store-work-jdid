# Test plan
Targets: `app/index.html` (Playwright, 390x844 and 360 wide) and `backend/` (node:test). Never run against inDrive.
| id | case | where | result |
| --- | --- | --- | --- |
| F02-H1 | signup to home | e2e | pass |
| F02-N1 | invalid phone | e2e | pass |
| F02-N2 | wrong OTP | e2e + api | pass |
| F01-H1 | request, offers, accept, ride, rate | e2e + api | pass |
| F01-E1/E2/E3 | low price warning, floor 100, stepper | e2e | pass |
| F01-E4..E7 | decline, cancel waiting, cancel before pickup, double click | e2e | pass |
| F01-E9 | refresh mid-flow | e2e | pass (returns to start, state not persisted) |
| F01-E10 | second user cannot see/act | api | pass |
| F01-E11 | gouging, double bid, far driver, rider bidding | api | pass |
| F03-H1 | driver online, request, answer | e2e | pass |
| F04-E1 | women-only filter | api | pass |
| X-1 | RTL to LTR French | e2e | pass |
| X-2 | no horizontal scroll 360/390, targets >= 44px | e2e | pass after BUG-1 |
| X-3 | accessible names, keyboard, reduced motion, dark contrast | e2e | pass after BUG-2 |
| X-4 | OTP rate limit, account deletion | api | pass |
Not covered: real SMS, real maps, payments, slow network/offline, two tabs, axe scan (package install blocked).
