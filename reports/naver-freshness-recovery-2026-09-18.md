# P5 Wave 7 — Naver Search Advisor Snapshot Freshness Recovery

## Finding

- Naver data is available only as a manually captured `NAVER_SEARCH_ADVISOR_UI_TOP_30` snapshot; the repository has no official URL-performance collection client or workflow.
- The official Search Advisor API documentation found in this audit covers crawl-request submission/verification, not URL-performance reporting. The existing snapshot therefore remains `MANUAL_EXPORT_ONLY` / `NO_OFFICIAL_API` for this metric.
- Snapshot period: 2026-08-01 through 2026-08-30; `dataUpdatedAt`: 2026-08-30. At the pipeline as-of date 2026-09-18 it is stale under the existing 7-day freshness policy.

## Contract change

Naver row metrics and native period metadata remain preserved. `snapshot_freshness()` now returns `VERIFIED`, `STALE_DATA`, or `NOT_AVAILABLE`; missing and invalid update dates never become verified. Stale or unverifiable Naver data is excluded from the controlled Naver opportunity gate and no longer demotes fresh Google candidates to `EXPERIMENT`. The cross-source warning remains `PERIOD_MISMATCH`.

## Quantified impact

Using the latest GA4/GSC artifacts and the checked-in Naver snapshot, the previous classification was WINNER 1,360 / OPPORTUNITY 0 / EXPERIMENT 36 / INSUFFICIENT_DATA 17,668. With stale Naver excluded from the gate, the expected replay is WINNER 1,360 / OPPORTUNITY 36 / EXPERIMENT 0 / INSUFFICIENT_DATA 17,668. This is a classification-safety change, not a claim that Naver data is current.

## Next action

Obtain a fresh Naver Search Advisor export and add its dated snapshot; do not overwrite the existing artifact or fabricate dates.
