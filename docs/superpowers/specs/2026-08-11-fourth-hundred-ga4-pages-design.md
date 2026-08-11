# Fourth Hundred GA4 Page Improvements Design

## Goal and Selection

Improve the next 100 individual landing pages from the supplied GA4 export (2026-07-04 through 2026-07-31), excluding 520 previously manifested pages, home/privacy/contact pages, section hubs such as `/util/`, and known-corrupt `mexico-merida.html`. Sort by sessions and average engagement time descending.

The static manifest begins with `kor/report/travel/tajikistan-farkhor.html`, ends with `kor/report/travel/angola-lobito.html`, and contains 84 travel, 12 tools, 2 camping, 1 visa, and 1 finance page.

## Contract

- Marker `fourth-hundred-ga4-priority-2026-08-11`, exactly once.
- Review `2026-08-11`; reevaluate `2026-09-08`.
- Preserve GA4, AdSense, canonical URLs, and existing behavior.
- Add valid purpose JSON-LD, responsive ad protection, category copy, and an existing local link.
- Preflight all 100 files before writes and verify batches 58–67.

## Trust Rules

- Travel/visa: entry, safety, access, transit, prices, and schedules require same-day official verification.
- Iran, Ukraine, North Korea, Libya, Israel, Belarus, Russia, and other conflict-sensitive destinations: explicitly state that the page does not grant permission or guarantee safety; prioritize government travel bans/advisories and consular availability.
- Camping: do not imply automatic legal/free use; require onsite, authority, weather, wildfire, water-level, and evacuation checks.
- Finance: educational, non-personalized, non-real-time; verify issuer filings and market data; no return claim.
- Tools: browser/device/input/local-processing and file/privacy limitations as applicable.

## Verification and Rollout

Require test-first red/green, 100 changes then zero on rerun, full pytest, HTML and inserted JSON parsing, local-link existence, exact scope, and diff cleanliness. Record the batch, push main, trigger Pages if needed, and verify the successful Pages build SHA equals remote main.

## Caveat

The 28-day GA4 snapshot does not guarantee future traffic, CPC, RPM, clicks, or AdSense revenue. Refresh data on `2026-09-08`.
