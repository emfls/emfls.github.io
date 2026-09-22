# P0 Revenue Growth #02 — Opportunity Re-ranking and GSC Signal Retention

## Objective and constraint

The P0 target is a sustained AdSense 7-day average of about $3.41/day by 2026-10-22, from the recorded $1.71/day baseline. This change does not alter content or ads and does not claim direct revenue lift. It prevents GA4's daily regeneration from discarding the latest verified GSC evidence used to select revenue work.

## Source state

| Source | Period | Snapshot evidence |
|---|---|---|
| GA4 | 2026-08-25–2026-09-21 | `ga4-latest.json`, 2,960 rows, as-of 2026-09-22 |
| GSC | 2026-08-23–2026-09-19 | latest `gsc-latest.json`, 110 page rows, generated 2026-09-22 07:57 UTC |
| Naver | 2026-08-19–2026-09-17 | latest UI TOP-30 snapshot; 30 URLs, unchanged |

At starting live main `9f7fb892b0`, 0 of 19,064 pages retained Google `VERIFIED`; all were `NOT_CONNECTED`, while its GSC snapshot had 109 page rows and 105 URL matches. Before this implementation was pushed, a later GSC workflow commit advanced live main to `11f3d74ad4`, refreshing the snapshot to 110 rows / 106 URL matches and restoring Google signals; this confirms the loss occurs specifically on a subsequent GA4-only regeneration. Running the pipeline on the latest GA4 and GSC snapshots to temporary outputs yielded WINNER 1,466 / OPPORTUNITY 38 / EXPERIMENT 0 / INSUFFICIENT_DATA 17,560. No checked-in generated data was overwritten.

## Candidate comparison (temporary regenerated artifact)

| Rank | Existing URL | Opportunity score | GSC impressions / clicks / CTR / position | GA4 views | Decision |
|---:|---|---:|---|---:|---|
| 1 | `/kor/report/visa/singapore.html` | 42.17 | 195 / 0 / 0% / 23.6 | 3 | Highest current score; absolute upside is small and current artifact has no query mix. Do not automatically resume blocked #01. |
| 2 | `/kor/report/travel/australia-adelaide.html` | 36.38 | 6 / 0 / 0% / 14.67 | 1 | Very low current impressions and views; insufficient upside evidence. |
| 3 | `/kor/report/stock/` | 35.41 | 3 / 0 / 0% / 12.33 | 3 | Tiny search sample; finance-content YMYL review would be needed. |
| 4 | `/kor/report/obbb/` | 34.91 | 2 / 0 / 0% / 25.5 | — | Insufficient current sample. |
| 5 | `/kor/report/travel/australia-perth.html` | 34.91 | 2 / 0 / 0% / 14.5 | — | Insufficient current sample. |

The opportunity scores are repository prioritization outputs, not revenue estimates. AdSense URL revenue is unavailable; GA4 `totalAdRevenue` is not treated as URL-level AdSense revenue. Search page rows do not reveal query intent, so no title/body change is justified from this snapshot alone. Protected winners and active experiment URLs were excluded from modification.

## Selected lever and implementation

Selected lever: preserve latest GSC page signals when the daily GA4 workflow regenerates measurement artifacts.

Root cause: `.github/workflows/ga4-collection.yml` invoked `scripts/revenue_growth.py` without `--gsc-snapshot data/performance/gsc-latest.json`, unlike `.github/workflows/gsc-collection.yml`. The pipeline's existing merge implementation and integration regression already support this input; the workflow invocation was incomplete.

Change: pass the existing GSC snapshot into GA4 regeneration and add a regression test that both scheduled collection workflows supply the GSC snapshot. No data was fabricated; no page output, credential, ads, or content was changed.

## Measurement plan

After the branch is reviewed and the change reaches main, run `GA4 Collection` once. Confirm Google `VERIFIED` pages are retained in `data/page-performance.json`, GSC source/period remain the original snapshot metadata, the revenue classifier does not infer AdSense URL revenue, and the generated artifact validator passes. Compare opportunity counts against the corrected same-input baseline (38), not against the temporarily broken 0-opportunity artifact. Re-rank a single content lever only after current page/query evidence and protection checks are available.

Revenue outcome: not yet measured. This is measurement/decision integrity work, not a revenue lift claim.
