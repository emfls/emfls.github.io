# Third Hundred GA4 Page Improvements Design

## Goal and Selection

Improve the next 100 landing pages from the supplied GA4 export for 2026-07-04 through 2026-07-31. Exclude the 420 previously manifested pages, home/privacy/contact/hub pages, and known-corrupt `mexico-merida.html`; sort by sessions and average engagement time descending.

The static manifest is authoritative, beginning with `kor/report/travel/namibia-okakara.html` and ending with `report/sec/aapl-10q-202603.html`. It contains 76 travel, 7 tools, 6 camping, 3 visa, 3 editorial/game articles, 3 finance/SEC, 1 health, and 1 Windows page.

## Contract

- Marker `third-hundred-ga4-priority-2026-08-11`, exactly once.
- Review `2026-08-11`; reevaluate `2026-09-08`.
- Purpose schema `WebApplication`, `VideoGame`, or `WebPage` with exact URL.
- Preserve GA4 `G-QP5Q67GE5B`, AdSense `ca-pub-8830524482034754`, canonical URLs, and behavior.
- Add responsive ad protection and a valid local related link.
- Preflight all files and split tests into batches 48 through 57.

## Trust Rules

- Travel/visa: require same-day official checks for entry, safety, transit, prices, and access. Israel, Ukraine, Iraq, Venezuela, Belarus, and other conflict-sensitive destinations receive stronger government-advisory and consular-support warnings.
- Camping: no automatic legal/free claim; check onsite rules, authorities, weather, wildfire, water levels, and evacuation.
- Finance/SEC: educational, non-personalized, non-real-time; verify issuer filings and current market data; no return claim.
- Health: official guidance and clinician judgment take priority; include urgent-care red flags.
- Windows: backup and restore path before system changes.
- Tools/articles: browser/device/input limitations or patch/time-specific editorial scope.

## Verification and Rollout

Require red-green tests, first run 100 changes and second run zero, full pytest, HTML and inserted JSON parsing, link existence, exact scope, and diff cleanliness. Record the batch in the growth log, push main, and verify the Pages build commit equals the new main commit.

## Caveat

The 28-day snapshot does not guarantee future traffic, clicks, CPC, RPM, or AdSense revenue. Refresh GA4, Search Console, and AdSense data on `2026-09-08`.
