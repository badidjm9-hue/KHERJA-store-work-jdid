# What users hate, what is missing, what to fix

## Sample size (read this first)
**0 verified reviews collected.** Apple's review feed and Trustpilot both block automated reading (robots.txt), and this skill does not get around that. The only evidence so far is one public digest article, which gives rough shares from a subset of 1-3 star reviews and relays translated, masked quotes. Quotes from it are not treated as verbatim and are not copied into `reviews.csv`. Every theme below is therefore **thin (one source)**.
To raise it: paste 100+ reviews (App Store, Google Play, Reddit, Facebook groups for Algerian drivers) into `replica/reviews.csv` as `source,url,date,rating,text`, then run `reviews.py`.

Source: [inDrive review digest, 2026](https://unstar.app/blog/is-indrive-legit-safe-ride-hailing-app-reviews-2026) (shares are the article's own estimates).

## 1. What they hate (thin, 1 source)
| problem | share per digest | fix in Kherja/Wasla |
| --- | --- | --- |
| driver accepts a price, then demands more at pickup | ~30% | price locked at accept, immutable in DB, report button |
| driver accepts from far away, makes you wait, cancels | ~25% | accept radius 8 km, ETA on the offer, cancel % on driver card |
| aggression over fare, women travelling alone feel unsafe | ~20% | women-only option, trip share, SOS |
| cash disputes with no protection | ~15% | locked price shown on receipt, price_dispute report |
| support is automated only | ~10% | human escalation (not built) |

## 2. What is missing
Not enough data to rank. From the Algeria interview: users can complain through app, email or offices; simple cases are automated, complex ones go to teams ([Dzair Tube interview with inDrive Algeria's GM](https://www.dzair-tube.dz/en/indrive-algeria-head-wail-almamma-highlights-market-expansion-user-advantages-and-growth-strategy-in-exclusive-dzair-tube-interview/)).

## 3. What is unsolved (hypothesis, needs reviews to confirm)
Women riders who want women drivers; riders who want a guaranteed final price.

## Business risk found: regulation (talk to a lawyer before launch)
- A VTC bill is still with the government's General Secretariat, to go to Parliament; the minister said drivers are not "illegal in the strict sense" ([Algérie360](https://www.algerie360.com/applications-vtc-en-algerie-voici-ce-qui-va-changer-en-2026/)).
- Licensing is described as local (a licence in Algiers does not cover Oran), authorities favour local data storage, and Yango left in August 2024 citing regulatory fit ([AlgeriaTech summary](https://algeriatech.news/?p=19715)). Heetch works only with licensed taxi drivers and private chauffeurs.
- Both articles are secondary summaries, not the legal texts. Do not launch publicly until a lawyer confirms the platform licence, driver licences, insurance and data rules.

## Fix plan
| # | fix | size | skill | status |
| --- | --- | --- | --- | --- |
| 1 | price lock after accept | S | backend | done |
| 2 | cancel % and ETA on offer card | S | build | done |
| 3 | women-only option | S | backend | done |
| 4 | accept-distance cap | S | backend | done (8 km) |
| 5 | licensed-driver document check | M | backend | not built |
| 6 | human support escalation | M | backend | not built |
| 7 | real SOS and trip share to safety contacts | M | backend | not built |

## Angle (recommended: A)
A. For riders who are tired of the price changing at pickup, [app] locks the fare the moment you accept. Evidence: thin, ~30% in one digest.
B. For women who want to choose who drives them, [app] lets you ride with women drivers only. Evidence: ~20% safety theme, thin.
C. For drivers who are tired of riders cancelling after a long approach, [app] shows each rider's cancel rate. Evidence: none yet.

## Delivery (added 2026-11-08, user request)
Built: sender sets pickup and drop-off address, item type (food or parcel), description, recipient name and phone, and a delivery fee; couriers bid like drivers; after accept the courier calls the sender, and the sender can call the courier. Phones are visible only to the two parties and only while the ride is live (tested). Item cost is paid outside the app; the courier carries what the sender hands over, does not buy.
Open risks: goods delivery may fall under separate rules from passenger transport (ask the lawyer); prohibited items are only a written rule today (no check); cash on delivery of item price is not handled; no courier opt-in yet (every driver sees delivery requests).
