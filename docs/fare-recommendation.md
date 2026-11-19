# KHERJA fare recommendation (pilot draft)

The passenger UI shows a suggested fare when a route distance is available from OSRM. The rider can still adjust the fare in 50 DZD increments; the negotiated offer flow and server-side locked accepted fare are unchanged.

Draft values (not market-researched and must be reviewed before launch):
- Car: 250 DZD base + 100 DZD/km.
- Motorcycle: 200 DZD base + 80 DZD/km.
- Minimum suggestion: 350 DZD.
- Round to nearest 50 DZD.
- If no route distance is available, fall back to 450 DZD for car and 350 DZD for motorcycle.

These are UI recommendations only, not an automatic price charge or a guarantee of driver acceptance. Delivery pricing remains unchanged.
