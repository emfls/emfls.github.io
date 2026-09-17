# P6 — Naver Controlled Opportunity Gate Scope Audit

## Finding

The previous demotion condition checked only that a fresh Naver snapshot existed. It therefore demoted every base `OPPORTUNITY`, including pages outside the TOP 30 and outside the camping cluster. The TOP_30_ONLY absence is not negative evidence.

## Cohort audit of 36 experiments

| cohort | count |
|---|---:|
| matched camping | 0 |
| matched non-camping | 0 |
| unmatched camping | 0 |
| unmatched non-camping | 36 |

All 36 rows had no Naver row and were non-camping. Their Naver channel was `NOT_AVAILABLE`; they had been incorrectly demoted solely because the snapshot was fresh.

## Contract and result

The controlled Naver gate now requires all of: fresh snapshot, camping cluster, row-level Naver `VERIFIED`, and base `OPPORTUNITY`. Missing TOP 30 rows remain outside Naver evidence scope and preserve their base classification. No content or snapshot values were changed.

Replay against the latest remote artifacts:

- Before: WINNER 1,360 / OPPORTUNITY 0 / EXPERIMENT 36 / INSUFFICIENT_DATA 17,668
- After: WINNER 1,360 / OPPORTUNITY 36 / EXPERIMENT 0 / INSUFFICIENT_DATA 17,668
- Candidate selection: 0 selected; no page was modified.

GA4 `totalAdRevenue`/`revenueMetric`, GSC page-level evidence, Naver 30/30 matching, native periods, cooldowns, and protected URLs remain unchanged.
