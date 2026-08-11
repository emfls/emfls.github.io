# Second Long-Tail Thousand Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the next 1,000 one-session Korean travel landing pages as ten safe 100-page batches.

**Architecture:** Generate ten immutable manifests after excluding all prior 1,820 targets. Reuse the proven contract and preflight transformer with a distinct second-series manifest namespace and markers 11–20.

**Tech Stack:** Static HTML, Python 3, pytest, GitHub Pages.

## Global Constraints

- Markers are `ga4-long-tail-11-priority-2026-08-11` through `ga4-long-tail-20-priority-2026-08-11`.
- Each manifest contains 100 unique existing travel pages and all ten are disjoint from prior manifests.
- Preserve GA4, AdSense, canonical URLs, Korean language, and behavior.
- Review 2026-08-11; reevaluate 2026-09-08.

### Task 1: Selection and red contracts

- [x] Generate ten second-series static manifests after all prior exclusions.
- [x] Create tests 98–107 covering markers, WebPage schema, travel category, hub link, GA4, and AdSense.
- [x] Require ten marker-absence failures before HTML changes.

### Task 2: Application

- [x] Extend the parameterized transformer with the second-series manifest and marker namespace.
- [x] Apply standard and conflict-sensitive travel blocks after 100-file preflight.
- [x] For each batch require `changed=100 skipped=0`, rerun for `changed=0 skipped=100`, and pass its test.

### Task 3: Verify and publish

- [x] Record scope, safeguards, long-tail caveat, and reevaluation date in the growth log.
- [x] Run full pytest, parse 1,000 HTML/JSON blocks, verify links, exact scope, and clean diffs.
- [ ] Commit as `Improve second long-tail thousand travel pages`, push `main`, and require a successful Pages SHA equal to remote `main`.
