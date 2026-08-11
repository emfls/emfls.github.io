# Next Two Hundred GA4 Page Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the next 200 GA4-ranked individual landing pages as two safe 100-page releases.

**Architecture:** Generate two static manifests from the supplied GA4 CSV after excluding the prior 620-page inventory. Test each ten-page slice, then run two preflighted idempotent transformers that reuse the established block builder with multilingual and high-risk overrides.

**Tech Stack:** Static HTML, Python 3, pytest, GitHub Pages.

## Global Constraints

- Markers `fifth-hundred-ga4-priority-2026-08-11` and `sixth-hundred-ga4-priority-2026-08-11` occur exactly once.
- Each manifest has exactly 100 unique existing files and the documented boundaries.
- Preserve GA4, AdSense, canonical URLs, language, and behavior.
- Review 2026-08-11; reevaluate 2026-09-08.

### Task 1: Selection and failing contracts

**Files:** Create `tests/fifth_hundred_ga4_manifest.py`, `tests/sixth_hundred_ga4_manifest.py`, two contract helpers, and batch tests 68–87.

- [x] Generate both manifests from the GA4 CSV using prior manifest and legacy batch exclusions.
- [x] Assert exact size, uniqueness, boundaries, existing files, category/schema/hub fields, and disjoint sets.
- [x] Run all twenty focused tests and require marker-absence failures before production edits.

### Task 2: Fifth hundred transformer

**Files:** Create `scripts/improve_fifth_hundred_ga4_pages.py`; modify the first 100 manifest pages.

- [x] Preflight all files, body closing tags, GA4, and AdSense before writes.
- [x] Apply localized category and conflict-sensitive limitation blocks with WebPage, WebApplication, or VideoGame JSON-LD.
- [x] Require `changed=100 skipped=0`, rerun for `changed=0 skipped=100`, then pass batch tests 68–77.

### Task 3: Sixth hundred transformer

**Files:** Create `scripts/improve_sixth_hundred_ga4_pages.py`; modify the second 100 manifest pages.

- [x] Preflight all files, body closing tags, GA4, and AdSense before writes.
- [x] Apply the same contract using the second immutable manifest and marker.
- [x] Require `changed=100 skipped=0`, rerun for `changed=0 skipped=100`, then pass batch tests 78–87.

### Task 4: Verification and publication

**Files:** Modify `docs/growth/2026-08-01-priority-rollout-log.md` and this plan.

- [x] Record selection, category counts, safeguards, data caveat, and reevaluation date.
- [x] Run full pytest, HTML/inserted-JSON/local-link validation, exact 200-page scope, and `git diff --check`.
- [ ] Commit as `Improve next two hundred GA4 landing pages`, push `main`, and require a successful Pages build whose SHA equals remote `main`.
