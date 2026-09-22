# CI Baseline Repair — GA4 Batch Contract Failures

Date: 2026-09-22
Repository: `emfls/emfls.github.io`
Base: `origin/main` — `11f3d74ad4a1586f0f6b034e2fb4f6d737ccc622`
Branch: `codex/ci-baseline-ga4-contract-repair`

## Result

The five pre-existing main-branch unittest failures were stale test contracts, not user-facing page regressions. No HTML or production content was changed.

## Failure classification

| Failing case | Observed evidence | Classification |
| --- | --- | --- |
| `test_forty_ninth_ga4_priority_batch` — `kor/report/visa/ukraine.html` | Marker occurs after the page's valid `WebPage` JSON-LD; canonical URL and `dateModified=2026-09-20` match. | `STALE_TEST_CONTRACT` |
| `test_ga4_priority_batch_075` — `kor/report/visa/togo.html` | Same positional mismatch; valid `WebPage` JSON-LD precedes marker and matches canonical/date contract. | `STALE_TEST_CONTRACT` |
| `test_twenty_third_ga4_priority_batch` — `game/MBTI/index.html` | Valid `WebApplication` JSON-LD precedes marker; canonical and `dateModified=2026-09-20` are correct. Recent MBTI main closure confirms its current page contract. | `STALE_TEST_CONTRACT` |
| `test_ga4_priority_batch_084` — `game/MarbleFlick/index.html` | Legacy manifest demanded a self-link. Dedicated MarbleFlick test and recent main closure require `Home → Games → Marble Flick`, with the `/game/` breadcrumb. | `STALE_TEST_CONTRACT` |
| `test_tenth_ga4_priority_batch` — `game/index.html` | Legacy test demanded literal `Related` and `max-width:100%`. The current hub's dedicated test/history require searchable/category-filtered 25-game cards and responsive flex/grid discovery. | `STALE_TEST_CONTRACT` |

## Changes

- Added a shared HTML-aware JSON-LD contract helper. It finds scripts by `type`, validates the expected top-level schema payload as JSON, matches its `url` to the page canonical, and checks `dateModified >= 2026-08-11`; schema script position relative to the GA4 marker is irrelevant.
- The existing batch contracts still assert marker exactly once, expected `@type`, trust category, responsive constraint, local hub link, GA4 ID, and AdSense ID.
- Updated the MarbleFlick batch manifest's expected hub to `/game/`.
- Replaced the game directory's obsolete literal label/fixed-width checks with checks for search, category controls, game cards, an existing child-game link, wrapping filters, and an auto-fit responsive grid.
- No test skipped/xfail'd; no CI guard changed; no page HTML, GA4/AdSense runtime, experiment, or winner changed.

## Validation

- Exact five unittest cases: PASS.
- MarbleFlick state/page/RSS + English game hub inventory suites: 8 passed.
- Full unittest: 694 passed.
- Full pytest: 1,006 passed.
- `git diff --check`: PASS.
- First GitHub Actions SEO QA run `35709859333`: the guard rejected the newly named `ga4_contract_helpers.py` with `MONETIZATION_OR_ANALYTICS_CHANGED`. No guard change was made; the shared helper was renamed `schema_contract_helpers.py` and the exact/full local suites were rerun successfully. PR #2 final SEO QA run `35712200413` succeeded, including full unittest 694 and full pytest 1,006, and was squash-merged as `16c88b0e426c8283f54c757b7721b225a93c49cb`. PR #1 was rebased to main and its new head passed SEO QA run `35714221956`.

## Relation to P0 Revenue Growth #02

This support work is complete and separate from PR #1. PR #1 revalidation passed after rebase; PR #1 itself remains open/draft pending the separately authorized merge and post-merge GA4 Collection validation. P0 #03 remains gated on that production validation.
