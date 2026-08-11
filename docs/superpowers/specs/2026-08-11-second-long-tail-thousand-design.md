# Second Long-Tail Thousand Travel Page Improvements Design

## Goal and Selection

Improve the next 1,000 individual landing pages from the supplied GA4 export for 2026-07-04 through 2026-07-31. Exclude all 1,820 pages covered by batches 6–97, home/privacy/contact pages, section hubs, and known-corrupt `kor/report/travel/mexico-merida.html`. Deduplicate paths and sort by sessions, then average engagement time, both descending.

All selected pages recorded one session in the snapshot and all are Korean travel pages. Split the immutable result into ten disjoint 100-page manifests. The first page is `kor/report/travel/chile-talca.html`; the final page is `kor/report/travel/israel-jerusalem.html`.

## Contract

- Use markers `ga4-long-tail-11-priority-2026-08-11` through `ga4-long-tail-20-priority-2026-08-11`, once on their respective pages.
- Review date `2026-08-11`; reevaluation date `2026-09-08`.
- Preserve GA4 `G-QP5Q67GE5B`, AdSense `ca-pub-8830524482034754`, canonical URLs, page language, and existing behavior.
- Add WebPage JSON-LD, responsive ad protection, travel limitations, and an existing travel-hub link.
- Preflight each complete 100-page manifest and make every transform idempotent.

## Trust Rules

- Do not guarantee entry, safety, local access, transport, prices, schedules, or business availability.
- Require same-day checks of government travel advisories, embassy/immigration rules, airlines, transport operators, and booking providers.
- For conflict-sensitive destinations, explicitly disclaim travel permission and safety and prioritize travel bans/advisories, borders, flights, communications, and consular availability.
- Use the same conflict-sensitive token policy as the previous approved batches, including Israel at the final boundary.

## Verification and Rollout

Create ten contract tests for batches 98–107, require marker-absence failures before HTML edits, then require `changed=100 skipped=0` and `changed=0 skipped=100` per batch. Run full pytest, parse all 1,000 HTML and inserted JSON blocks, verify local links, exact scope, and clean diffs. Record the rollout, push `main`, trigger Pages, and require the successful Pages SHA to equal remote `main`.

## Caveat

This is another one-session long-tail quality pass. It does not guarantee future traffic, indexing, clicks, CPC, RPM, or AdSense revenue. Reevaluate on `2026-09-08`.
