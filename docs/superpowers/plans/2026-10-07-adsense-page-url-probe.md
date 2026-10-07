# AdSense PAGE_URL Probe Matrix Implementation Plan

> **For agentic workers:** Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Add an audit-only, five-case PAGE_URL API probe that records enough evidence to distinguish window, metric, and AdSense for Content applicability without changing regular collection first.

**Architecture:** Add an explicit probe CLI mode to the existing collector, reuse its OAuth and report request helpers, and write a summary plus raw per-probe responses under the supplied temp directory. A manual-only, read-only probe job in the existing AdSense collection workflow uploads the files once for seven days, so the workflow can be dispatched while testing the feature branch without merging it. The existing scheduled collection job keeps its write permission and snapshot commit step. The launch guard permits only the exact initial diagnostics blob and exact source/workflow transitions.

**Tech Stack:** Python 3, `urllib`, GitHub Actions, pytest/unittest.

**Spec:** User-provided PAGE_URL probe matrix and observability finalization brief (2026-10-07).

## Global Constraints

- Preserve complete-day ranges in the AdSense account timezone.
- Keep empty, missing, partial, and API-error results distinct; never turn absent PAGE_URL rows into zero revenue.
- Do not change scheduled 7-day collection before real probe evidence.
- Store all raw probe output under `$RUNNER_TEMP` and upload one seven-day artifact.
- Do not modify page content, ad placement, account settings, or `adsense-latest.json` in the final branch diff.
- Push only the feature branch; do not create a PR or merge `main`.

## Review Focus

- Missing rows or matched counts must remain unknown.
- API errors must not stop later independent probes or leak credentials.
- Warnings must downgrade evidence to partial and block a false account-limitation conclusion.
- URL and metric sample data must come only from returned direct AdSense rows.
- Future snapshot and ad-code changes must remain blocked by the launch guard.

---

### Task 1: Probe matrix, artifact workflow, and fail-closed guard

**Files:** `scripts/collect_adsense_snapshot.py`, `.github/workflows/adsense-collection.yml`, `scripts/content_launch_guard.py`, `tests/test_adsense_page_url_probe.py`, `tests/test_content_launch_guard.py`.

- [x] Write failing tests for exact query windows, metrics and filters, result metadata, partial/missing rows, API errors, classification, temp-only output, and the exact initial diagnostics addition.
- [x] Run the new tests and confirm they fail before implementation.
- [x] Add the audit-only CLI mode and manual read-only probe job in the existing workflow without changing the scheduled collection path.
- [x] Add exact blob checks for initial diagnostics and the approved collector transition.
- [ ] Run focused and full validation, run the launch guard against the latest main, then push the same branch.
- [ ] Dispatch the real probe matrix, inspect its single seven-day artifact, and change production PAGE_URL observation only if returned rows support it.
- [ ] Revalidate final diff, preserve latest-main `adsense-latest.json`, and stop before PR or main merge.
