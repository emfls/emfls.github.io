# Second Hundred GA4 Page Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Improve the second 100-page GA4-ranked batch with type-specific trust, SEO, internal-link, analytics, and ad-safety contracts.

**Architecture:** Freeze exactly 100 paths in a static manifest and divide them into ten batches. Use one preflighted idempotent transformer to append a single isolated quality block without replacing existing behavior.

**Tech Stack:** Static HTML/CSS/JavaScript, Python 3 standard library, unittest/pytest, GitHub Pages.

## Global Constraints

- Marker `second-hundred-ga4-priority-2026-08-11`, exactly once.
- Review `2026-08-11`; reevaluate `2026-09-08`.
- Preserve GA4 `G-QP5Q67GE5B`, AdSense `ca-pub-8830524482034754`, canonical URLs, and behavior.
- Exactly 100 unique existing pages, Stockholm first and Gokseong last, in ten groups of ten.
- Every page has valid purpose schema, category copy, `max-width:100%`, and an existing local related link.

---

### Task 1: Manifest and Red Tests

**Files:** Create `tests/second_hundred_ga4_manifest.py`, `tests/second_hundred_ga4_contract.py`, and batch tests 38 through 47.

**Interfaces:** Produce `PAGES`, `BATCHES`, and `assert_batch(test, batch)`.

- [x] Generate the fixed 100 rows with path, schema, category, and local hub.
- [x] Assert count, boundaries, uniqueness, existence, marker, schema, category, ad width, link, GA4, and AdSense.
- [x] Run ten focused tests and require marker-absence failures.

### Task 2: Safe Idempotent Application

**Files:** Create `scripts/improve_second_hundred_ga4_pages.py`; modify the manifest's 100 HTML files.

**Interfaces:** Consume `PAGES`; print `changed=N skipped=N`.

- [x] Preflight count, uniqueness, existence, closing body, GA4, and AdSense before any write.
- [x] Insert category-specific copy, minified JSON-LD, responsive ad CSS, and local link.
- [x] Require first run `changed=100 skipped=0`, second `changed=0 skipped=100`, and ten focused tests passing.

### Task 3: Record and Verify

**Files:** Modify `docs/growth/2026-08-01-priority-rollout-log.md`.

**Interfaces:** Produce batches 38–47 audit trail and reevaluation instruction.

- [x] Record source period, category mix, safeguards, technical contract, and data limitation.
- [x] Run the full pytest suite.
- [x] Parse 100 HTML files and inserted JSON payloads, verify one marker and all local links.
- [x] Run `git diff --check` and verify exact target scope.

### Task 4: Publish

**Files:** Commit all Task 1–3 files.

**Interfaces:** Produce a main commit and successful Pages deployment.

- [x] Commit as `Improve second hundred GA4 landing pages`.
- [x] Push `main` and watch the Pages workflow to success.
