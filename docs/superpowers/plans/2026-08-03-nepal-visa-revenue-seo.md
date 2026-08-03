# Nepal Visa Search Improvement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish a current Nepal visa-on-arrival guide for Korean passport holders.

**Architecture:** Replace the stale visa catalogue with a static decision page linked to Nepal Immigration and the Embassy in Seoul. Parser-based tests protect the arrival flow, receipt semantics, measurement, structured data, and removal of volatile claims.

**Tech Stack:** HTML, CSS, vanilla JavaScript, JSON-LD, Python `unittest`

## Global Constraints

- Preserve canonical, GA4 `G-QP5Q67GE5B`, and AdSense `ca-pub-8830524482034754`.
- Use `2026-08-03` as the verification and modification date.
- Distinguish online form receipt from an issued visa.
- Do not retain unsupported work/study fees or processing times.

---

### Task 1: Regression tests
- [ ] Create `tests/test_nepal_visa_page.py` for Korean-passport intent, arrival flow, receipt validity, passport validity, contracts, official sources, and stale-claim removal.
- [ ] Run the focused tests and confirm expected failures.

### Task 2: Page replacement
- [ ] Replace `kor/report/visa/nepal.html` with the approved decision guide.
- [ ] Run focused tests, priority validator, and diff check.

### Task 3: Record and deploy
- [ ] Append the baseline and rollout record to the growth log.
- [ ] Run the full suite, commit, push `main`, and verify public HTML.

