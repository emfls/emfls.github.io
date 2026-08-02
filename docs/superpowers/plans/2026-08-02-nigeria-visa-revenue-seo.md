# Nigeria Visa Revenue SEO Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a current, official-source Korean passport Nigeria visa guide at the existing canonical URL.

**Architecture:** Define a static-page regression contract, replace unsupported content in place while preserving measurement and interactions, deploy to `main`, verify publicly, inspect indexing, and log the 28-day baseline.

**Tech Stack:** HTML/CSS/JavaScript, JSON-LD, Python unittest, GitHub Pages, Search Console

## Global Constraints

- Use Nigeria Immigration Service, Nigeria Embassy Seoul, Nigeria Federal Ministry of Health, and WHO as primary sources.
- Remove fixed fee, funds, processing-time, embassy-closure, and Korea-visa-portal claims.
- Keep canonical, GA4 `G-QP5Q67GE5B`, AdSense `ca-pub-8830524482034754`, search and FAQ interactions, and date `2026-08-02`.
- Prevent automatic-ad horizontal overflow at 375px.

---

### Task 1: Regression contract

**Files:** Create `tests/test_nigeria_visa_page.py`; consume `kor/report/visa/nigeria.html`.

- [ ] Test current title/H1, visa answer, official sources, structured data, measurements, interactions, mobile containment, and prohibited claim removal.
- [ ] Run the focused unittest and confirm expected failures.
- [ ] Commit `test: define Nigeria visa page contract`.

### Task 2: Official-source implementation

**Files:** Modify `kor/report/visa/nigeria.html` and test it.

- [ ] Replace the page with the approved answer-first guide.
- [ ] Run focused and full tests, priority-page validation, and `git diff --check`.
- [ ] Commit `feat: refresh Nigeria visa revenue guide`, push `main`, and wait for Pages success.

### Task 3: Public verification and log

**Files:** Modify `docs/growth/2026-08-01-priority-rollout-log.md`.

- [ ] Verify public desktop/375px output, interactions, official links, and measurements.
- [ ] Inspect Search Console and request indexing unless the already-confirmed daily quota remains exhausted.
- [ ] Record baseline, changes, sources, deployment, indexing, 28-day measures, and stop condition.
- [ ] Commit `docs: log Nigeria visa revenue rollout`, push, and verify remote `main`.
