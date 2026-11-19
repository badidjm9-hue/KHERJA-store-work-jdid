# Bugs
## BUG-1 (S3, fixed) women-only checkbox 13px target
Steps: open fare sheet at 390px, measure checkbox. Expected >= 44px. Actual 13px. Fix: label row 44px, box 24px. Test: X-2.
## BUG-2 (S3, fixed) driver-mode button announced as "mode" (English aria-label hid the visible text)
Steps: locate button by its visible name "وضع السائق" with a screen-reader role query. Expected found. Actual not found. Also call/share/online/otp labels were English-only. Fix: removed override on visible-text buttons, localised the rest via data-aria. Test: driver mode e2e, X-3.
## To check (not reproduced)
- Sheet drag on real touch devices (only tested with mouse emulation).
- Backdrop blur performance on low-end Android.
- Open: state is lost on refresh (by design for the prototype).
