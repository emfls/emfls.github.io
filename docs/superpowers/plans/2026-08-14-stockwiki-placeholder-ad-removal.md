# StockWiki Placeholder Ad Removal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove 33 nonfunctional placeholder ad units and the fixed mobile ad UI from all 11 StockWiki pages without changing stock content or navigation.

**Architecture:** A focused repository contract enumerates the exact StockWiki pages and validates the user-visible result: no empty ad regions or fixed mobile overlay remain, while each page still exposes its canonical and core stock content. A deterministic cleanup script performs only the known generated-markup substitutions.

**Tech Stack:** Static HTML, Python 3 `unittest`, Python standard-library text processing.

## Global Constraints

- Do not insert the production AdSense publisher ID.
- Preserve stock content, charts, filters, navigation, canonical URLs, and disclaimers.
- The cleanup must cover exactly the 11 pages that currently contain three placeholder ad units.

---

### Task 1: Remove dead StockWiki ad UI

**Files:**
- Create: `tests/test_stockwiki_ad_safety.py`
- Create: `scripts/remove_stockwiki_placeholder_ads.py`
- Modify: `kor/stockwiki/index.html`
- Modify: `kor/stockwiki/stocks/*/index.html` for the ten current stock pages
- Create: `docs/growth/2026-08-14-stockwiki-placeholder-ad-cleanup.md`

**Interfaces:**
- Consumes: the exact HTML markers `ca-pub-XXXXXXXXXXXXXXXX`, `.ad-slot`, and `.mobile-ad-fixed`.
- Produces: `clean_html(html: str) -> str`, returning the page without placeholder advertising markup or its presentation-only CSS.

- [x] **Step 1: Write the failing contract test**

Create a test that enumerates the 11 expected files, runs `clean_html` against current HTML, and requires the saved files to have no placeholder client, `adsbygoogle`, `ad-slot`, `mobile-ad-fixed`, or ad push calls. It must also require canonical markup and stock-page content to remain.

- [x] **Step 2: Verify the test fails for the existing placeholder UI**

Run: `python3 -m unittest tests.test_stockwiki_ad_safety -v`

Expected: failure because the existing pages contain placeholder units and a fixed mobile ad container.

- [x] **Step 3: Implement and run the deterministic cleanup**

Implement `clean_html(html: str) -> str` with exact regular-expression substitutions for the known ad component markup and CSS, reject input that still contains any forbidden marker, then apply it to the 11 enumerated files.

- [x] **Step 4: Record and verify the result**

Record the 11-page/33-unit result and revenue-neutral rationale in the growth log. Run `python3 -m unittest tests.test_stockwiki_ad_safety -v`, relevant repository tests, the cleanup script a second time to confirm zero further changes, and `git diff --check`.

- [ ] **Step 5: Commit and deploy**

Commit the implementation, push `main`, require a successful Pages workflow for the pushed SHA, and verify a public StockWiki page contains no placeholder or fixed-mobile ad markup.
