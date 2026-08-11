# Next Two Hundred GA4 Page Improvements Design

## Goal and Selection

Improve the next 200 individual landing pages from the supplied GA4 export (2026-07-04 through 2026-07-31). Exclude all 620 pages covered by batches 6–67, home/privacy/contact pages, section hubs, and known-corrupt `kor/report/travel/mexico-merida.html`. Deduplicate landing paths and sort by sessions, then average engagement time, both descending.

Use two immutable 100-page manifests. Batch five begins with `cn/util/age/index.html` and ends with `jp/game/STOPat5/index.html`; batch six begins with `jp/report/travel/bangladesh-dhaka.html` and ends with `kor/report/camp/danyang.html`.

The combined scope contains 50 general articles, 44 travel pages, 27 visa pages, 23 games, 22 browser tools, 21 camping pages, 7 finance pages, and 6 cryptocurrency pages.

## Contract

- Markers `fifth-hundred-ga4-priority-2026-08-11` and `sixth-hundred-ga4-priority-2026-08-11`, exactly once on their respective pages.
- Review date `2026-08-11`; reevaluation date `2026-09-08`.
- Preserve GA4 `G-QP5Q67GE5B`, AdSense `ca-pub-8830524482034754`, canonical URLs, page language, and existing behavior.
- Add valid purpose-specific JSON-LD, responsive ad protection, category limitations, and an existing local section link.
- Preflight each full 100-page manifest before any writes and make both transforms idempotent.

## Trust and Language Rules

- Travel and visa pages do not guarantee entry, safety, access, transit, prices, or schedules; require same-day verification from government, embassy, immigration, airline, and operator sources.
- Conflict-sensitive destinations explicitly disclaim permission and safety and prioritize travel bans, advisories, border/flight status, communications, and consular availability.
- Camping pages do not imply free or legal camping; require onsite authority, weather, wildfire, water-level, and evacuation checks.
- Finance and cryptocurrency pages are non-personalized, non-real-time educational material, do not promise returns, and require original filings or official project/market sources.
- Tools and games disclose browser, device, input, local-processing, randomness, timing, and privacy limitations.
- Korean, Japanese, Chinese, Russian, and English-facing pages receive limitation copy appropriate to their existing page language; no page language is replaced.
- General articles state their time sensitivity and direct readers to authoritative current sources where the subject can change.

## Verification and Rollout

Require red/green tests for twenty ten-page batches numbered 68–87, `changed=100` then `changed=0` for both transforms, full pytest, HTML and inserted JSON parsing, local-link existence, exact 200-page scope, and clean diffs. Record the work in the growth log, push `main`, trigger Pages if needed, and require the successful Pages SHA to equal remote `main`.

## Caveat

The 28-day GA4 snapshot does not guarantee future traffic, clicks, CPC, RPM, or AdSense revenue. Refresh the ranking and outcomes on `2026-09-08`.
