# Test report (real runs on Node v22.23.4, this commit)

| Suite | Command | Result |
|---|---|---|
| Syntax | `node --check` on every tracked `.js` file | no errors |
| Backend | `npm run test:backend` | 125 tests, 125 pass, 0 fail |
| Ops | `npm run test:ops` | 13 tests, 13 pass, 0 fail |
| E2E (Playwright 1.63, Chromium) | `npm run test:e2e` | 71 tests, 71 pass, 0 fail |
| Local production-mode smoke | server with `NODE_ENV=production`, temp DB, test-only admin | health 200; redirects 302; /app, /app/driver, /admin, fonts 200; OTP 503 `sms_unavailable`; admin login 200 / wrong password 401 |

Coverage notes: E2E covers passenger, driver and admin journeys (ride lifecycle, documents, vehicle change, French admin, new screens). Console/page errors are asserted empty in the new E2E suites. Not covered: real SMS/push/payment/GPS (not integrated), CSRF cross-site test, load tests, GitLab pipeline execution (not run: no GitLab access from here), Render deployment (not done).
