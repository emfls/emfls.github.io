# Next Fifty GA4 Page Improvements Design

## Goal

Improve the next 50 existing revenue landing pages using the supplied GA4 landing-page report (2026-07-04 through 2026-07-31), while preserving each page's function, canonical URL, GA4 tag, and AdSense publisher ID.

## Selection

Use descending recent sessions after excluding the 170 pages already covered by the prior GA4 batch manifests, the home page, privacy/contact pages, and non-content hubs.

- Tools and games (7): English 3D Dice, Japanese Tetris, English MBTI, Flappy Dot, Matrix Defense, Flag Quest, Block Breaker
- Camps (4): Gapyeong, Busan, Gongju, Goheung
- Visas (5): Nigeria, Russia, Uganda, Georgia, Malaysia
- Windows (2): error `0x80070306`, boot-time optimization
- Finance (2): GPT stock guide, 2026 dividend stocks
- Travel (30): Mostar, Kotor, Dodoma, Mecca, Nyaungshwe, Ashgabat, Urgench, Thai Nguyen, Vang Vieng, Ningbo, Alesund, Tiflet, Dalanzadgad, Yekaterinburg, Dammam, Warsaw, Lanzhou, Sakete, Kota Kinabalu, Meknes, Utsunomiya, La Lima, Sendai, Khabarovsk, Johor Bahru, Santa Rosa, Cairo, Giga, Can Tho, Dresden

The manifest is the authoritative exact list and must contain 50 unique, existing paths in five deterministic groups of ten.

## Page Contract

- Add marker `next-ga4-priority-2026-08-11` exactly once.
- Add purpose-aligned JSON-LD: `WebApplication`, `VideoGame`, or `WebPage`, with `dateModified` set to `2026-08-11` and the exact public URL.
- Preserve `G-QP5Q67GE5B` and `ca-pub-8830524482034754`.
- Protect responsive ad containers with `max-width:100%`.
- Add a concise related-content link to an existing local hub or sibling page.
- Do not rewrite or disable existing interactive behavior.

## Trust Copy

- Tools and games: explain browser, device, input, pseudorandom, and timing limitations; games are entertainment/practice.
- Camps: never imply that a location is automatically legal or free for camping; require onsite signs, land manager/local authority rules, weather, wildfire, water-level, and evacuation checks.
- Visas and travel: do not guarantee entry, safety, prices, transport, or opening hours; prioritize embassy, immigration, foreign ministry, airline, and local operator information. Flag conflict-sensitive destinations for same-day travel-advisory checks.
- Finance: educational, non-personalized, non-real-time information; require primary filings and licensed professional review where appropriate; no return claims.
- Windows: steps vary by build, device, and policy; require backups and a restore path before system changes.

## Verification and Rollout

Use five test-first batches of ten. Validate exact count, page existence, marker uniqueness, schema JSON, analytics/ads IDs, category copy, responsive ads, related links, HTML parsing, and repository-wide regression tests. Record the rollout and reevaluation date `2026-09-08`, commit to `main`, push, and confirm GitHub Pages deployment.

## Data Caveat

The prioritization uses a 28-day GA4 snapshot rather than live API data. It ranks observable recent demand but does not prove future traffic or AdSense revenue; the next decision should use refreshed GA4, Search Console, and AdSense exports on the reevaluation date.
