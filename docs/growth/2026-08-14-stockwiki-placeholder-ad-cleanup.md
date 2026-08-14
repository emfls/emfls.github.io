# StockWiki placeholder ad cleanup — 2026-08-14

## Result

- Audited all 11 StockWiki pages previously reported as having three explicit ads each.
- Found 33 nonfunctional units using `ca-pub-XXXXXXXXXXXXXXXX`; none of the pages loaded the AdSense library or production publisher ID.
- Removed all 33 dead units, their push calls, ad-only spacing CSS, and the custom fixed-bottom mobile ad container.
- Preserved stock data, charts, filters, canonical URLs, navigation, and investment-risk disclaimers.

## Revenue and policy effect

This is revenue-neutral because the removed units could not serve ads. It improves mobile usability and removes a misleading fixed-bottom placement from the policy surface. Production AdSense was intentionally not enabled on these financial pages in this release.

## Guardrail

`tests/test_stockwiki_ad_safety.py` fixes the inventory at 11 pages and rejects reintroduction of placeholder clients, AdSense units, ad slots, or fixed-mobile ad markup. `scripts/remove_stockwiki_placeholder_ads.py` is deterministic and must report zero changes on a second run.
