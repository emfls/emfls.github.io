# Gapyeong Camping Revenue SEO Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace unverified free wild-camping claims with a source-backed Gapyeong registered-campground and booking decision guide that can improve qualified search traffic and revenue safely.

**Architecture:** Keep the existing static single-page delivery, GA4, AdSense, and canonical URL. Replace the page contract and content in place, then validate locally, deploy directly to `main`, verify the public page, and record the 28-day measurement baseline.

**Tech Stack:** Static HTML/CSS, JSON-LD, Python `unittest`, GitHub Pages, Google Search Console

## Global Constraints

- Do not claim that an unverified riverside, valley, parking area, or clearing is free or permits camping, car camping, cooking, or fires.
- Remove the Yangpyeong Yongmunsan location from the Gapyeong page.
- Keep canonical `https://emfls.github.io/kor/report/camp/gapyeong.html`, GA4 `G-QP5Q67GE5B`, and AdSense `ca-pub-8830524482034754`.
- Use a visible last-checked date of 2026-08-02 and tell readers to recheck variable operating details before booking.
- Preserve readable content when JavaScript is unavailable and prevent horizontal overflow at 375px.

---

### Task 1: Define the page contract

**Files:**
- Create: `tests/test_gapyeong_camping_page.py`
- Test: `tests/test_gapyeong_camping_page.py`

**Interfaces:**
- Consumes: `kor/report/camp/gapyeong.html` as UTF-8 text
- Produces: a regression contract for content, sources, analytics, structured data, and unsafe-claim removal

- [ ] **Step 1: Write failing tests**

Create unittest assertions for the new title/H1, canonical, GA4, AdSense, `2026-08-02`, official GoCamping links, `WebPage`, `FAQPage`, mobile-safe grid, relative home link, and absence of `완전무료`, `용문산 입구 공터`, and `자라섬 외곽 둔치`.

- [ ] **Step 2: Run the focused test and verify failure**

Run: `python3 -m unittest tests.test_gapyeong_camping_page -v`

Expected: FAIL because the existing page contains the prohibited claims and lacks the new contract.

- [ ] **Step 3: Commit the failing contract**

Run: `git add tests/test_gapyeong_camping_page.py && git commit -m "test: define Gapyeong camping page contract"`

### Task 2: Replace the page with the official-source guide

**Files:**
- Modify: `kor/report/camp/gapyeong.html`
- Test: `tests/test_gapyeong_camping_page.py`

**Interfaces:**
- Consumes: official GoCamping details and the Task 1 regression contract
- Produces: a source-backed static page at the unchanged canonical URL

- [ ] **Step 1: Implement the minimal compliant page**

Replace outdated metadata, unsupported place cards, and unsafe wording. Add the immediate answer, registered campground choices, official confirmation flow, source block, FAQ, `WebPage`/`FAQPage` JSON-LD, mobile-safe CSS, and relevant camping internal links. Keep the existing measurement identifiers.

- [ ] **Step 2: Run the focused test**

Run: `python3 -m unittest tests.test_gapyeong_camping_page -v`

Expected: all focused assertions PASS.

- [ ] **Step 3: Run repository validation**

Run: `python3 -m unittest discover -s tests -v`

Run: `python3 scripts/validate_priority_pages.py`

Run: `git diff --check`

Expected: all tests and validations PASS with no whitespace errors.

- [ ] **Step 4: Commit the page**

Run: `git add kor/report/camp/gapyeong.html && git commit -m "feat: refresh Gapyeong camping revenue guide"`

### Task 3: Deploy, verify, and log measurement

**Files:**
- Modify: `docs/growth/2026-08-01-priority-rollout-log.md`

**Interfaces:**
- Consumes: tested Task 2 commit and Search Console baseline clicks 4, impressions 109, CTR 3.67%, position 9.94
- Produces: deployed public page, verification evidence, indexing status, and a 28-day measurement entry

- [ ] **Step 1: Push main and wait for Pages deployment**

Run: `git push origin main`

Expected: push succeeds and the GitHub Pages workflow completes successfully.

- [ ] **Step 2: Verify the public page**

Check the public URL at desktop and 375px mobile width. Confirm the title, H1, official links, GA4, AdSense, structured data, no horizontal overflow, and no prohibited claims.

- [ ] **Step 3: Request indexing**

Inspect the canonical URL in Search Console and request indexing. If the daily quota is exhausted, record the exact status instead of claiming success.

- [ ] **Step 4: Record the rollout**

Append the change summary, official sources, validation results, indexing result, baseline, 28-day metrics, and stop condition to `docs/growth/2026-08-01-priority-rollout-log.md`.

- [ ] **Step 5: Commit and push the log**

Run: `git add docs/growth/2026-08-01-priority-rollout-log.md && git commit -m "docs: log Gapyeong camping revenue rollout"`

Run: `git push origin main`

Expected: local and remote `main` point to the rollout-log commit.
