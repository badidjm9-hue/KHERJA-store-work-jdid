# Kherja Phase 3.1 — Initial implementation increment

## Scope completed
- Verified source archive SHA-256 before extraction:
  `c8e6055a889352234adbe72a2a4f510b89cf00c325ac921fa6eaf6dee427c0e7`
- Began cool light-gray / frosted-glass design-system transition in the shared stylesheet, which is the source for Passenger, Driver, and Admin generated pages.
- Added Passenger ride vehicle selection: Car or Motorcycle, with Arabic and French labels, accessible pressed states, and a clear selected treatment.
- Vehicle choice is hidden for delivery mode; delivery flow remains unchanged.
- Added additive SQLite column `requests.vehicle_type` with default `car`, preserving old records and old clients.
- Added server-side matching: driver request feed only returns rides matching the driver's registered vehicle; offer creation independently rejects mismatches.
- Added backend test for car/moto filtering, direct offer rejection, and invalid vehicle type.
- Rebuilt generated `app/kherja.html`, `app/driver.html`, and `app/admin.html` from their source templates.
- Updated design token references and feature inventory.

## Verification
- Node used: v22.16.0 (archive pins v22.23.4).
- Backend suite: 87 tests discovered, 86 passed, 0 failed, 1 skipped because runtime is not pinned v22.23.4.
- Ops validation: 92/92 passed.
- JavaScript syntax checks passed for changed JS files.
- Generated page contains the vehicle selector; static source assertions passed.
- E2E could not run in this environment: Playwright module is not installed. No E2E pass is claimed.
- No visual screenshot/browser review was completed; no visual QA claim is made.

## Not completed yet
This is the first implementation increment, not the complete redesign. Passenger trip-location, fare, search, offers, active ride, history and profile screens; Driver home/earnings/history; and Admin dashboard/navigation still need their planned visual and functional work. No deployment or cutover was performed.

## Compatibility and safety
- Existing fare negotiation and immutable accepted-price behavior unchanged.
- Auth, roles, sessions, and admin authorization unchanged.
- Existing requests default to car; old API clients that omit `vehicle_type` continue to create car requests.
- Delivery requests remain eligible for both vehicle types.
