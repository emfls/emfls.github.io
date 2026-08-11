# Third Hundred GA4 Page Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Improve the third 100-page GA4-ranked batch with trust, SEO, analytics, ad-safety, and internal-link contracts.

**Architecture:** Freeze 100 paths in a static manifest and ten test batches. A preflighted idempotent transformer reuses the established type-copy generator and adds stronger conflict, finance, health, and Windows handling.

**Tech Stack:** Static HTML/CSS/JavaScript, Python 3, unittest/pytest, GitHub Pages.

## Global Constraints

- Marker `third-hundred-ga4-priority-2026-08-11`, exactly once.
- Exactly 100 unique existing pages; Okakara first and AAPL 10-Q last.
- Preserve GA4, AdSense, canonical URLs, and behavior; add valid schema, local link, and `max-width:100%`.
- Review `2026-08-11`; reevaluate `2026-09-08`.

---

### Task 1: Manifest and Red Tests

**Files:** Create `tests/third_hundred_ga4_manifest.py`, contract helper, and batch tests 48–57.

- [x] Generate exact path/schema/category/hub rows and boundary assertions.
- [x] Assert marker, schema, category, GA4, AdSense, ad width, and link.
- [x] Run ten tests and require marker-absence failures.

### Task 2: Apply Safely

**Files:** Create `scripts/improve_third_hundred_ga4_pages.py`; modify exactly 100 manifest pages.

- [x] Preflight all files, closing body tags, GA4, and AdSense before writes.
- [x] Add category and high-risk copy, schema, responsive CSS, and local links.
- [x] Require runs `changed=100 skipped=0` then `changed=0 skipped=100` and ten green tests.

### Task 3: Record and Verify

**Files:** Modify `docs/growth/2026-08-01-priority-rollout-log.md`.

- [x] Record selection, counts, safeguards, caveat, and reevaluation.
- [x] Run full pytest, HTML/inserted JSON/link checks, exact target scope, and `git diff --check`.

### Task 4: Publish

- [x] Commit as `Improve third hundred GA4 landing pages` and push main.
- [x] Verify remote main SHA equals the latest successful Pages build SHA.
