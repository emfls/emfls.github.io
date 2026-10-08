# C01 candidate ID, URL, and content path binding

## Scope and baseline

This change closes the general candidate-ID-to-page fail-open in the final HTML launch guard. The verified starting `origin/main` was `66f75f5ed00c00cafae701234062ee2075101d95`; PR #57 was merged. No page HTML, ad placement, `data/page-scores.json`, or publication was changed.

## Trusted authority

The PR base commit SHA is the authority snapshot. CI passes `github.event.pull_request.base.sha`; the guard resolves that immutable commit, requires it to be an ancestor of the checked head, and reads launch records with `git show` from that commit. Current PR files cannot create launch authority.

- Keyword Hunter candidates require one matching base queue row in `READY_TO_LAUNCH` and `PAGE_REVIEW_READY`, one matching `keywords_master.csv` row eligible for a new page, and the exact URL produced by the base URL planner. These generated queue fields are base-pinned eligibility evidence, not a human approval created by the PR.
- External candidates require one exact opaque ID in the base external-candidate registry, exactly one base `readyToLaunch` entry, current `launch_readiness` approval, and a URL-to-`contentPath` mapping that agrees with the source record.
- Editorial decisions, publication history, the daily counter, protected experiments, protected winners, and duplicate registries come from the same base snapshot. PR-head decision records must preserve the base decision.
- Each manifest index binds one candidate ID, URL, content path, added HTML file, and the file's single canonical URL. Duplicate or ambiguous source IDs, URLs, paths, missing mappings, and unsafe URL identities fail closed.
- A PR that adds HTML while changing launch authority code or its workflow is blocked. Invalid or unknown daily-counter state consumes the full daily capacity. The maximum remains three pages per KST date.

The PR manifest and added HTML describe the proposed launch; they do not authorize it. Base queue/master and external-candidate records identify eligible candidates. The base editorial decision store is the explicit authority for HOLD, NO_NEW_PAGE, UPDATE_EXISTING, and YMYL `APPROVE`; an approval added only in the PR is rejected.

## Publication paths checked

- Keyword Hunter runs on a schedule and persists measurement/queue state. It checks that publication state and HTML did not change; it does not write HTML.
- Content index refresh rebuilds generated indexes after an HTML push; it does not author HTML.
- IndexNow submits URLs already present in a pushed change; it does not author HTML.
- No scheduled workflow that creates new HTML was found. New page content reaches the Pages branch through a main-branch change/merge. This PR contains no page HTML and remains unmerged. Since the existing protection lives in this PR until Control Tower review, keep new-HTML merges gated until the guard is approved and merged; no repository-wide pause was claimed.

## Regression and verification evidence

- The initial fail-open regression set reproduced the unsafe allowance before implementation; the added airport HOLD, YMYL, and NO_NEW_PAGE cases now fail closed while matched safe and explicitly approved candidates pass.
- Additional regressions were observed before fixes: an unparseable base counter was treated as zero, a percent-encoded alias of a published URL was not deduplicated, and an external source's explicit YMYL flag was ignored. Unknown counter state now consumes the cap, published URL aliases deduplicate, and flagged external YMYL candidates require matching base approval.
- Focused launch suite: 114 passed.
- Full unittest: 819 tests run, 3 skipped; remaining tests passed.
- Full pytest: 1,398 passed, 3 skipped.
- SEO QA: no new critical issues or warnings (current inventory: 767 critical and 420 warnings).
- Current-base launch guard: PASS with no errors.
- `git diff --check`: PASS.

## Review boundary

PR #56 remains open and untouched. Its only overlapping path is `.github/workflows/seo-qa.yml`: PR #56 changes the test-runner dependency line; this change updates the launch-guard step in a separate hunk. No page-performance or page-scores files are changed here. Recheck mergeability after both PRs are reviewed.

Candidate trust proves the repository had a valid, ready source record at the base revision; it does not independently revalidate external demand or grant Control Tower approval beyond the recorded editorial decision.
