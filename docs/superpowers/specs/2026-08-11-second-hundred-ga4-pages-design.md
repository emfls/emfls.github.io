# Second Hundred GA4 Page Improvements Design

## Goal and Selection

Improve the next 100 existing landing pages from the supplied GA4 report (2026-07-04 through 2026-07-31) after excluding the 320 previously manifested pages, home/privacy/contact/hub pages, and the known-corrupt `mexico-merida.html` page. Sort by sessions descending and average engagement time descending for ties.

The exact manifest is authoritative. It begins with `kor/report/travel/sweden-stockholm.html`, ends with `kor/report/travel/korea-gokseong.html`, and contains 67 travel, 17 camping, 6 visa, 3 editorial/game articles, 3 tools, 2 cryptocurrency, and 2 finance pages.

## Approach

Continue the recommended observed-demand approach instead of Search Console impressions or topic concentration. Freeze the selection in a static manifest, divide it into ten groups of ten, and use a preflighted idempotent transformer so no partial batch is written.

## Contract

- Marker: `second-hundred-ga4-priority-2026-08-11`, exactly once.
- Review date `2026-08-11`; reevaluation date `2026-09-08`.
- Valid minified `WebApplication`, `VideoGame`, or `WebPage` JSON-LD with exact public URL.
- Preserve GA4 `G-QP5Q67GE5B`, AdSense `ca-pub-8830524482034754`, canonical URLs, and existing behavior.
- Add `max-width:100%` ad protection and a valid local related link.

## Trust Copy

- Travel/visa: entry, safety, transport, access, prices, and schedules can change; require same-day official checks. Baghdad and Nablus receive explicit conflict, border, consular-support, and government travel-advisory warnings.
- Camping: no automatic legal/free claim; onsite signs, land manager/local authority, weather, wildfire, water-level, and evacuation checks.
- Finance/cryptocurrency: educational, non-personalized, non-real-time, no return claims; disclose total-loss, volatility, liquidity, custody, contract, delisting, and regulatory risks where applicable.
- Tools: browser/device/input/local-processing limitations.
- Editorial/game articles: time-specific opinion or patch-dependent guidance, not an official permanent ranking.

## Verification and Rollout

Use ten test-first batches numbered 38 through 47. Verify exact manifest boundaries, uniqueness, file existence, marker, schema, category, GA4/AdSense, links, HTML parsing, inserted JSON parsing, idempotence, repository tests, and diff cleanliness. Record the work in the growth log, push `main`, and require successful GitHub Pages deployment.

## Data Caveat

The 28-day export reflects recent observed demand but does not guarantee future traffic, clicks, CPC, RPM, or AdSense revenue. Refresh GA4, Search Console, and AdSense evidence on `2026-09-08`.
