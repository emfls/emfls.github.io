# Next Hundred GA4 Page Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Improve the next 100 GA4-ranked landing pages with page-type-specific trust, SEO, internal-link, analytics, and ad-safety contracts.

**Architecture:** Freeze the 100-page ranked selection in one manifest and divide it into ten deterministic batches. A single preflighted, idempotent transformer inserts a self-contained quality block before each closing body tag without replacing existing content or functionality.

**Tech Stack:** Static HTML/CSS/JavaScript, Python 3 standard library, unittest/pytest, GitHub Pages.

## Global Constraints

- Marker: `next-hundred-ga4-priority-2026-08-11`, exactly once per target.
- Review date: `2026-08-11`; reevaluation date: `2026-09-08`.
- Preserve GA4 `G-QP5Q67GE5B`, AdSense `ca-pub-8830524482034754`, canonical URLs, and interactive behavior.
- Use schema types `WebApplication`, `VideoGame`, or `WebPage` from the manifest.
- Every target receives category-specific trust copy, `max-width:100%` ad protection, and an existing local related link.
- Manifest contains exactly 100 unique existing files in ten batches of ten, bounded by Darkhan first and Samsun hundredth after excluding the preflight-corrupt Merida file.

---

### Task 1: Exact Manifest and Red Contracts

**Files:**
- Create: `tests/next_hundred_ga4_manifest.py`
- Create: `tests/next_hundred_ga4_contract.py`
- Create: `tests/test_twenty_eighth_ga4_priority_batch.py` through `tests/test_thirty_seventh_ga4_priority_batch.py`

**Interfaces:**
- Produces: `PAGES: list[tuple[str,str,str,str]]`, `BATCHES`, and `assert_batch(test, batch)`.

- [x] Build the 100-row manifest from the fixed GA4 order with path, schema type, trust category, and valid local hub.
- [x] Assert count, uniqueness, existence, first and last boundaries, marker uniqueness, review date, schema JSON, category, ad width, local link, GA4, and AdSense.
- [x] Run all ten focused modules and require ten failures caused by the missing marker.

### Task 2: Preflighted Idempotent Transformer

**Files:**
- Create: `scripts/improve_next_hundred_ga4_pages.py`
- Modify: exactly the 100 HTML files in `tests/next_hundred_ga4_manifest.py`

**Interfaces:**
- Consumes: `PAGES`.
- Produces: one insertion per target and `changed=N skipped=N`.

- [x] Preflight all 100 files before writing: exact unique count, file existence, and closing body tag.
- [x] Generate category-specific copy for travel, visa, camp, tool, game, coin, health, finance, and technology article.
- [x] Insert minified JSON-LD, responsive ad CSS, trust section, and the manifest's local link.
- [x] Require first run `changed=100 skipped=0`, second run `changed=0 skipped=100`, then require ten focused tests to pass.

### Task 3: Durable Record and Repository Verification

**Files:**
- Modify: `docs/growth/2026-08-01-priority-rollout-log.md`

**Interfaces:**
- Consumes: final manifest and verification results.
- Produces: batches 28–37 audit record and `2026-09-08` reevaluation instruction.

- [x] Record source period, 100-page category counts, safeguards, technical contract, data limitation, and reevaluation date.
- [x] Run `python3 -m pytest -q` and require the full suite to pass.
- [x] Parse every target as HTML, parse every inserted JSON-LD payload, verify all 100 local links exist, and require one marker per file.
- [x] Run `git diff --check` and inspect `git status --short` for exact planned scope.

### Task 4: Publish Main and Confirm Pages

**Files:**
- Commit all files created or modified by Tasks 1–3.

**Interfaces:**
- Produces: a main-branch commit and successful GitHub Pages workflow.

- [x] Commit with message `Improve next hundred GA4 landing pages`.
- [x] Push `main` to `origin`.
- [x] Watch the new `pages build and deployment` run and require success.
