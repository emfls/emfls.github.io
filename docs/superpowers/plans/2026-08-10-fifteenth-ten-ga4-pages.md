# Fifteenth GA4 Priority Batch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the next ten existing GA4 landing pages up to the shared trust, discovery, and mobile-ad standard.

**Architecture:** A focused regression test defines page-level requirements. Each static page retains its current UI and scripts and receives only metadata, review copy, relevant limitations, internal links, and responsive advertising safeguards.

**Tech Stack:** Static HTML, CSS, JavaScript, JSON-LD, Python unittest/pytest

## Global Constraints

- Preserve all existing tool and game behavior.
- Use review date `2026-08-10`.
- Keep GA4 and AdSense identifiers unchanged.
- Use `WebApplication`, `VideoGame`, or `WebPage` according to page purpose.
- Apply `max-width:100%` to advertising containment.

---

### Task 1: Define and verify the failing contract

**Files:**
- Create: `tests/test_fifteenth_ga4_priority_batch.py`

- [ ] Assert review date, schema, limitation copy, related navigation, and mobile ad containment for all ten pages.
- [ ] Run `python3 -m pytest tests/test_fifteenth_ga4_priority_batch.py -q` and confirm failure on the existing pages.

### Task 2: Improve all ten pages

**Files:**
- Modify: `jp/util/caseconverter/index.html`
- Modify: `kor/game/ConnectFour/index.html`
- Modify: `kor/report/camp/geumsan.html`
- Modify: `kor/report/camp/gunsan.html`
- Modify: `kor/report/camp/yangpyeong.html`
- Modify: `kor/report/camp/yeongdong.html`
- Modify: `kor/report/stock/2025/skhynix-000660.html`
- Modify: `kor/report/travel/chile-laserena.html`
- Modify: `kor/report/travel/china-urumqi.html`
- Modify: `kor/report/travel/estonia-tallinn.html`

- [ ] Add current review metadata and purpose-appropriate schema.
- [ ] Add content-specific limitations and related links without changing functional scripts.
- [ ] Add responsive ad containment and rerun the focused test until it passes.

### Task 3: Record, verify, and publish

**Files:**
- Modify: `docs/growth/2026-08-01-priority-rollout-log.md`

- [ ] Record the batch and reevaluation date `2026-09-07`.
- [ ] Run the full test suite, JavaScript syntax validation, JSON-LD parsing, internal-link existence checks, and `git diff --check`.
- [ ] Commit the exact batch and push `main`.
