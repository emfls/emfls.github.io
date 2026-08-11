# AdSense Safety Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove advertising from sensitive pages, configure consent and exclusions, and produce a reproducible 200-page travel quality audit.

**Architecture:** A focused Python transformer identifies approved sensitive paths and removes only AdSense-specific fragments. A separate audit script samples travel pages deterministically and emits machine-readable and human-readable results. AdSense account changes are made through the signed-in browser and recorded in the growth log.

**Tech Stack:** Python 3 standard library, pytest, static HTML, Google AdSense UI.

## Global Constraints

- Preserve GA4, page content, game logic, URLs, and navigation.
- Do not alter pages outside approved game and Korean policy/contact paths.
- Use dry-run inventory before writing and require idempotence.
- Do not add new dependencies.

---

### Task 1: Sensitive-page AdSense transformer

**Files:**
- Create: `tests/test_remove_sensitive_page_ads.py`
- Create: `scripts/remove_sensitive_page_ads.py`

**Interfaces:**
- Produces: `is_sensitive_path(path: Path) -> bool`, `remove_adsense(html: str) -> str`, and CLI `--root`, `--write`.

- [ ] **Step 1: Write failing tests** for approved paths, rejected paths, removal of loader/unit/push fragments, preservation of GA4/game code, and idempotence.
- [ ] **Step 2: Run** `pytest -q tests/test_remove_sensitive_page_ads.py` and confirm import/behavior failure.
- [ ] **Step 3: Implement** path selection, narrow fragment removal, empty ad-wrapper cleanup, dry-run reporting, and opt-in writes.
- [ ] **Step 4: Run** `pytest -q tests/test_remove_sensitive_page_ads.py` and confirm all tests pass.
- [ ] **Step 5: Execute** dry run, then write mode, then a second dry run that reports zero changes.

### Task 2: Travel quality sampler

**Files:**
- Create: `tests/test_audit_travel_sample.py`
- Create: `scripts/audit_travel_sample.py`
- Create: `docs/growth/2026-08-12-travel-quality-sample-200.csv`
- Create: `docs/growth/2026-08-12-travel-quality-sample-200.md`

**Interfaces:**
- Produces: deterministic sample rows with `path`, `language`, `text_chars`, `internal_links`, `canonical`, `classification`, and `reasons`.

- [ ] **Step 1: Write failing tests** for deterministic uniqueness, 200-row sizing, and classification thresholds.
- [ ] **Step 2: Run** `pytest -q tests/test_audit_travel_sample.py` and confirm expected failure.
- [ ] **Step 3: Implement** candidate discovery, seeded stratified sampling, measurements, classification, CSV output, and Markdown summary.
- [ ] **Step 4: Run** the focused tests and generate both audit artifacts.
- [ ] **Step 5: Validate** exactly 200 unique rows and reconcile summary totals to CSV.

### Task 3: Verification, account settings, and work log

**Files:**
- Modify: `docs/growth/2026-08-12-100-dollar-priority-and-adsense-safety.md`

**Interfaces:**
- Consumes: Task 1 counts, Task 2 audit totals, browser-side CMP and page-exclusion outcomes.

- [ ] **Step 1: Configure** the Google CMP with consent, refusal, and option-management choices, then publish for `emfls.github.io`.
- [ ] **Step 2: Add** Auto Ads exclusions for game sections and the three Korean policy/contact URLs.
- [ ] **Step 3: Run** focused tests, the existing repository test suite, and static AdSense inventory checks.
- [ ] **Step 4: Record** exact applied counts, limitations, verification output, and next measurement date in the growth log.
- [ ] **Step 5: Commit and push** all validated changes to `main` under the user's standing deployment approval.
