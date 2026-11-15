# Exact CTR proposal batch for review

The owner requested an isolated content branch and PR for the supplied exact replacements. This branch applies 3,264 changed HTML files, with every source blob and declared output blob checked. Each registered pair is applied once, in order, and reverses to the original bytes. It does not change the replacement contract to make conflicting proposals pass.

The frozen input SHA-256 is `24f80b1130d60e664540c5e78ab5100cf9b2084a93bb0d64e074d2d453e628c9`. The content base is `28483b71058601932be16546d945826be1a81018`, after approval-only PR #804 registered 32 exact protected transitions. The hourly publisher's intervening changes are retained. No protection ledger, observations, schedules or account settings are changed here.

## Count reconciliation and holds

The input contains 3,325 proposal rows: seven already-merged rows are skipped, leaving 3,318 active rows for 3,313 unique paths. These counts do not establish 3,318 changed files. The held or unchanged 54 active rows cover 49 unique paths:

| Reason | Rows | Unique paths |
| --- | ---: | ---: |
| Conflicting alternatives for the same path | 10 | 5 |
| Declared output does not match first-occurrence replacement | 37 | 37 |
| Source index changed upstream | 1 | 1 |
| Newly invalid JSON-LD | 1 | 1 |
| Newly malformed body links | 4 | 4 |
| No byte change | 1 | 1 |
| Total | 54 | 49 |

No alternative is selected implicitly, repeated strings are not replaced globally, and the changed index is not overwritten. The invalid JSON-LD and four malformed link outputs are excluded. These require corrected input or an explicit decision on the replacement contract before another patch.

## Review findings

- The supplied replacements also include visible prose and CSS cleanup; this is broader than a metadata-only patch. Executable scripts, ad attributes, canonical URLs and date fields remain unchanged in the applied set. Year strings in copy are not evidence that the underlying advice has been refreshed.
- Eight pages remove existing valid internal tool links: the CSAT result guide removes three calculator links, and seven glamping guides remove a powerbank-calculator link. These registered changes are included for review, without a claim that the targets were broken or that removal improves revenue.
- Exact-base site comparison finds zero new critical issues, **five new duplicate warnings** (four title groups and one description group, across eight unique pages), and 165 broken links both before and after. The warnings are retained explicitly; the audit is not a zero-warning certification. Existing issues are not relabelled as regressions or success.
- `git diff --check` reports 16 trailing-whitespace lines supplied in the exact outputs. They are retained to preserve the registered output blobs, rather than silently reformatted.
- The committed pinned Launch Guard returns **FAIL: `MONETIZATION_OR_ANALYTICS_CHANGED`**. Its path rule classifies `kor/report/coin/ads-guide.html` (an ADS coin guide) as an advertising path. This is the single reproduced trigger; that file's executable scripts and ad attributes are unchanged. No guard exception or pattern weakening is added in this content PR. The failed gate remains a merge blocker requiring separate review.

## Verification and limits

- All 3,264 applied files match the declared after blobs and frozen candidate SHA-256 values. Related protection/metadata/breadcrumb tests: 80 passed.
- The exact-base audit checks 19,540 raw HTML blobs, reuses parsed records only for identical bytes, and parses changed input. Parser errors and new critical issues are zero. Production-code and operating-evidence preservation checks pass within the recorded audit scope.
- Fresh localhost Chromium measurements cover 1,323 files at 320px and 390px: 2,646 verified document-width measurements fit. External ad and analytics requests are blocked by CSP. The other 1,941 files have supplied numeric assertions only; this is **not** an independent all-files Playwright certification or a test of real advertising behavior.
- An accidental duplicate browser loop invalidated an uncertain 120-file prefix. Both loops ended before a separate prefix recheck; the combined result replaces that prefix only, preserves the original error records, and verifies the measured source hashes. No public site was visited by those loops.

Keep this content PR in draft pending resolution of the input conflicts and review findings. PR creation, hosted checks, content merge, Pages deployment, indexing and search/revenue effects are separate states. This task creates the reviewable PR; it does not merge or publish this batch. Private reports and measurement data remain outside the public repository.

Rollback is a normal revert of the content commit; no ad/account change is part of this patch. The exact protected transitions remain bounded to the approved blobs, and any further protected revision requires its own review.
