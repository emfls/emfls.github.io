# Andong Camping Revenue SEO Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace unsupported wild-camping claims with a source-backed Andong campground and booking guide.

**Architecture:** Keep the static canonical page and measurement tags, define its new contract with unittest, replace the content in place, deploy to `main`, verify publicly, and log the 28-day baseline.

**Tech Stack:** Static HTML/CSS, JSON-LD, Python unittest, GitHub Pages, Search Console

## Global Constraints

- Do not claim unverified riverside, park, lake, or clearing locations permit free camping, car camping, cooking, or fires.
- Keep canonical, GA4 `G-QP5Q67GE5B`, AdSense `ca-pub-8830524482034754`, and recent check date `2026-08-02`.
- State that 계명산자연휴양림 야영장 is currently closed according to GoCamping and require rechecking.
- Prevent horizontal overflow at 375px, including automatic AdSense elements.

---

### Task 1: Define and prove the failing contract

**Files:** Create `tests/test_andong_camping_page.py`; consume `kor/report/camp/andong.html`; produce regression assertions.

- [ ] Write parser-backed tests for title/H1, canonical, measurement tags, date, official links, `WebPage`/`FAQPage`, mobile CSS, closure notice, and prohibited-claim removal.
- [ ] Run `python3 -m unittest tests.test_andong_camping_page -v` and confirm expected failures.
- [ ] Commit with `test: define Andong camping page contract`.

### Task 2: Implement and verify the official guide

**Files:** Modify `kor/report/camp/andong.html`; test with `tests/test_andong_camping_page.py`.

- [ ] Replace the page with the approved static design while preserving measurement identifiers.
- [ ] Run focused tests, `python3 -m unittest discover -s tests -v`, `python3 scripts/validate_priority_pages.py kor/report/camp/andong.html`, and `git diff --check`.
- [ ] Commit with `feat: refresh Andong camping revenue guide` and push `main`.

### Task 3: Public verification and growth log

**Files:** Modify `docs/growth/2026-08-01-priority-rollout-log.md`.

- [ ] Wait for GitHub Pages success and verify public desktop and 375px rendering, official links, analytics, and prohibited-claim absence.
- [ ] Inspect the URL in Search Console and request indexing; record quota failure exactly if encountered.
- [ ] Append source, validation, deployment, baseline, 28-day measures, and stop condition to the growth log.
- [ ] Commit with `docs: log Andong camping revenue rollout`, push `main`, and verify local/remote head equality.
