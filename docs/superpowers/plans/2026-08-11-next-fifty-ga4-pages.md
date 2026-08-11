# Next Fifty GA4 Page Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Improve the next 50 GA4-ranked landing pages with page-type-specific trust, SEO, related-content, analytics, ad-safety, and verification contracts.

**Architecture:** Store the exact 50-page selection and page metadata in one manifest, verify it through five independent ten-page test modules, and run one idempotent transformer that inserts a single self-contained block before each closing body tag. Preserve all existing page behavior and verify the complete repository before deployment.

**Tech Stack:** Static HTML/CSS/JavaScript, Python 3 standard library, unittest/pytest, GitHub Pages.

## Global Constraints

- Marker: `next-ga4-priority-2026-08-11`, exactly once per target.
- Review date: `2026-08-11`; reevaluation date: `2026-09-08`.
- Preserve GA4 `G-QP5Q67GE5B` and AdSense `ca-pub-8830524482034754`.
- Use `WebApplication`, `VideoGame`, or `WebPage` according to the manifest.
- Every target must have responsive ad protection, category-specific trust copy, and a valid local related link.
- The manifest must contain exactly 50 unique existing files in five batches of ten.

---

### Task 1: Manifest and Failing Contracts

**Files:**
- Create: `tests/next_fifty_ga4_manifest.py`
- Create: `tests/next_fifty_ga4_contract.py`
- Create: `tests/test_twenty_third_ga4_priority_batch.py`
- Create: `tests/test_twenty_fourth_ga4_priority_batch.py`
- Create: `tests/test_twenty_fifth_ga4_priority_batch.py`
- Create: `tests/test_twenty_sixth_ga4_priority_batch.py`
- Create: `tests/test_twenty_seventh_ga4_priority_batch.py`

**Interfaces:**
- Produces: `PAGES: list[tuple[str,str,str,str]]`, `BATCHES`, and `assert_batch(test, batch)`.

- [x] Write the exact 50-row manifest with path, schema type, trust category, and related local path.
- [x] Write contract assertions for file existence, marker uniqueness, review date, valid minified JSON-LD, category marker, responsive ad width, local related link, GA4, and AdSense.
- [x] Run the five focused tests and confirm they fail because `next-ga4-priority-2026-08-11` is absent.

### Task 2: Idempotent Page Improvement

**Files:**
- Create: `scripts/improve_next_fifty_ga4_pages.py`
- Modify: the exact 50 HTML files in `tests/next_fifty_ga4_manifest.py`

**Interfaces:**
- Consumes: `PAGES`.
- Produces: one insertion per target and summary `changed=N skipped=N`.

- [x] Implement locale/category-specific copy for tool, game, camp, visa, travel, finance, and Windows pages.
- [x] Insert minified JSON-LD, responsive ad CSS, trust section, and valid related link before `</body>`.
- [x] Run the transformer once and require `changed=50 skipped=0`.
- [x] Run it again and require `changed=0 skipped=50`.
- [x] Run the five focused tests and require all five to pass.

### Task 3: Audit Trail and Full Verification

**Files:**
- Modify: `docs/growth/2026-08-01-priority-rollout-log.md`

**Interfaces:**
- Consumes: final manifest and verification outputs.
- Produces: durable batches 23–27 record and reevaluation date.

- [x] Record the 50 targets, selection period, category safeguards, technical changes, and `2026-09-08` reevaluation date.
- [x] Run `python3 -m pytest -q` and require the complete suite to pass.
- [x] Parse every inserted JSON-LD block and validate all 50 related local targets exist.
- [x] Run `git diff --check` and confirm only the planned files changed.

### Task 4: Publish and Confirm

**Files:**
- Commit all files from Tasks 1–3.

**Interfaces:**
- Produces: main-branch commit and successful GitHub Pages deployment.

- [x] Commit with message `Improve next fifty GA4 landing pages`.
- [x] Push `main` to `origin`.
- [x] Watch the triggered `pages build and deployment` run and require success.
