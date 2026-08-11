# Final GA4 Inventory Page Improvements Design

## Goal and Selection

Improve every remaining eligible landing page from the supplied GA4 export for 2026-07-04 through 2026-07-31. Exclude all 2,820 previously improved pages, home/privacy/contact pages, section hubs, and known-corrupt `kor/report/travel/mexico-merida.html`.

The immutable remainder contains exactly 2,739 one-session pages: 2,634 travel, 59 finance, 37 general articles, 5 tools, and 4 visa pages. Split it into 27 manifests of 100 pages and one final manifest of 39 pages. The first page is `kor/report/travel/israel-karmiel.html`; the final page is `util/textcrypto/index.html`.

## Contract

- Use markers `ga4-final-01-priority-2026-08-11` through `ga4-final-28-priority-2026-08-11` once on their respective pages.
- Review date `2026-08-11`; reevaluation date `2026-09-08`.
- Preserve GA4 `G-QP5Q67GE5B`, AdSense `ca-pub-8830524482034754`, canonical URLs, page language, and existing behavior.
- Add purpose-specific JSON-LD, responsive ad protection, category limitations, and an existing local section link.
- Preflight each complete manifest and make every transform idempotent; accept 39 pages only for batch 28.

## Trust Rules

- Travel and visa pages do not guarantee entry, safety, access, transport, prices, or schedules; require same-day official verification.
- Conflict-sensitive destinations explicitly disclaim travel permission and safety and prioritize government advisories, borders, flights, communications, and consular availability.
- Finance is non-personalized, non-real-time educational material and promises no return; require original filings and current market sources.
- General articles disclose time sensitivity and prioritize authoritative current sources.
- Browser tools disclose device, browser, input, local-processing, and privacy limitations.

## Verification and Rollout

Create contract tests 108–135 and require marker-absence failures before HTML edits. For batches 1–27 require `changed=100 skipped=0` then `changed=0 skipped=100`; for batch 28 require `changed=39 skipped=0` then `changed=0 skipped=39`. Run full pytest, parse all 2,739 HTML and inserted JSON blocks, verify local links, exact scope, and clean diffs. Record the rollout, push `main`, trigger Pages, and require the successful Pages SHA to equal remote `main`.

## Caveat

All remaining pages recorded one session. Completing this inventory does not guarantee future traffic, indexing, clicks, CPC, RPM, or AdSense revenue. Reevaluate on `2026-09-08`.
