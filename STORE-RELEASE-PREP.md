# KHERJA — Mobile Store Release Preparation

## Status
This repository is currently a server-backed web app. Capacitor configuration is prepared, but Android/iOS native projects and store binaries are **not yet built**. A public HTTPS production origin and native build environments are required.

## Product distribution model (confirmed)
- **Passenger + Driver:** native Android app and native iPhone app, delivered through Google Play / App Store. Both roles are in the KHERJA mobile app; role-based access determines the experience.
- **Admin dashboard:** responsive **web application only**, designed for phone screens as well as desktop/tablet. It is not a store app and will not be wrapped in Capacitor.
- The admin web dashboard remains hosted at the secure web origin (currently `/admin`). Admin authentication and authorization must remain server-side; hiding UI controls is not an authorization boundary.

## Native shell
- App ID: `com.kherja.app` (confirm availability/ownership before release)
- Display name: `KHERJA`
- Web directory: `app/`
- Production origin: set `KHERJA_APP_ORIGIN` to the HTTPS origin that serves `/app`, `/app/driver`, and the API.
- Do not use HTTP or a development/staging URL for store submission.

## Next steps (requires network + build machines)
1. Install Capacitor Core, CLI, Android and iOS packages.
2. Set `KHERJA_APP_ORIGIN` to the approved production HTTPS origin.
3. Run `npx cap add android` and `npx cap add ios`.
4. Generate platform icon/splash assets from `app/assets/kj-icon-1024.png`.
5. Open Android Studio and Xcode; configure signing, package identifiers, privacy manifests and permission descriptions.
6. Test on physical Android and iPhone: OTP, login/logout, passenger/driver flows, maps, location permission denied/allowed, phone/SMS links, offline/error states, back navigation, deep links, keyboard, RTL, app resume.
7. Verify the production API is reachable in WebView, cookies/session auth are secure, and the origin is not a dev host.
8. Prepare Play Console AAB and App Store Connect archive; upload only after all release gates and legal/privacy review pass.

## Store assets and disclosures
- App icon: 1024x1024 source exists; verify platform exports and adaptive icon safe zone.
- Screenshots: required per store/device category; not yet prepared.
- Privacy policy URL and support URL: not supplied.
- Google Play Data Safety and Apple App Privacy disclosures: not completed.
- Apple location permission usage text: needs finalized native config.
- SMS OTP, push notifications, payments: provider integration/credentials and declarations remain external blockers.
- App Review test account and review instructions: not supplied.

## Release gate
A successful web/backend test run is not equivalent to a native store-ready build. Do not claim store submission readiness until native builds, signing, physical-device QA, store metadata, privacy/legal documents, and review requirements are verified.

## Automated preflight added
- `npm run mobile:preflight` checks required app pages/assets, manifest JSON, viewport, manifest reference and obvious localhost API hardcoding.
- `npm run mobile:build` rebuilds the shell/apps, runs preflight and attempts Capacitor sync.
- Store metadata template: `assets/store/STORE-METADATA-TEMPLATE.md`.
- This preflight is not a native compilation or signing test.

## Separate release tracks
### Mobile (Android + iOS)
Build the passenger/driver native shell with Capacitor. Validate role switching/authentication, location permissions, maps, deep links, push notifications (if enabled), and native back/resume behavior on real devices.

### Admin (responsive web)
Build and deploy `app/admin.html` (served at `/admin`) as a web-only dashboard. Before release, verify narrow widths (320–430 px), tablet, desktop, Arabic RTL, French LTR, touch targets, tables/cards, dialogs, and session expiry. Do not add Capacitor or store submission steps for admin.

## Device QA matrix (required before store builds)

| Surface | Target | Required viewport/device checks | Status |
|---|---|---|---|
| Passenger | Android Native | Android 10+; small/large screens; location allow/deny; back/resume; OTP; ride flow | Not run — native project unavailable |
| Driver | Android Native | Android 10+; location foreground/background policy; offer timer; accept/decline; navigation links | Not run — native project unavailable |
| Passenger | iOS Native | iOS supported target; location allow/deny; keyboard; safe areas; OTP; ride flow | Not run — native project unavailable |
| Driver | iOS Native | iOS supported target; location; offer timer; accept/decline; resume | Not run — native project unavailable |
| Admin | Web mobile | 320–430 px width; RTL Arabic; LTR French; touch targets; table overflow; auth expiry | Automated preflight only; manual QA pending |
| Admin | Web tablet/desktop | sidebar, data tables, dialogs, charts, filters, auth expiry | Manual QA pending |

Admin is intentionally excluded from native store builds. Deploy it through the web server at `/admin`.
