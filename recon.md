# Recon map: inDrive (ride-hailing, "offer your fare") — clean-room

Scope: mobile, rider + driver, core loop only (offer fare -> driver bids -> pick -> ride -> pay -> rate). Target market: Algeria (DZD, ar/fr). Own brand, own code, own assets.

## Sources
| source | url | gave |
| --- | --- | --- |
| How does inDrive work | https://indrive.com/help/about-indrive/how-does-indrive-work | model: negotiated fares, no surge, cash direct to driver, services list |
| How fares are calculated | https://indrive.com/help/passengers/how-fares-are-calculated | fare logic |
| Passengers 101 | https://blog.indrive.com/article/passengers-101-how-to-use-our-app | sign-up and request flow |
| Review digest | https://unstar.app/blog/is-indrive-legit-safe-ride-hailing-app-reviews-2026 | complaint themes (rough estimates, 1-3 star subset) |
| Algeria head interview | https://www.dzair-tube.dz/en/indrive-algeria-head-wail-almamma-highlights-market-expansion-user-advantages-and-growth-strategy-in-exclusive-dzair-tube-interview/ | local market (not yet read) |
| App Store listing | https://apps.apple.com/app/780125801 | screenshots (not yet read) |

## Core loop
Rider sets pickup, destination, own price -> nearby drivers accept or counter -> rider picks by rating, car, price -> driver arrives -> ride -> cash pay -> rating.

## Screens (S)
| ID | screen | purpose | key components | states |
| --- | --- | --- | --- | --- |
| S01 | Welcome / language | ar, fr, en pick | language list, CTA | first run |
| S02 | Phone entry | auth | phone input +213, CTA | invalid, rate-limited |
| S03 | OTP | verify | 6-box code, resend timer | wrong, expired |
| S04 | Profile setup | city, name, photo | inputs, avatar | optional photo |
| S05 | Rider home / map | pick locations | map, A/B fields, recents | gps off, no network |
| S06 | Request sheet | price + notes | fare stepper, recommended fare, comment, payment, CTA | price too low warning |
| S07 | Waiting for offers | searching | radar animation, cancel | timeout, no drivers |
| S08 | Offers list | choose driver | offer card (photo, rating, car, price, ETA), accept, decline | counter-offer, offer expired |
| S09 | Driver on the way | track | map, driver card, call, chat, share trip, cancel | arrived, driver cancelled |
| S10 | In ride | track | route, SOS, share trip | route change |
| S11 | Ride complete | pay + rate | final price, stars, tags, tip | cash dispute flag |
| S12 | Ride history | list | cards, receipt | empty |
| S13 | Safety | contacts, SOS, share | contact list | none set |
| S14 | Settings | language, payment, support | list | |
| D01 | Driver home | online toggle, requests | toggle, request feed | offline |
| D02 | Request detail | bid | route, rider price, accept/counter | expired |
| D03 | Driver ride flow | navigate, start, end | status stepper | |
| D04 | Earnings | totals | day/week chart | empty |
| D05 | Driver onboarding | docs, car | upload steps | pending review |

## Flows (F)
- F01 Rider orders: S05 -> S06 -> S07 -> S08 -> S09 -> S10 -> S11. Happy path target: 6 taps from home to confirmed driver. Edge: no offers, driver cancels, offer lapses while reading.
- F02 Sign-up: S01 -> S02 -> S03 -> S04.
- F03 Driver bids: D01 -> D02 -> (rider S08) -> D03 -> D04.
- F04 Safety: S09/S10 -> share trip, SOS.

## Components
Button, phone input, OTP box, text field, map, bottom sheet, price stepper, offer card, driver card, rating stars, chip, toast, tab bar, list row, status stepper, empty state.

## Inferred data model (confidence: medium, from public flow)
- User(id, phone, name, photo, role, lang, city)
- Driver(user_id, car_make, car_model, plate, color, status, rating_avg, docs_status)
- RideRequest(id, rider_id, pickup, dropoff, offered_price, note, pay_method, status, expires_at)
- Offer(id, request_id, driver_id, price, eta_min, status)
- Ride(id, request_id, offer_id, status, started_at, ended_at, final_price)
- Rating(id, ride_id, from, to, stars, tags)
- SafetyContact(id, user_id, name, phone)
- Location pings(driver_id, lat, lng, ts)

## What users hate (public review digest, rough shares, link above)
1. Driver accepts then demands more at pickup (~30%).
2. Long wait, then driver cancels (~25%).
3. Aggression over fare, women's safety (~20%).
4. Cash disputes, no protection (~15%).
5. Support is bots only (~10%).
-> Clone fixes: price lock after accept (driver may not re-ask in-app, rider can report), accept-distance cap + ETA shown, cancel-rate shown on driver card, women-rider preference and trip sharing, receipt with locked price, human-escalation support.

## Cannot clone (skip)
Network of drivers and riders, licensed map data (use open tiles), brand/assets, transport licence, other countries' partner deals, inDrive.Money, freight.

## Size
M for a PWA with fake data (about 12 screens). L with real backend, realtime, maps, payments. Hard parts: realtime offers, maps and routing, driver live tracking.
