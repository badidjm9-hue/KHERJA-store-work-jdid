# Brand: Kherja (خرجة)

Angle: you name the price, and the ride is honest. Fair fare, verified drivers, support that answers.
Name meaning: "kherja" = a going-out, an outing (Algerian dialect). Short, easy in AR/FR/EN. Chosen 2026-11-08 over Wasla, which is confusingly close to the live app Wasila (see brand-review.md).

## Name checks (screening only, not legal clearance)
| check | status |
| --- | --- |
| US/EU/DZ trademark (class 9, 42, 39) | to run |
| WIPO Global Brand Database | to run |
| domain (kherja.dz, kherja.app, getkherja.com) | to run |
| App Store / Play exact name | to run |
| handles X, Instagram, TikTok | to run |
| web search "Kherja ride app" | to run |
Fallback names if taken: Rakbi, Mizan, Tamen (screened by web search only).

## Palette (not the original's lime and black)
Primary burnt orange `#C2410C` (dark mode `#FB923C`), teal `#0F766E` for fares and money (dark `#5EEAD4`), warm neutrals. Changed 2026-11-08 at the owner's request (v1 was indigo). Different family from the original's lime. See design/tokens.json.

## Logo brief
- Idea: a route line bending into a speech bubble, two points A and B joined by one curve = a deal between two people.
- Mark: symbol + wordmark. Symbol must read at 16px.
- Deliverables: SVG, 1024 app icon (no transparency), favicon set, 1200x630 social image.
- Must not resemble the original: no lime, no "iD" letterform, no rounded-square with letters.
- v1 placeholder: simple inline SVG route-curve mark in the app.

## Voice
Three words: direct (not blunt), warm (not chatty), fair (not salesy).
| do | don't |
| --- | --- |
| "اقترح سعرك" | "عرض خاص لك!!" |
| "3 سائقين وافقوا" | "تم العثور على نتائج" |
| "السائق وصل" | "تم تحديث الحالة" |
Fresh strings live in app/i18n.js (AR, FR, EN).

## Sweep
`python3 sweep.py . --config replica/brand.json` runs before launch (skill folder script).
