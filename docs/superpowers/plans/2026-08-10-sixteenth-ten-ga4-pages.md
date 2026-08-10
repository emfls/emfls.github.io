# Sixteenth GA4 Priority Batch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the next ten GA4 travel landing pages without disturbing existing layout or analytics.

**Architecture:** Enforce a small page contract with one focused regression test. Modify only page metadata, first-answer trust copy, related navigation, and responsive ad CSS while retaining existing content and scripts.

**Tech Stack:** Static HTML, CSS, JavaScript, JSON-LD, Python unittest/pytest

## Global Constraints

- Use review date `2026-08-10` and `WebPage` schema.
- Preserve canonical URLs, GA4, and AdSense identifiers.
- Direct entry and safety decisions to current official sources.
- Apply `max-width:100%` advertising containment.

---

### Task 1: Add the focused failing contract

**Files:**
- Create: `tests/test_sixteenth_ga4_priority_batch.py`

- [ ] Test all ten pages for date, schema, limitation language, related navigation, and mobile ad containment.
- [ ] Run the focused test and confirm failure before page changes.

### Task 2: Improve the travel pages

**Files:**
- Modify: `kor/report/travel/israel-kiryat-malakhi.html`
- Modify: `kor/report/travel/korean-souvenir-foreigners-2026.html`
- Modify: `kor/report/travel/lebanon-sur.html`
- Modify: `kor/report/travel/mongolia-tsagaan-suvarga.html`
- Modify: `kor/report/travel/oman-duqm.html`
- Modify: `kor/report/travel/philippines-olongapo.html`
- Modify: `kor/report/travel/portugal-portimao.html`
- Modify: `kor/report/travel/russia-stpetersburg.html`
- Modify: `kor/report/travel/switzerland-interlaken.html`
- Modify: `kor/report/travel/switzerland-zurich.html`

- [ ] Normalize schema and titles, add current official-check copy and related links, and contain ads responsively.
- [ ] Run the focused test until it passes.

### Task 3: Record, verify, and publish

**Files:**
- Modify: `docs/growth/2026-08-01-priority-rollout-log.md`

- [ ] Record the batch and reevaluation date `2026-09-07`.
- [ ] Run the full suite, JavaScript and JSON-LD checks, link existence checks, and `git diff --check`.
- [ ] Commit the exact files and push `main`.
