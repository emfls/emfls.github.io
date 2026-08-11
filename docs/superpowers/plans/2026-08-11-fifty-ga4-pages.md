# Fifty GA4 Landing Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the approved trust, discovery, schema, and mobile-ad contract to exactly fifty existing GA4 landing pages.

**Architecture:** A single reviewed manifest defines the fifty paths, schema type, content category, and related hub. Five focused test files consume ten paths each. An idempotent bulk rewrite script adds one clearly marked trust block per page without changing existing functional scripts.

**Tech Stack:** Static HTML/CSS/JavaScript, JSON-LD, Python 3, unittest/pytest, Node.js

## Global Constraints

- Review date is `2026-08-11`; reevaluation date is `2026-09-08`.
- Preserve GA4 `G-QP5Q67GE5B`, AdSense `ca-pub-8830524482034754`, canonical URLs, and existing page behavior.
- Add purpose-specific `WebApplication`, `VideoGame`, or `WebPage` schema and responsive ad containment.
- Each page receives native-language or Korean limitation copy appropriate to tools, games, health, camping, or cryptocurrency.

---

### Task 1: Manifest and failing tests

**Files:**
- Create: `tests/fifty_ga4_manifest.py`
- Create: `tests/test_eighteenth_ga4_priority_batch.py`
- Create: `tests/test_nineteenth_ga4_priority_batch.py`
- Create: `tests/test_twentieth_ga4_priority_batch.py`
- Create: `tests/test_twenty_first_ga4_priority_batch.py`
- Create: `tests/test_twenty_second_ga4_priority_batch.py`

- [ ] Define exactly five non-overlapping batches of ten with exact path, schema, category, and related hub.
- [ ] Assert marker, review date, schema, category limitation, related navigation, mobile ad containment, GA4, and AdSense.
- [ ] Run the five tests and confirm they fail because the new marker is absent.

### Task 2: Idempotent fifty-page rewrite

**Files:**
- Create: `scripts/improve_fifty_ga4_pages.py`
- Modify: the fifty HTML files in the approved design.

- [ ] Generate category-specific trust copy and same-language related links from the reviewed manifest.
- [ ] Insert a single `ga4-priority-2026-08-11` block before `</body>` and refuse missing files or duplicate paths.
- [ ] Run the script once, rerun to prove idempotence, and run all five focused tests.

### Task 3: Records and complete verification

**Files:**
- Modify: `docs/growth/2026-08-01-priority-rollout-log.md`

- [ ] Record five batches, category corrections, and reevaluation date.
- [ ] Parse all fifty JSON-LD blocks, check scripts where present, validate local related links, run the complete pytest suite and `git diff --check`.
- [ ] Commit exact scope with message `Improve fifty GA4 landing pages`, push `main`, and inspect GitHub Pages deployment.
