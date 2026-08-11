# Ten Improvements and Ten New English Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve ten GA4 landing pages and publish ten tested English calculators.

**Architecture:** Two focused regression files define the existing-page and new-tool contracts. Existing HTML receives only trust, schema, navigation, canonical, and responsive-ad changes; each new tool remains a standalone static page with a pure calculation function and shared CSS.

**Tech Stack:** HTML5, CSS, browser JavaScript, JSON-LD, Python unittest/pytest, Node.js

## Global Constraints

- Use review date `2026-08-11`; preserve GA4 `G-QP5Q67GE5B` and AdSense `ca-pub-8830524482034754`.
- New tools use `<html lang="en">`, `/util/<slug>/` trailing-slash canonicals, and `../new-tools.css`.
- Never render user input with `innerHTML`; invalid inputs return `{error: string}`.
- Link all new tools from `util/index.html` and `util/sitemap.xml`.

---

### Task 1: Write and run failing contracts

**Files:**
- Create: `tests/test_seventeenth_ga4_priority_batch.py`
- Create: `tests/test_second_ten_new_revenue_tools.py`

- [ ] Assert the ten existing pages contain date, purpose schema, limitation, related navigation, and ad containment.
- [ ] Assert the ten new pages contain publication metadata and discovery links; execute their pure functions with literal expected results.
- [ ] Run both tests and confirm failures are caused by missing changes and files.

### Task 2: Improve ten existing pages

**Files:** the ten existing paths listed in the approved design.

- [ ] Normalize travel and visa trust copy, current schema/date, related links, and responsive ads.
- [ ] Add device/entertainment limitations and related games to Russian Snake.
- [ ] Run `tests/test_seventeenth_ga4_priority_batch.py` and confirm it passes.

### Task 3: Build ten English calculators

**Files:**
- Create: `util/hourly-salary-calculator/index.html`
- Create: `util/overtime-pay-calculator/index.html`
- Create: `util/commission-calculator/index.html`
- Create: `util/break-even-calculator/index.html`
- Create: `util/roi-calculator/index.html`
- Create: `util/electricity-cost-calculator/index.html`
- Create: `util/download-time-calculator/index.html`
- Create: `util/grade-calculator/index.html`
- Create: `util/weighted-average-calculator/index.html`
- Create: `util/recipe-scaler/index.html`

- [ ] Implement the exact pure-function interfaces and formulas from the approved design.
- [ ] Add forms, validation, live results, two schemas, limitations, privacy disclosure, and related links.
- [ ] Run calculation tests and confirm normal and invalid cases pass.

### Task 4: Discovery, records, verification, and release

**Files:**
- Modify: `util/index.html`
- Modify: `util/sitemap.xml`
- Modify: `docs/growth/2026-08-01-priority-rollout-log.md`

- [ ] Add all ten hub and sitemap links and record both batches with reevaluation date `2026-09-08`.
- [ ] Run focused tests, full pytest, JavaScript syntax, JSON-LD, HTML, local links, and `git diff --check`.
- [ ] Commit exact implementation files, push `main`, and inspect GitHub Pages deployment.
