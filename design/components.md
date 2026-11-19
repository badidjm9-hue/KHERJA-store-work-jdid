# Components

Button: variants primary, secondary, ghost, danger; sizes md 48px, lg 56px; states default, pressed (scale .97 on pointer-down), focus-visible (2px accent ring), disabled, loading. Real <button>.
Fare stepper: big number, +/- steps of 10 DA, hold to repeat, haptic-style scale pulse; shows recommended fare and min/max band; clamps with rubber-band shake.
Offer card: price (fare color), ETA, distance, car + plate, rating, trips; accept button; enters with spring from bottom; interruptible.
Bottom sheet: drag handle, snaps at peek/half/full using projected momentum, rubber-band past ends, translucency with blur.
Chip: payment, notes. Toast. Segmented control for language. Rating stars (keyboard operable). SOS button: long-press 1s, visible progress ring.
Map: SVG canvas with grid streets, pickup/drop pins, moving car marker (transform only).
Empty / loading / error states for every list.
A11y: RTL aware (logical properties), min 44px targets, aria-live for offers, reduced motion respected.

## Phase 3.1 initial glass layer
Vehicle choice: two accessible selectable cards (car / motorcycle), `aria-pressed` state, subtle frosted surface, clear selected outline and checkmark; hidden for delivery requests. The selected ride vehicle is sent as `vehicle_type` and enforced by the backend feed and offer endpoint.
