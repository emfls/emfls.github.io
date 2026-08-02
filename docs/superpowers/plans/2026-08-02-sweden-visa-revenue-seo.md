# Sweden Visa Search Improvement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish a current Korean-passport Sweden entry guide backed by Swedish and EU official sources.

**Architecture:** Replace the stale catalogue with one responsive static decision page. Parser-based regression tests protect search intent, measurement, structured data, official-source links, and removal of time-sensitive false claims.

**Tech Stack:** HTML, CSS, vanilla JavaScript, JSON-LD, Python `unittest`

## Global Constraints

- Preserve canonical, GA4 `G-QP5Q67GE5B`, and AdSense `ca-pub-8830524482034754`.
- Use `2026-08-02` for source verification and modification.
- State that ETIAS starts in the last quarter of 2026 and requires no current traveller action.
- Do not copy volatile salary, fee, or processing-time values.

---

### Task 1: Regression contract

- [ ] Create `tests/test_sweden_visa_page.py` covering Korean-passport intent, 90/180 days, ETIAS status, canonical/measurement/JSON-LD, six official links, and stale claim removal.
- [ ] Run the focused test and confirm it fails on the old page.

### Task 2: Static guide

- [ ] Replace `kor/report/visa/sweden.html` with the approved first-answer, checklist, ETIAS, permit routing, sources, FAQ, and related links.
- [ ] Run the focused test, priority validator, and diff check.

### Task 3: Record and deploy

- [ ] Append baseline, changes, sources, tests, indexing quota, and reassessment date to `docs/growth/2026-08-01-priority-rollout-log.md`.
- [ ] Run the full suite, commit, push `main`, verify GitHub Pages and public HTML.

