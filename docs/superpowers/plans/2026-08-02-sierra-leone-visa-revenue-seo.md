# Sierra Leone Visa Search Improvement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish an official-source-backed Sierra Leone visa guide for Korean passport holders.

**Architecture:** Replace the volatile visa catalogue with one static decision guide, protected by parser-based regression tests and linked to live government application systems.

**Tech Stack:** HTML, CSS, vanilla JavaScript, JSON-LD, Python `unittest`

## Global Constraints

- Preserve canonical, GA4, AdSense, and `2026-08-02` freshness.
- Describe eVisa approval and terminal issuance exactly as the government portal does.
- Do not publish unsupported fixed fees, processing times, or permit durations.

---

### Task 1: Regression tests
- [ ] Create `tests/test_sierra_leone_visa_page.py` for Korean-passport intent, eVisa flow, yellow-fever guidance, contracts, official links, and stale-claim removal.
- [ ] Run the test and confirm expected failures.

### Task 2: Page replacement
- [ ] Replace `kor/report/visa/sierra-leone.html` with the approved decision guide.
- [ ] Run focused tests, the priority validator, and diff check.

### Task 3: Record and deploy
- [ ] Append the baseline and rollout record to the growth log.
- [ ] Run the full suite, commit, push `main`, and verify the public page.

