# Fourth Hundred GA4 Page Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox syntax.

**Goal:** Improve the fourth 100-page GA4-ranked individual landing-page batch.

**Architecture:** Static 100-row manifest, ten test batches, and one preflighted idempotent transformer reusing established category copy with conflict overrides.

**Tech Stack:** Static HTML, Python 3, pytest, GitHub Pages.

## Global Constraints

- Marker `fourth-hundred-ga4-priority-2026-08-11` once per page.
- Exactly 100 unique pages; Farkhor first, Lobito last; exclude section hubs.
- Preserve GA4, AdSense, canonical and behavior; add schema, link, trust copy and responsive ads.

### Task 1: Tests

- [x] Create manifest, contract, and batch tests 58–67.
- [x] Run them and require ten marker-absence failures.

### Task 2: Application

- [x] Preflight 100 files, body tags, GA4 and AdSense.
- [x] Apply category/high-risk blocks once.
- [x] Require `changed=100 skipped=0`, then `changed=0 skipped=100`, and ten passing batch tests.

### Task 3: Verification

- [x] Record selection and safeguards in the growth log.
- [x] Run full pytest, HTML/inserted JSON/local-link checks, exact scope and diff checks.

### Task 4: Publish

- [ ] Commit as `Improve fourth hundred GA4 landing pages` and push main.
- [ ] Trigger or watch Pages and require its successful commit SHA to equal remote main.
