# Next Hundred GA4 Page Improvements Design

## Goal

Improve the next 100 existing revenue landing pages selected from the supplied GA4 landing-page report for 2026-07-04 through 2026-07-31, after excluding the 220 pages already present in GA4 priority manifests and excluding the home, privacy, contact, and simple hub pages.

## Selection and Scope

The exact manifest is authoritative and contains the next 100 eligible pages in descending sessions, with average engagement time used as the deterministic secondary sort. The selected mix is:

- 64 travel pages
- 12 browser tools
- 9 visa pages
- 7 camping pages
- 3 cryptocurrency pages
- 2 games
- 1 health page
- 1 finance page
- 1 technology comparison article

The first target is `kor/report/travel/mongolia-darkhan.html`. The original ranked set included `mexico-merida.html`, but preflight found pre-existing embedded-document corruption, so that page is excluded from this safe bulk pass and replaced by the next eligible candidate, `turkey-samsun.html`. The manifest remains the exact boundary and contains 100 pages.

## Alternatives Considered

1. Recent GA4 sessions, recommended and selected: prioritizes pages with demonstrated current use and produces faster feedback.
2. Search Console impressions: useful for CTR work but does not prioritize pages already receiving onsite engagement.
3. Topic concentration: makes editorial work simpler but overweights one content family and weakens evidence-based ordering.

## Page Contract

- Insert marker `next-hundred-ga4-priority-2026-08-11` exactly once.
- Add valid minified JSON-LD with `dateModified` `2026-08-11`, exact public URL, and purpose type `WebApplication`, `VideoGame`, or `WebPage`.
- Preserve GA4 `G-QP5Q67GE5B`, AdSense `ca-pub-8830524482034754`, canonical URLs, and existing interactive behavior.
- Apply responsive ad protection with `max-width:100%`.
- Add a valid local related-content link.
- Split verification into ten deterministic batches of ten.

## Trust and Safety Copy

- Travel and visa: entry, safety, transit, price, opening hours, and access can change without notice. Require same-day checks with foreign ministries, embassies, immigration, airlines, and local operators. North Korea and other conflict-sensitive destinations require an explicit warning not to rely on the page for permission or safety.
- Camping: never imply automatic legal or free camping. Require onsite signs, land manager/local authority rules, weather, wildfire, water-level, and evacuation checks.
- Tools and games: explain device, browser, input, pseudorandom, local processing, and timing limitations; games are entertainment/practice.
- Cryptocurrency and finance: educational, non-personalized, non-real-time, no return claims; disclose volatility, liquidity, smart-contract, custody, delisting, regulatory, and total-loss risks as applicable.
- Health: informational only; current official guidance and clinician judgment take priority, with urgent-care red flags.
- Technology comparison: time-specific editorial comparison, not a permanent ranking; verify current official capabilities, pricing, privacy, and terms.

## Error Handling and Verification

The transformer must abort before a partial write if the manifest is not exactly 100 unique existing files or any file lacks `</body>`. A second run must change zero files. Tests validate marker uniqueness, schema, category, analytics and ads identifiers, responsive ads, local links, HTML/JSON parsing, and the repository-wide suite.

## Rollout

Record batches 28 through 37 and reevaluation date `2026-09-08`, commit to `main`, push, and require successful GitHub Pages deployment.

## Data Caveat

The ranking is based on a 28-day export rather than live API access. It indicates recent observed demand but does not guarantee future traffic, clicks, CPC, RPM, or AdSense revenue. Re-rank using refreshed GA4, Search Console, and AdSense data on the reevaluation date.
