# P5 Wave 4 — GA4 Revenue Semantics & Classification Sanity Audit

- `totalRevenue` includes purchase, subscription, and advertising revenue; it is not URL-level AdSense revenue.
- Collector now requests `totalAdRevenue`, records `revenueMetric`, aggregates normalized URL rows, and uses a separate no-dimension request for site users/views/revenue.
- Latest snapshot: 2,515 rows, 2,488 normalized URLs, 2,453 repo matches, 12 duplicate keys affecting 27 extra rows, 1,377 positive, 1,138 zero, 0 missing.
- Before: 1,353 WINNER, 0 OPPORTUNITY. All 1,353 WINNER rows were GA4-only; AdSense was `NOT_CONNECTED`.
- Legacy snapshots without `revenueMetric=totalAdRevenue` can no longer create WINNER. A credentialed workflow run is required for post-change generated counts; no values were fabricated locally.
- Official metric contract: https://developers.google.com/analytics/devguides/reporting/data/v1/api-schema
