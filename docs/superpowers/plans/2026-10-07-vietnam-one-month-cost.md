# Vietnam One-Month Cost Guide Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a source-backed Korean guide that calculates a transparent 30-day one-person monthly-rent baseline for Hanoi, Da Nang, and Ho Chi Minh City while keeping short-stay booking, visa, insurance, and direct AdSense facts separate.

**Architecture:** Add one static responsive Article page following the existing standalone travel-page pattern, with no calculator JavaScript and no ad changes. Add focused regression coverage, register the canonical route in the travel sitemap and generated Korean content index/home feed, then record the PR-ready state in project history/tasks.

**Tech Stack:** Static HTML, JSON-LD Article, Python unittest/pytest, repository SEO and launch-guard scripts.

**Spec:** User-provided `CODEX 1 — VIETNAM ONE-MONTH COST WRITE + NEXT REVENUE OPPORTUNITY` brief; page `/kor/report/travel/vietnam-one-month-cost.html`.

## Global Constraints

- Base branch is freshly fetched `origin/main` `284a350a573b5a0ea837a4bb8a8f53dc943a74a7`.
- Keep all prices in VND; do not infer KRW conversion or guaranteed short-stay prices.
- Mark Numbeo city samples as community-submitted, dated ranges, not confidence intervals or official tariffs.
- Show monthly apartment rent and 30-night accommodation quotes as separate products.
- State the one-person assumptions and itemized monthly subtotal arithmetic; exclude airfare, unquoted utilities, travel insurance, and non-specified leisure from the subtotal.
- Visa statements must link to Vietnamese government sources and remain passport-specific.
- Do not edit existing city guides, protected winners, publication queue/manifest, AdSense placement, or tracking loaders.
- No page publish, main merge, or queue/cap override; stop at one open PR for Control Tower review.
- Part B opportunity scan is read-only and happens after branch implementation.

## Review Focus

- Monthly rent vs 30-night reservation mismatch → test distinct labels and booking-source note.
- Community price sample freshness/dispersion → test dates, source links, currency, and caveat.
- Visa exemptions depend on passport and entry conditions → test official source and condition text.
- Excluded costs could make subtotal look all-in → test explicit omissions and formula labels.
- Protected Hanoi/Da Nang/Ho Chi Minh pages must not be edited → inspect exact changed paths and link targets.

---

### Task 1: Source-backed page and discovery wiring

**Files:**
- Create: `tests/test_vietnam_one_month_cost.py`
- Create: `kor/report/travel/vietnam-one-month-cost.html`
- Modify: `kor/report/travel/index.html`
- Modify: `tests/test_travel_revenue_hub.py`
- Modify: `tests/test_keyboard_cleaning_guide.py` (keep the existing launch discoverable after the new dated page enters the latest feed)
- Modify: `kor/report/travel/sitemap.xml`
- Modify: `data/content-index-ko.json`
- Modify: `data/home-feed-ko.json`
- Modify: `PROJECT_HISTORY.md`
- Modify: `TASKS.md`

**Interfaces:**
- Page canonical: `https://emfls.github.io/kor/report/travel/vietnam-one-month-cost.html`.
- Page schema: one `Article` JSON-LD with `datePublished` and `dateModified` `2026-10-07`.
- Cost model: monthly rent + 60 inexpensive local meals + one monthly transit-pass benchmark + one 10GB+ monthly phone-plan benchmark + 10 cappuccinos.
- Existing city guide links: `vietnam-hanoi.html`, `vietnam-danang.html`, `vietnam-hochiminh.html`.

- [x] **Step 1: Write the failing test** for indexability/schema, exact source/date/assumption facts, three-city table and subtotal math, visa and accommodation distinction, safe internal links, sitemap/index/feed membership, and preserved GA4/AdSense loaders.
- [x] **Step 2: Run `pytest tests/test_vietnam_one_month_cost.py -q`** and confirm it fails because the page/wiring do not exist.
- [x] **Step 3: Implement the single HTML article** using observed Oct 5–6 city-price snapshots and the Sep 25 furnished-rent cross-check; add three contextual city-guide links and official visa sources. Keep existing pages/ads untouched.
- [x] **Step 4: Register discovery** exactly once in the travel sitemap and regenerate the deterministic content index/home feed; the only changes are the new page, modified travel hub date, and corresponding latest-feed ordering.
- [ ] **Step 5: Run the focused test**, inspect displayed arithmetic independently, then run page, sitemap, broken-link, launch-guard, SEO QA, unittest, pytest, and `git diff --check` checks.
- [ ] **Step 6: Update `PROJECT_HISTORY.md` and `TASKS.md`** with source SHA, exact branch/head, tests, cap state, and no-merge Control Tower status.
- [ ] **Step 7: Commit, push, make one PR creation attempt, and verify exact-head CI**; do not merge.

### Task 2: Read-only next opportunity scan

**Files:**
- No repository changes.

- [ ] After Task 1 branch implementation is complete, scan current `origin/main` evidence for up to three non-camping, non-Vietnam candidates.
- [ ] Use source-specific freshness/completeness labels; protect winners; report `NEXT_READY_FOR_WRITE` only for one evidence-backed distinct intent.
