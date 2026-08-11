# Next Thousand GA4 Page Improvements Design

## Goal and Selection

Improve the next 1,000 individual landing pages from the supplied GA4 export for 2026-07-04 through 2026-07-31. Exclude the 820 pages covered by batches 6–87, home/privacy/contact pages, section hubs, and known-corrupt `kor/report/travel/mexico-merida.html`. Deduplicate paths and sort by sessions, then average engagement time, both descending.

All 1,000 selected pages recorded one session in this 28-day snapshot. Split the immutable result into ten disjoint 100-page manifests. The first page is `kor/report/camp/free-camping-top20.html`; the final page is `kor/report/travel/chile-santiago.html`.

The combined scope contains 832 travel pages, 75 camping pages, 75 finance pages, 12 general articles, and 6 cryptocurrency pages.

## Contract

- Use ten markers `ga4-long-tail-01-priority-2026-08-11` through `ga4-long-tail-10-priority-2026-08-11`, once on each respective page.
- Review date `2026-08-11`; reevaluation date `2026-09-08`.
- Preserve GA4 `G-QP5Q67GE5B`, AdSense `ca-pub-8830524482034754`, canonical URLs, page language, and existing behavior.
- Add purpose-specific JSON-LD, responsive ad protection, category limitations, and an existing local section link.
- Preflight each complete 100-page manifest before writes and make every transform idempotent.

## Trust Rules

- Travel pages do not guarantee entry, safety, access, transport, prices, or schedules and require same-day official verification.
- Conflict-sensitive destinations explicitly disclaim permission and safety and prioritize government travel bans/advisories, borders, flights, communications, and consular availability.
- Camping pages do not imply free or legal camping and require onsite authority, weather, wildfire, water-level, and evacuation checks.
- Finance and cryptocurrency pages are non-personalized, non-real-time educational information, promise no return, and require original filings or official market/project sources.
- General health, policy, product, and service articles disclose time sensitivity and prioritize authoritative current sources.

## Verification and Rollout

Create ten contract tests, require marker-absence failures before HTML edits, then require `changed=100 skipped=0` and `changed=0 skipped=100` for each transform. Run full pytest, HTML and inserted JSON parsing, local-link existence, exact 1,000-page scope, and diff cleanliness. Record the rollout, push `main`, trigger Pages, and require the successful Pages SHA to equal remote `main`.

## Caveat

This is a long-tail quality pass, not evidence of near-term revenue impact. The 28-day snapshot does not guarantee future traffic, clicks, CPC, RPM, indexing, or AdSense revenue. Reevaluate on `2026-09-08`.
