# Gongju Camping Search Improvement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace unsupported Gongju wild-camping claims with a current, official-source-backed campground reservation guide.

**Architecture:** Keep the page as one dependency-free static HTML document. Protect its reader-visible contract with parser-based unit tests, link users to official live inventory rather than duplicating volatile details, and record the rollout baseline in the growth log.

**Tech Stack:** HTML, CSS, vanilla JavaScript, JSON-LD, Python `unittest`

## Global Constraints

- Canonical URL remains `https://emfls.github.io/kor/report/camp/gongju.html`.
- GA4 ID remains `G-QP5Q67GE5B`; AdSense publisher remains `ca-pub-8830524482034754`.
- Do not describe unverified parking lots, riversides, bridges, parks, or heritage areas as free camping or car-camping sites.
- Use `2026-08-02` as the source verification and modification date.

---

### Task 1: Page contract regression test

**Files:**
- Create: `tests/test_gongju_camping_page.py`
- Test: `kor/report/camp/gongju.html`

**Interfaces:**
- Consumes: `PageParser` from `tests.test_gapyeong_camping_page`
- Produces: four tests covering intent, measurement/structured data, official sources, and unsupported claims

- [ ] Write tests requiring `공주 캠핑장`, `예약`, `등록 야영장`, canonical, GA4, AdSense, WebPage/FAQPage, mobile ad containment, six official links, and removal of `완전무료`/`차박최적` claims.
- [ ] Run `python3 -m unittest tests.test_gongju_camping_page -v`; confirm failures are caused by the existing unsupported page.
- [ ] Commit the failing regression test.

### Task 2: Static page replacement

**Files:**
- Modify: `kor/report/camp/gongju.html`
- Test: `tests/test_gongju_camping_page.py`

**Interfaces:**
- Consumes: official forest reservation, Go Camping, and Gongju City URLs
- Produces: responsive static guide with visible decision cards, `filterCamps()` and `toggleFAQ()`

- [ ] Replace the old six-location wild-camping list with the approved reservation-first information architecture.
- [ ] Add separate WebPage and FAQPage JSON-LD documents with `dateModified: 2026-08-02`.
- [ ] Preserve GA4 and AdSense and add `div[id^="aswift_"]` mobile overflow protection.
- [ ] Run `python3 -m unittest tests.test_gongju_camping_page -v`; confirm all focused tests pass.
- [ ] Run `python3 scripts/validate_priority_pages.py kor/report/camp/gongju.html` and `git diff --check`.

### Task 3: Rollout record and deployment

**Files:**
- Modify: `docs/growth/2026-08-01-priority-rollout-log.md`

**Interfaces:**
- Consumes: GSC baseline 0 clicks, 24 impressions, 0% CTR, average position 12.71
- Produces: durable source/change/test/deployment record

- [ ] Append baseline, corrections, official sources, verification results, indexing quota status, and 2026-08-30 reassessment date.
- [ ] Run `python3 -m unittest discover -s tests -v`, the priority validator, and `git diff --check`.
- [ ] Commit all implementation and log changes and push `main`.
- [ ] Verify the latest GitHub Pages build uses the new commit and the public HTML contains the new title, first answer, GA4, and AdSense IDs.

