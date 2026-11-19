# KHERJA Smart Pricing (initial launch policy)

The passenger-facing suggested fare is an affordability-oriented recommendation. Riders can still adjust their offered price; drivers can accept or counteroffer within the existing backend limits.

## Base formula
- Car: 250 DZD base + 60 DZD/km.
- Motorcycle: 200 DZD base + 20 DZD/km.
- Minimum suggested fare: 350 DZD.
- Round to nearest 50 DZD.

## Time adjustments (local device time)
- Ordinary daytime: car promo -5%; motorcycle promo -10%.
- Estimated rush-hour windows: 07:00–09:59 and 16:00–19:59, +10%.
- Night: 22:00–05:59, +15%.
- Adjustments are mutually exclusive by the current time windows; they do not compound.
- Rush-hour windows are heuristic, not live traffic data.

The fare is recalculated when route distance or vehicle type changes. If route distance is unavailable, the UI displays a fallback recommendation (450 DZD car / 350 DZD moto) rather than claiming a route-based calculation.

## Limitations before launch
- Time is currently taken from the device clock; production should calculate policy time on the server using `Africa/Algiers`.
- Traffic is estimated by schedule only. Do not advertise live traffic surge pricing until a verified live source is connected.
- Public OSM/Nominatim/OSRM endpoints are suitable for development and light use subject to their policies, not a guaranteed production SLA.
- Promotions should be monitored with driver earnings, rider conversion, cancellation, and trip-cost metrics before expanding.
