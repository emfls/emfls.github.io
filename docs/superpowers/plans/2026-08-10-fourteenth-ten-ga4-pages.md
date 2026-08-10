# Fourteenth GA4 Priority Batch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve ten existing GA4 landing pages without changing their working game or tool behavior.

**Architecture:** Apply a page-level content contract through a focused regression test. Each HTML page keeps its existing implementation and receives only metadata, trust copy, related navigation, and responsive advertising safeguards appropriate to its content type.

**Tech Stack:** Static HTML, CSS, JavaScript, JSON-LD, Python unittest/pytest

## Global Constraints

- Preserve existing game and tool behavior.
- Use review date `2026-08-10`.
- Keep GA4 and AdSense identifiers unchanged.
- Use `VideoGame`, `WebApplication`, or `WebPage` schema according to page purpose.
- Prevent ad containers from exceeding the viewport.

---

### Task 1: Add the batch contract

**Files:**
- Create: `tests/test_fourteenth_ga4_priority_batch.py`

- [ ] Write a test covering review date, schema, limitation copy, related navigation, and mobile ad containment for all ten pages.
- [ ] Run `python3 -m pytest tests/test_fourteenth_ga4_priority_batch.py -q` and confirm it fails because the pages do not yet meet the contract.

### Task 2: Improve the ten pages

**Files:**
- Modify: `fr/game/2048/index.html`
- Modify: `kor/report/camp/damyang.html`
- Modify: `ru/util/dice3d/index.html`
- Modify: `kor/report/camp/cheongju.html`
- Modify: `kor/report/camp/gwangju-g.html`
- Modify: `kor/report/visa/romania.html`
- Modify: `kor/report/camp/gimpo.html`
- Modify: `cn/util/qrcode/index.html`
- Modify: `game/PONGvsAI/index.html`
- Modify: `game/ZombieSurvival/index.html`

- [ ] Add the exact schema and review date required by the contract.
- [ ] Add content-specific limitations and useful related links while retaining working controls and scripts.
- [ ] Add `max-width:100%` containment to advertising elements.
- [ ] Run the focused test and confirm it passes.

### Task 3: Record and verify the rollout

**Files:**
- Modify: `docs/growth/2026-08-01-priority-rollout-log.md`

- [ ] Record the ten pages, trust changes, and reevaluation date `2026-09-07`.
- [ ] Run the complete pytest suite, JavaScript syntax checks, JSON-LD parsing, and `git diff --check`.
- [ ] Commit only this batch and push `main`.
