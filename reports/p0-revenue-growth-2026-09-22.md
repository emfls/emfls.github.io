# P0 Revenue Growth #02 — Opportunity Re-ranking and GSC Signal Retention

## Objective and constraint

The P0 target is a sustained AdSense 7-day average of about $3.41/day by 2026-10-22, from the recorded $1.71/day baseline. This change does not alter content or ads and does not claim direct revenue lift. It prevents GA4's daily regeneration from discarding the latest verified GSC evidence used to select revenue work.

## Source state

| Source | Period | Snapshot evidence |
|---|---|---|
| GA4 | 2026-08-25–2026-09-21 | `ga4-latest.json`, 2,960 rows, as-of 2026-09-22 |
| GSC | 2026-08-22–2026-09-18 | `gsc-latest.json`, 109 page rows, generated 2026-09-21 08:13 UTC |
| Naver | 2026-08-19–2026-09-17 | latest UI TOP-30 snapshot; 30 URLs, unchanged |

In checked-in `page-performance.json`, 0 of 19,064 pages retained Google `VERIFIED`; all were `NOT_CONNECTED`. The GSC snapshot itself had 109 valid page rows, 105 of which matched repository pages. Running the pipeline to temporary output paths with both GA4 and GSC inputs retained those rows and yielded WINNER 1,466 / OPPORTUNITY 37 / EXPERIMENT 0 / INSUFFICIENT_DATA 17,561. No checked-in generated data was overwritten.

## Candidate comparison (temporary regenerated artifact)

| Rank | Existing URL | Opportunity score | GSC impressions / clicks / CTR / position | GA4 views | Decision |
|---:|---|---:|---|---:|---|
| 1 | `/kor/report/visa/singapore.html` | 42.21 | 200 / 0 / 0% / 23.8 | 3 | Highest measured opportunity; absolute upside remains small and query mix is not in current page-level snapshot. Do not automatically resume blocked #01. |
| 2 | `/util/reading-time/` | 34.66 | 462 / 0 / 0% / 61.1 | 3 | Recently upgraded on 2026-09-20; insufficient post-change observation. |
| 3 | `/game/MBTI/` | 33.27 | 304 / 1 / 0.33% / 77.42 | 4 | Recently changed on 2026-09-20; poor position makes a snippet-only fix unsupported. |
| 4 | `/kor/report/visa/ukraine.html` | 22.11 | 37 / 2 / 5.41% / 5.95 | 3 | Recently changed on 2026-09-20; no immediate repeat edit. |
| 5 | `/kor/report/visa/togo.html` | 21.10 | 30 / 1 / 3.33% / 7.33 | 4 | Recently changed on 2026-09-20; preserve measurement window. |

The opportunity scores are repository prioritization outputs, not revenue estimates. AdSense URL revenue is unavailable; GA4 `totalAdRevenue` is not treated as URL-level AdSense revenue. Search page rows do not reveal query intent, so no title/body change is justified from this snapshot alone. Protected winners and active experiment URLs were excluded from modification.

## Selected lever and implementation

Selected lever: preserve latest GSC page signals when the daily GA4 workflow regenerates measurement artifacts.

Root cause: `.github/workflows/ga4-collection.yml` invoked `scripts/revenue_growth.py` without `--gsc-snapshot data/performance/gsc-latest.json`, unlike `.github/workflows/gsc-collection.yml`. The pipeline's existing merge implementation and integration regression already support this input; the workflow invocation was incomplete.

Change: pass the existing GSC snapshot into GA4 regeneration and add a regression test that both scheduled collection workflows supply the GSC snapshot. No data was fabricated; no page output, credential, ads, or content was changed.

## Measurement plan

After the branch is reviewed and the change reaches main, run `GA4 Collection` once. Confirm Google `VERIFIED` pages are retained in `data/page-performance.json`, GSC source/period remain the original snapshot metadata, the revenue classifier does not infer AdSense URL revenue, and the generated artifact validator passes. Compare opportunity counts against the corrected same-input baseline (37), not against the broken 0-opportunity artifact. Re-rank a single content lever only after current page/query evidence and protection checks are available.

Revenue outcome: not yet measured. This is measurement/decision integrity work, not a revenue lift claim.
