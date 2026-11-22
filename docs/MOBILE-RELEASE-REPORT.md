# KHERJA — Mobile privacy, location permission and OS compatibility report

Branch: `feature/ride-lifecycle-hardening` · Date: 2026-11-22 · Verified on a Linux container (no Xcode, no Android SDK).

**Release readiness: NOT declared.** Native builds and on-device checks could not be run here (see Blockers).

## 1. Store requirements verified from official sources (2026-11-22)

| Store | Requirement | Source | KHERJA |
|---|---|---|---|
| Google Play | From Aug 31 2026 new apps/updates must target Android 16 (API 36)+; extension to Nov 1 2026 on request. The page (updated 2026-10-28) still says "Starting August 31 2026", so confirm in Play Console before release. | developer.android.com/google/play/requirements/target-sdk | `targetSdk 36`, `compileSdk 36` |
| App Store Connect | Uploads must be built with Xcode 26+ / iOS 26 SDK (in force since 2026-04-28). | developer.apple.com/news/upcoming-requirements | Project is Xcode-26-compatible (Capacitor 8); **the archive must be produced on macOS with Xcode 26+**. Not done here. |

## 2. Versions and targets (read from the repo)

- Capacitor **8.6.2** (core, cli, ios, android), `@capacitor/geolocation` 8.2.5, `capacitor-native-settings` 8.2.0 (Android only). The brief said 7.x; the repo was already on 8.x, so no major upgrade was made.
- Android: minSdk 24, compileSdk/targetSdk 36, AGP 8.13.0, Gradle 8.14.3, `applicationId com.kherja.app`, versionCode 1 / 1.0.
- iOS: deployment target 15.0 (Capacitor 8 minimum), SPM (`CapApp-SPM`, capacitor-swift-pm 8.6.2), bundle id `com.kherja.app`, MARKETING_VERSION 1.0.
- `cap sync` is clean: Android finds Geolocation + NativeSettings; iOS finds Geolocation only (NativeSettings excluded on purpose: its private `App-prefs:` URLs are an App Review risk; iOS opens Settings via the public `app-settings:` URL).

## 3. Permissions

- **Android manifest:** INTERNET, ACCESS_COARSE_LOCATION, ACCESS_FINE_LOCATION (both, so Android 12+ offers Precise/Approximate). No background location, no foreground-service, no CAMERA, no POST_NOTIFICATIONS (no push implemented). `allowBackup=false`, cleartext off. GPS/camera hardware `required=false`.
- **iOS Info.plist:** `NSLocationWhenInUseUsageDescription` only (no Always keys, no `location` background mode); camera and photo-library strings (used by the driver document upload input). No notification key because push is not implemented.
- **Location behaviour (`app/shell/kj-location.js`):** foreground only; one explanation sheet (Arabic Darija text from the brief, natural French equivalent) before any OS dialog; no automatic re-prompt after denial; denied/GPS-off/unavailable sheets only on a user tap, each with manual-pickup fallback and an "open settings" button; driver goes offline and stops sharing if permission is lost; timers stop on offline/logout; the rider side only performs one-shot reads (no continuous watch, so nothing keeps tracking after a ride ends or is cancelled).

## 4. Privacy manifest (`ios/App/App/PrivacyInfo.xcprivacy`)

- Present, valid plist, referenced in the Xcode **Resources build phase** (so it is copied into the .app), tracking = false, no tracking domains.
- Required-reason APIs: none declared. Search of the app's Swift sources and of Geolocation/NativeSettings iOS sources found no required-reason API calls (UserDefaults, file timestamps, boot time, disk space, active keyboards). Capacitor and Cordova ship their own `PrivacyInfo.xcprivacy` (verified in `node_modules/@capacitor/ios`).
- Collected data (all linked to the account, purpose App Functionality, not tracking): precise location, phone number, name, photos/videos (driver documents), user ID, other user content.
- **Not verified here:** the merged privacy report (`Xcode > Product > Archive > Generate Privacy Report`) needs macOS. The bundle inclusion was checked in the project file only, not in a built .app.

## 5. Findings that need a decision

1. **Third-party location disclosure.** The web app calls `nominatim.openstreetmap.org` (forward and reverse geocoding) and `router.project-osrm.org` (routing) directly from the device. Pickup/drop-off coordinates and typed addresses therefore reach third parties. This must be reflected in the Apple App Privacy answers and the Google Play Data Safety form, and in the privacy policy. The public Nominatim and OSRM servers also have usage policies that do not allow production app traffic at scale. Recommended: proxy through the KHERJA backend or move to a licensed provider.
2. **No production origin.** `KHERJA_APP_ORIGIN` is not defined anywhere, and the connected Render account contains only an unrelated n8n service. Without it `cap sync` bundles the legacy offline `app/` into the binaries. `npm run mobile:preflight -- --release` now fails until a production HTTPS origin is set. Web and native therefore cannot yet be confirmed to use the same production configuration.
3. **Export compliance key.** `ITSAppUsesNonExemptEncryption` is not set in Info.plist. This is a legal declaration; set it only after confirming the app uses only standard HTTPS.
4. Trusted contacts (name and phone typed by the user) are covered by "Other user content"; confirm against Apple's definitions during privacy-label review.
5. A backgrounded driver app cannot send updates (JS timers pause), so the server keeps the last position until it expires. This is existing behaviour, left unchanged.

## 6. Bugs found and fixed during verification

- The "My location" chip sat directly under the route-search panel and could not be tapped (pre-existing; the location feature depends on it). Now placed in the topbar row (`app/shell/shell.extra.css`).
- The new manual-area dropdown made the search panel taller and overlapped the bottom sheet on small screens. Sheet height adjusted (`app/shell/passenger.loc.css`).
- The one-time location sheet blocked older e2e flows (7 then 3 failures versus a 71/71 baseline). The suite now starts contexts as returning installs through `e2e/_kj-loc-seen.js`; fresh-install behaviour has its own tests.

## 7. Test results

| # | Required test | Result |
|---|---|---|
| 1 | iOS fresh install and first launch | **Not run.** No Xcode/simulator. Flow logic covered by stubbed-bridge e2e (Chromium). |
| 2 | iOS permission granted | Stub e2e only (allow, current position becomes pickup). Not a native dialog. |
| 3 | iOS permission denied | Stub e2e only (no re-prompt, denied sheet on tap, manual pickup). |
| 4 | iOS revoked from Settings | Stub e2e only (denied sheet with iOS settings hint). |
| 5 | Android fresh install and first launch | **Not run.** No SDK/emulator. Stub e2e for logic. |
| 6 | Android precise permission | Stub e2e only. |
| 7 | Android approximate permission | Stub e2e only (works, tells the user it is approximate). |
| 8 | Android denied | Stub e2e only (settings button calls `application_details`). |
| 9 | Android revoked | Stub e2e only. |
| 10 | GPS disabled | Stub e2e only (sheet opens the location settings switch). |
| 11 | Location unavailable | Stub e2e only (retry and manual offered). |
| 12 | Manual pickup without permission | Pass (Chromium e2e, real app and backend). |
| 13 | Current-location pickup | Pass (Chromium with real geolocation grant, and stub). |
| 14 | Nearby driver discovery | Backend and e2e ride flows pass; the driver position now comes through the new location layer. |
| 15 | Updates during an active ride | Not implemented by design (no background/continuous tracking). |
| 16 | Tracking stops after ride end/cancel | Holds by construction: rider has one-shot reads only; driver timer stops on offline/logout/permission loss. |
| 17 | Privacy manifest validation | Plist parses, build-phase reference present (preflight). Merged privacy report not generated (needs macOS). |
| 18 | Native iOS build | **Not run** (Linux). |
| 19 | Native Android build | **Not run** (Android SDK download blocked by the sandbox network allowlist). |
| 20 | Latest stable OS compatibility | **Not verified on any OS build.** Targets and toolchain versions satisfy the published requirements. |

Automated results on the final tree: backend `npm run test:backend` 137 pass / 1 skipped (pre-existing) / 0 fail; `app/shell/kj-location.test.js` 16/16; `npm run test:e2e` 80/80 (71 pre-existing + 9 new in `e2e/location-permission.test.js`); `npm run mobile:preflight` passes. The e2e tests run in desktop Chromium. No simulator, emulator or physical-device verification was performed.

## 8. Blockers before release

1. Build and archive on macOS with Xcode 26+; run on a physical iPhone; generate the privacy report.
2. Build the AAB with the Android SDK (platform 36); test on Android 12+ and 13+ devices (approximate location, notification behaviour, edge-to-edge).
3. Provide the production HTTPS origin and set `KHERJA_APP_ORIGIN` for both platforms (`npm run mobile:build`, then `npm run mobile:preflight -- --release`).
4. Resolve finding 1 (third-party geocoding/routing) and update store privacy forms and the privacy policy.
5. Signing: no team, certificates or keystore are configured.
