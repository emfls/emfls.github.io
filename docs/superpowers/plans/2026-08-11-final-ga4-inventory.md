# Final GA4 Inventory Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve all 2,739 remaining eligible GA4 landing pages.

**Architecture:** Generate 28 immutable manifests after excluding every prior 2,820-page target. Reuse the contract and preflight transformer with a final-series namespace; batches 1–27 contain 100 pages and batch 28 contains 39.

**Tech Stack:** Static HTML, Python 3, pytest, GitHub Pages.

## Global Constraints

- Markers are `ga4-final-01-priority-2026-08-11` through `ga4-final-28-priority-2026-08-11`.
- The manifests are mutually disjoint and total exactly 2,739 pages.
- Preserve GA4, AdSense, canonical URLs, page language, and behavior.
- Review 2026-08-11; reevaluate 2026-09-08.

### Task 1: Selection and red contracts

- [x] Generate 27 100-page manifests and one 39-page manifest after all prior exclusions.
- [x] Create tests 108–135 for marker, schema, category, hub link, GA4, and AdSense.
- [x] Require 28 marker-absence failures before HTML changes.

### Task 2: Application

- [x] Extend the transformer with the final-series namespace and variable final length.
- [x] Apply category and high-risk blocks after full-manifest preflight.
- [x] Require exact changed/skipped counts on first and second run, then pass all 28 focused tests.

### Task 3: Verify and publish

- [x] Record the final inventory scope, safeguards, caveat, and reevaluation date.
- [x] Run full pytest, parse 2,739 HTML/JSON blocks, verify links, exact scope, and clean diffs.
- [ ] Commit as `Improve all remaining GA4 landing pages`, push `main`, and require a successful Pages SHA equal to remote `main`.
