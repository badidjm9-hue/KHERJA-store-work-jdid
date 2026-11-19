# KHERJA — production integration checklist

Status: provider selection approved by owner. Twilio Messaging API adapter implemented and covered by mocked tests; it remains disabled until credentials and sender approval are supplied. Chargily, Google Maps and Firebase remain preparation-only. No provider account, credentials, payment processing, public DNS, or production deployment has been activated.

## 1. OTP SMS — proposed default: Twilio

Twilio's current Algeria guidance supports outbound SMS, recommends an approved alphanumeric sender ID, and warns that generic sender IDs can be rejected (especially on Mobilis). A domestic sender ID may require pre-registration and an indicated provisioning period of about two weeks. Two-way SMS is not supported for Algeria.

Owner must provide:
- Twilio Account SID
- Twilio Auth Token (store only as a Render secret; never commit it)
- Approved sender ID / From value for Algeria
- Confirmation that the Twilio account is enabled for Algeria and the sender ID is approved
- A test phone number and permission to send a real test OTP

Code status: the backend now has an asynchronous, dependency-free Twilio Messaging API adapter. It posts only over HTTPS, has a 10-second timeout, rejects incomplete configuration, and keeps the locally generated OTP hashed in SQLite. It has mocked success/failure tests; no live SMS has been sent. Before enabling: confirm per-message pricing, deliverability on Mobilis/Djezzy/Ooredoo, consent text, retry policy, and support/abuse handling. Keep OTP unavailable until the sender has been verified end-to-end.

## 2. Payments — launch policy: cash only; online later

Owner decision recorded: passengers pay the driver in cash at launch. The backend marks each ride as `payment_method=cash`, initially `payment_status=pending`; after completion, only the assigned driver can confirm collection. Confirmation is idempotent. The driver app now lists completed rides awaiting cash confirmation and provides a confirmation action in Arabic and French. The authenticated `/api/driver/cash-due` endpoint returns only the current driver's pending completed cash rides. Online checkout is not exposed or activated. Automated tests cover authorization, timing, pending-list visibility, and removal after confirmation.

Future online payments — proposed provider: Chargily Pay V2. Before implementation, confirm:
- Chargily merchant account and sandbox access
- Sandbox API secret and the webhook signing secret/key as documented by Chargily
- Public HTTPS callback/webhook URL and success/failure URLs
- Business verification documents and merchant agreement for live mode
- Decision on what KHERJA charges online (ride fare, commission, wallet top-up, or another purpose) and refund/cancellation rules

When online payments are scheduled, do not switch to live mode until webhook signature verification, duplicate-event idempotency, amount/currency checks, reconciliation, refunds, and accounting have passed sandbox tests.

## 3. Maps, geocoding, routing and live GPS — Google Maps selected

Google Maps Platform is the selected provider. The app currently uses a stylised illustration and already has foreground driver GPS capture (while online) plus server-side proximity filtering; it does not yet have production map tiles, geocoding, route calculation, or passenger-facing live driver tracking. A public configuration endpoint `/api/config/maps` now exposes only `MAPS_BROWSER_API_KEY` for browser use; it is disabled when the key is absent. This does not expose or replace a server-side key. Its published country table currently lists Algeria with map tiles, geocoding, traffic layer, driving directions and walking directions available; biking directions and speed limits are not listed as available. Validate actual address quality in the first launch cities and confirm current pricing/terms before enabling billing. Do not rely on the public Nominatim endpoint for a commercial production workload.

Owner must provide/complete:
- Google Cloud project with Maps JavaScript API, Places API, Geocoding API and Routes API enabled as needed
- Set `MAPS_BROWSER_API_KEY` in the production host secret/config panel after restricting it to the production app domain and only required browser APIs
- Billing account and restricted browser key; server-side key if routing/geocoding is server-side
- Required features: map tiles, place search, address autocomplete, reverse geocoding, route/distance/ETA
- GPS policy: foreground-only or background tracking, retention period, driver consent, passenger visibility, and emergency access

Keys must be restricted by domain/app and API; server keys must remain server-side.

## 4. Push notifications — proposed default: Firebase Cloud Messaging

Owner must create/approve a Firebase project, register the Android/iOS apps (and web app if needed), provide the server credential through secret storage, and confirm notification categories and consent. APNs credentials are needed for iOS delivery. Push remains optional until device registration, token rotation, and delivery tests exist.

## 5. Hosting and operations

Current Render Blueprint uses a paid web instance and persistent disk because SQLite and uploaded driver documents must survive deploys. Confirm paid-plan acceptance, Frankfurt region, persistent disk, public domain/DNS, TLS, backup retention, and restore owner. Do not alter the existing n8n service.

Required production settings:
- `NODE_ENV=production`, `NODE_VERSION=22.23.4`
- `DB_PATH=/var/data/kherja.db`, `UPLOAD_DIR=/var/data/uploads`
- Strong unique `ADMIN_PHONE` and `ADMIN_PASSWORD` (at least 16 characters)
- Correct trusted proxy IP configuration or a shared rate-limit store design
- Provider secrets only in the host's secret manager

## 6. Legal and launch decisions

Before public launch, obtain local legal review for ride-hailing/transport licensing, driver identity/document handling, location tracking, privacy notice and retention, user consent, payment receipts/tax obligations, incident/SOS handling, and account deletion/data export. This checklist is operational guidance, not legal advice.
