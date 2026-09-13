# Controlled publication protocol (Phase 7-1)

Measurement, editorial decisions, and publication state remain separate. At most one supervised publication is allowed per local calendar day; keyword data never directly generates or pushes HTML.

## Transaction

1. Load measured state; build the bounded queue; apply HOLD/UPDATE_EXISTING.
2. Keep at most one candidate and require PAGE_REVIEW_READY.
3. A person creates content on a feature branch, runs tests and the launch guard, then rebuilds index/feed/sitemap.
4. Keep manifest REVIEW_ONLY until human review; on approval atomically set PUBLISHED, record the canonical keyword, and increment the counter.
5. Push main; require SEO QA and Pages success; verify live 200/canonical/title/instrumentation; recompute the queue.

## Fail-closed and idempotency

Tests, guard, SEO, Pages, and live checks are all required. Any missing/failed gate records no success. Canonical keyword+URL prevents duplicate publication records and counter increments; a new date starts with effective count zero, while queue preparation never mutates the counter. Queue preparation may be invoked after Keyword Hunter in the existing workflow; generated JSON paths and the bot guard prevent recursion. Scheduled publishing remains disabled.

Editorial decisions persist independently: `정수기추천`, `자동차점검비용` HOLD; `차량검사비용`, `정수기렌탈추천` UPDATE_EXISTING.
