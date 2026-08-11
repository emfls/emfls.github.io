# Next Thousand GA4 Page Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the next 1,000 GA4-ranked long-tail landing pages as ten safe 100-page batches.

**Architecture:** Generate ten immutable manifests from the supplied GA4 CSV after excluding the prior 820-page inventory. Use one contract helper, ten focused tests, and one parameterized preflighted transformer with ten thin batch invocations.

**Tech Stack:** Static HTML, Python 3, pytest, GitHub Pages.

## Global Constraints

- Markers are `ga4-long-tail-01-priority-2026-08-11` through `ga4-long-tail-10-priority-2026-08-11`.
- Each manifest contains exactly 100 unique existing files; all ten are disjoint.
- Preserve GA4, AdSense, canonical URLs, page language, and existing behavior.
- Review 2026-08-11; reevaluate 2026-09-08.

### Task 1: Selection and red contracts

- [x] Generate ten static manifests from GA4 after prior-page, hub, privacy/contact, and corrupt-page exclusions.
- [x] Create one contract test per 100-page manifest covering markers, schema, category, links, GA4, and AdSense.
- [x] Run all ten tests and require marker-absence failures before editing HTML.

### Task 2: Parameterized application

- [x] Create a transformer that preflights 100 files before writing and accepts batch number 1–10.
- [x] Apply category and high-risk limitation blocks with WebPage JSON-LD and responsive ad protection.
- [x] For every batch require `changed=100 skipped=0`, rerun for `changed=0 skipped=100`, and pass its contract test.

### Task 3: Verification and publication

- [x] Record the ten batches, scope, safeguards, data caveat, and reevaluation date in the growth log.
- [x] Run full pytest, parse all 1,000 HTML and inserted JSON blocks, verify local links, exact scope, and `git diff --check`.
- [ ] Commit as `Improve next thousand GA4 landing pages`, push `main`, and require a successful Pages build whose SHA equals remote `main`.
