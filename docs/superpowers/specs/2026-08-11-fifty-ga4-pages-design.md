# Fifty GA4 Landing Pages Improvement Design

## Objective

Improve fifty existing pages selected in GA4 landing-page order after excluding already standardized pages and the low-revenue contact page. Preserve working interactive behavior, correct risky or overconfident claims, improve internal discovery and mobile advertising containment, and record a measurable reevaluation date without promising traffic or revenue.

## Scope

### Multilingual tools and games — 17 pages

1. `util/text-shuffle-sort/index.html`
2. `vn/util/dice3d/index.html`
3. `vn/util/text-shuffle-sort/index.html`
4. `ae/util/dice3d/index.html`
5. `cn/game/MBTI/index.html`
6. `cn/util/barcode/index.html`
7. `cn/util/compound-interest/index.html`
8. `cn/util/fin-calc/index.html`
9. `cn/util/ipa-convert/index.html`
10. `cn/util/text-cleaner/index.html`
11. `cn/util/time-diff/index.html`
12. `de/util/crc/index.html`
13. `game/2048/index.html`
14. `game/STOPat5/index.html`
15. `game/SnakeGame/index.html`
16. `game/SpeedTap/index.html`
17. `game/SurvivorMini/index.html`

### Korean articles and game — 3 pages

18. `kor/column/hand-foot-mouth-disease-isolation-quarantine-2026.html`
19. `kor/column/maple-planet-job-tier-guide-2026.html`
20. `kor/game/SnakeGame/index.html`

### Korean camping guides — 18 pages

21. `kor/report/camp/daebudo-camping.html`
22. `kor/report/camp/dangjin.html`
23. `kor/report/camp/geoje.html`
24. `kor/report/camp/gyeongsan.html`
25. `kor/report/camp/hadong.html`
26. `kor/report/camp/hoengseong.html`
27. `kor/report/camp/hongcheon.html`
28. `kor/report/camp/hwaseong.html`
29. `kor/report/camp/jangheung.html`
30. `kor/report/camp/jangseong.html`
31. `kor/report/camp/jangsu.html`
32. `kor/report/camp/jeongseon.html`
33. `kor/report/camp/mungyeong.html`
34. `kor/report/camp/namyangju.html`
35. `kor/report/camp/pohang.html`
36. `kor/report/camp/uljin.html`
37. `kor/report/camp/wonju.html`
38. `kor/report/camp/yanggu.html`

### Korean cryptocurrency guides — 12 pages

39. `kor/report/coin/0x0-guide.html`
40. `kor/report/coin/agon-guide.html`
41. `kor/report/coin/ame-guide.html`
42. `kor/report/coin/amino-guide.html`
43. `kor/report/coin/andr-guide.html`
44. `kor/report/coin/ap-guide.html`
45. `kor/report/coin/arb-guide.html`
46. `kor/report/coin/argus-guide.html`
47. `kor/report/coin/avaai-guide.html`
48. `kor/report/coin/axm-guide.html`
49. `kor/report/coin/bitcoin-guide.html`
50. `kor/report/coin/solana-guide.html`

## Shared contract

- Every page displays review date `2026-08-11` and contains purpose-appropriate JSON-LD: `WebApplication`, `VideoGame`, or `WebPage`.
- Preserve the existing GA4 ID `G-QP5Q67GE5B`, AdSense publisher `ca-pub-8830524482034754`, and existing functional scripts.
- Preserve valid canonical URLs and normalize directory canonicals to a trailing slash.
- Add responsive advertising containment using `max-width:100%` and overflow protection.
- Add at least two useful related internal links in the same language or content cluster.
- Do not add unsupported claims about accuracy, security, official status, guaranteed availability, health outcomes, investment returns, or revenue.

## Content-specific requirements

### Tools and games

- Randomizers and games must disclose browser pseudorandomness or device/browser/input dependence where relevant.
- Barcode pages must state that generated codes require checksum, format, print, and scanner verification for operational use.
- Finance tools must state that taxes, fees, institution rules, compounding assumptions, and rounding can change results.
- IPA conversion must be described as a study aid rather than authoritative phonetic transcription.
- CRC must be identified as an error-detection checksum rather than encryption or cryptographic integrity.
- Text tools must distinguish local input processing from ordinary analytics and advertising data collection and must state when an operation is not translation, proofreading, or cryptographic randomness.
- Games must be framed as entertainment rather than standardized reaction, personality, or skill measurement.

### Korean health and game articles

- The hand-foot-mouth article must not replace diagnosis or public-health instructions. It must direct readers to the Korea Disease Control and Prevention Agency and a clinician for symptoms, severe signs, childcare return, and isolation decisions.
- The MapleStory tier article must state that rankings are the author's time-specific opinion and can change with patches, equipment, server economy, and play style.
- Korean Snake must carry the same device-dependent, entertainment-only limitation as other game pages.

### Camping guides

- Parks, beaches, riversides, valleys, reservoirs, ports, rest areas, public parking lots, and scenic sites must not be presented as automatically legal or free campsites.
- The first-answer section must require checking on-site signs, managing authority guidance, weather, flood/fire conditions, parking, overnight stay, tent, cooking, and flame restrictions before use.
- Registered campsites and the Korea Tourism Organization's Go Camping service should be the default alternative where practical.
- Titles and headings must remove “complete,” “holy site,” or guaranteed-free framing where present.

### Cryptocurrency guides

- Price, market capitalization, exchange availability, token supply, roadmap, partnerships, yield, and regulation are time-sensitive and must not be presented as current guarantees.
- Each page must state that it is educational information, not investment advice, and that total loss, volatility, liquidity, smart-contract, custody, delisting, and regulatory risks may apply.
- Readers must be directed to project documentation, contract addresses, exchange notices, and relevant regulator guidance before acting.
- Avoid implying endorsement merely because a token appears on an exchange or data provider.

## Delivery and testing

- Split the pages into five deterministic batches of ten and create one focused contract test per batch.
- Tests verify exact scope, review date, schema, limitation keyword, related navigation, mobile ad containment, and preserved analytics/advertising IDs.
- Run the focused tests first and confirm they fail before page changes.
- After implementation, run all focused tests, the complete pytest suite, inline JavaScript syntax validation for pages containing scripts, JSON-LD parsing, local-link existence checks, HTML parsing, and `git diff --check`.
- Record the five batches in `docs/growth/2026-08-01-priority-rollout-log.md` with reevaluation date `2026-09-08`.
- Commit the exact scope to `main`, push, and inspect the GitHub Pages deployment workflow.

## Success criteria

- Exactly fifty selected pages satisfy the shared and content-specific contracts.
- Existing page functionality remains intact and automated tests pass.
- No new local link points to a missing file.
- The release is discoverable through existing hubs and related links without relying solely on sitemap crawling.
- Search, engagement, and AdSense effects are evaluated after sufficient crawl and usage time; no improvement is guaranteed by publication alone.
