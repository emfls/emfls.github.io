# P7 — 36 OPPORTUNITY Measurement-only Prioritization

## Current state

- WINNER 1,360; OPPORTUNITY 36; EXPERIMENT 0; INSUFFICIENT_DATA 17,668.
- Active experiments: 3 (`nonsan`, `cheorwon`, `uljin`); available slots: 0.
- `select_improvements()` remains capped at three total slots, so selected candidates remain 0 until existing experiments are evaluated.

## 36 OPPORTUNITY audit

- All 36 are GSC-backed and Naver `NOT_AVAILABLE` because they are outside the TOP 30; none is Naver-backed.
- GA4 evidence exists on 18/36 pages; verified URL-level ad revenue is present on 0/36 (values are zero or missing, never treated as failure).
- GSC totals: 2,078 impressions and 6 clicks. CTR is calculated from the retained GSC fields; the distribution includes many zero-click rows and positions ranging from 3.4 to 76.91.
- No candidate is camping-cluster Naver evidence. Naver absence was not used as negative evidence.

## Priority table — READY_AFTER_SLOT_RELEASE (top 10)

| rank | URL | score | GSC imp/click/CTR/pos | GA4 views/revenue | status | rationale |
|---:|---|---:|---|---|---|---|
| 1 | `/kor/report/visa/singapore.html` | 27.46 | 231 / 0 / 0.0% / 22.47 | 1 / 0.0 | READY | highest impressions among candidates; position leaves ranking and intent questions to inspect |
| 2 | `/kor/report/visa/ukraine.html` | 22.11 | 37 / 2 / 5.4% / 5.78 | 1 / 0.0 | READY | strong position and observed clicks; inspect query/title alignment before any change |
| 3 | `/kor/report/travel/australia-adelaide.html` | 22.00 | 9 / 0 / 0.0% / 17.89 | MISSING | HOLD | low volume and no GA4 page evidence |
| 4 | `/kor/report/visa/san-marino.html` | 21.93 | 4 / 1 / 25.0% / 11.0 | 2 / 0.0 | WATCH | high observed CTR but very small sample |
| 5 | `/kor/report/visa/togo.html` | 20.98 | 28 / 1 / 3.6% / 7.46 | 2 / 0.0 | READY | page-one evidence with measurable clicks; low volume requires cautious validation |
| 6 | `/game/MBTI/` | 20.68 | 295 / 2 / 0.7% / 76.91 | 3 / 0.0 | WATCH | high impressions but poor position; not a snippet-only conclusion |
| 7 | `/game/FlagQuest/` | 20.41 | 3 / 0 / 0.0% / 27.33 | 6 / 0.0 | HOLD | insufficient search volume |
| 8 | `/kor/report/obbb/` | 19.91 | 2 / 0 / 0.0% / 25.50 | MISSING | HOLD | insufficient search volume and no GA4 page evidence |
| 9 | `/kor/report/stock/` | 19.91 | 2 / 0 / 0.0% / 13.50 | 1 / 0.0 | HOLD | insufficient search volume |
| 10 | `/kor/report/travel/australia-goldcoast.html` | 19.91 | 2 / 0 / 0.0% / 14.00 | MISSING | HOLD | insufficient search volume and no GA4 page evidence |

The remaining 26 are `WATCH` or `HOLD` due to low volume, weak position, missing GA4 evidence, or insufficient evidence to isolate a snippet problem. `/util/reading-time/` (score 19.89, 527 impressions, position 61.77) is explicitly WATCH rather than a top candidate because its evidence indicates a ranking issue, not an isolated CTR issue. Scores are retained as a secondary signal, not the sole ranking criterion.

## Top 3 preflight

1. `/kor/report/visa/singapore.html` — current page was inspected for title, meta description, H1, canonical, analytics, AdSense, verification, and sitemap presence. Primary evidence is 231 GSC impressions at position 22.47 with no clicks. Hypothesis: query/page-intent alignment needs inspection; not yet proven to be a title problem.
2. `/kor/report/visa/ukraine.html` — 37 impressions, 2 clicks, 5.4% CTR, position 5.78. Primary question is whether the existing snippet accurately matches the query intent; do not change content based on this sample alone.
3. `/kor/report/visa/togo.html` — 28 impressions, 1 click, 3.6% CTR, position 7.46. Low-volume page-one evidence supports a later controlled review, not an immediate edit.

Preflight found no authorization for content changes; no title, meta, H1, body, canonical, sitemap, link, or experiment state was changed.

## Excluded / protected

`/kor/report/camp/nonsan.html`, `/kor/report/camp/cheorwon.html`, and `/kor/report/camp/uljin.html` remain observing through 2026-09-29. `/kor/report/camp/namyangju.html` and `/kor/report/camp/gyeonggi-best.html` remain observation-locked. None is selected.

## Slot release

- Current active experiments: 3; available slots: 0.
- Earliest re-evaluation: 2026-09-30.
- The date does not trigger automatic edits; existing experiment outcomes must be evaluated first.
