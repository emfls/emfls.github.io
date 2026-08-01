# Search Revenue Priority Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve qualified organic traffic and future AdSense revenue by validating measurement and updating the ten highest-opportunity pages in the approved order.

**Architecture:** Preserve the static HTML architecture, URLs, and canonical tags. Add a standard-library validator, then research, modify, validate, commit, push to `main`, and verify one page before starting the next.

**Tech Stack:** Static HTML/CSS/JavaScript, Python 3 standard library, GitHub Pages, GA4 `G-QP5Q67GE5B`, AdSense `ca-pub-8830524482034754`.

## Global Constraints

- Keep every existing public URL and canonical URL unchanged.
- Push approved changes directly to `main`; do not open a pull request.
- Use current official government, embassy, municipal, or public-institution sources for time-sensitive claims.
- Do not guarantee camping access, fire use, parking, visa eligibility, processing time, or approval.
- Keep existing AdSense code and do not obscure answer-first content with advertising.
- Record every applied change in `docs/growth/2026-08-01-priority-rollout-log.md`.
- Validate and publish one ranked page before starting the next.
- Do not delete or noindex pages in this plan.

---

### Task 1: Publish the approved planning documents

**Files:**
- Existing: `docs/superpowers/specs/2026-08-01-search-revenue-priority-design.md`
- Create: `docs/superpowers/plans/2026-08-01-search-revenue-priority-implementation.md`

**Interfaces:**
- Consumes: Approved design and direct-to-`main` decision.
- Produces: Versioned contract for all later tasks.

- [ ] Run `git status --short --branch` and `git diff --check HEAD~1 HEAD`; expect `main` and no whitespace errors.
- [ ] Commit with `git add docs/superpowers/plans/2026-08-01-search-revenue-priority-implementation.md && git commit -m "docs: plan prioritized search growth rollout"`.
- [ ] Run `git push origin main`; expect `origin/main` to contain both planning commits.

### Task 2: Add the validator and measurement inventory

**Files:**
- Create: `scripts/validate_priority_pages.py`
- Create: `tests/test_validate_priority_pages.py`
- Create: `docs/growth/2026-08-01-priority-rollout-log.md`

**Interfaces:**
- Consumes: One or more repository-relative HTML paths.
- Produces: `validate_page(path: Path) -> list[str]`; an empty list means the page passes.

- [ ] Write a failing unit test with a complete temporary HTML fixture and a broken fixture. Require errors for missing canonical, GA4 ID, AdSense ID, `<main>`, `<h1>`, JSON-LD `dateModified`, HTTPS official source, and `최근 확인` text.

```python
from pathlib import Path
from scripts.validate_priority_pages import validate_page

def test_complete_page_passes(tmp_path: Path):
    page = tmp_path / "page.html"
    page.write_text(COMPLETE_HTML, encoding="utf-8")
    assert validate_page(page) == []

def test_missing_requirements_are_reported(tmp_path: Path):
    page = tmp_path / "page.html"
    page.write_text("<html><body><h1>제목</h1></body></html>", encoding="utf-8")
    errors = validate_page(page)
    assert "missing canonical" in errors
    assert "missing GA4 measurement ID" in errors
```

- [ ] Run `python3 -m unittest tests.test_validate_priority_pages -v`; expect import failure.
- [ ] Implement the validator with `html.parser.HTMLParser`, `json`, and `re` only.

```python
GA4_ID = "G-QP5Q67GE5B"
ADSENSE_ID = "ca-pub-8830524482034754"

def validate_page(path: Path) -> list[str]:
    """Return stable human-readable errors for one static HTML page."""
```

The CLI prints `PASS <path>` or `FAIL <path>: <error>` and exits non-zero when any input fails.

- [ ] Run the unit tests; expect PASS.
- [ ] Run the validator over all ten target pages. Record existing failures as the baseline rather than hiding them.
- [ ] Record whether each page contains the expected GA4 and AdSense IDs. Mark GA4–AdSense product linking and bot/log confirmation as external-console follow-ups.
- [ ] Commit and push with message `test: add priority page SEO validation`.

### Page task procedure

Tasks 3–12 use this exact sequence; page-specific evidence and content requirements are listed below.

- [ ] Add the GSC and GA4 baseline to the rollout log.
- [ ] Browse current official sources and retain exact URLs plus an access date. Remove or qualify unsupported claims.
- [ ] Preserve the canonical and add an answer-first section inside `<main>`, an actual `최근 확인` date, aligned title/description/OG/Twitter copy, JSON-LD `dateModified`, official sources, and 2–4 contextual internal links.
- [ ] Run `python3 scripts/validate_priority_pages.py <FILE>`, `git diff --check`, and `git diff -- <FILE> docs/growth/2026-08-01-priority-rollout-log.md`.
- [ ] Commit only the page and log, using the exact message listed below, then `git push origin main`.
- [ ] Request the public URL and confirm HTTP 200, canonical, updated title, official sources, GA4 ID, and AdSense ID before continuing.

### Task 3: Rank 1 — Cheongju camping

**Files:** `kor/report/camp/cheongju.html`, rollout log.

**Baseline:** 489 impressions, 23 clicks, 4.70% CTR, position 7.87; 7 GA4 sessions, 18.7 seconds.

**Requirements:** Use current Cheongju municipal/tourism or public camping sources. Lead the title with `청주 노지캠핑 가이드`. Clearly state that riverbank and park access, parking, cooking, and camping can change with weather, construction, events, and local rules. Link Gimpo, Damyang, Asan, and the camping index.

**Commit:** `seo: improve Cheongju camping guide`

### Task 4: Rank 2 — Romania visa

**Files:** `kor/report/visa/romania.html`, rollout log.

**Baseline:** 214 impressions, 8 clicks, 3.74% CTR, position 7.65; 7 sessions, 15.7 seconds.

**Requirements:** Verify with Romania MFA/eVisa and EU sources. Lead with `루마니아 비자·무비자 입국`. Explain the Korean-passport short-stay path, Schengen day counting, and long-stay route; remove unsupported universal passport, fee, and processing-time claims. Replace `WebSite` JSON-LD with `Article`. Link Slovakia, Norway, Serbia, and Slovenia.

**Commit:** `seo: improve Romania visa guide`

### Task 5: Rank 3 — Slovakia visa

**Files:** `kor/report/visa/slovakia.html`, rollout log.

**Baseline:** 198 impressions, 6 clicks, 3.03% CTR, position 5.54; 2 sessions, 62.5 seconds.

**Requirements:** Verify with Slovak MFA and EU sources. Lead with `슬로바키아 비자·무비자 입국`; distinguish Schengen visits, national visas, and residence applications. Qualify fees and processing times.

**Commit:** `seo: improve Slovakia visa guide`

### Task 6: Rank 4 — Qatar visa

**Files:** `kor/report/visa/qatar.html`, rollout log.

**Baseline:** 153 impressions, 3 clicks, 1.96% CTR, position 9.17; 1 session, 0 seconds.

**Requirements:** Verify with Qatar Ministry of Interior and official visitor sources. Lead with `카타르 비자·무비자 입국`; separate visa-free/arrival, Hayya or e-visa, transit, work, and residence concepts. Remove unsupported universal extension and apostille claims.

**Commit:** `seo: improve Qatar visa guide`

### Task 7: Rank 5 — Norway visa

**Files:** `kor/report/visa/norway.html`, rollout log.

**Baseline:** 139 impressions, 3 clicks, 2.16% CTR, position 9.36; 4 sessions, 54 seconds.

**Requirements:** Verify with UDI and EU/Schengen sources. Lead with `노르웨이 비자·무비자 입국`; distinguish visits from study/work residence permits and point to UDI's current checklist rather than copying unstable values.

**Commit:** `seo: improve Norway visa guide`

### Task 8: Rank 6 — Serbia visa

**Files:** `kor/report/visa/serbia.html`, rollout log.

**Baseline:** 90 impressions, 1 click, 1.11% CTR, position 6.99; 1 GA4 session with 0 seconds.

**Requirements:** Verify with Serbia MFA sources. Lead with `세르비아 비자·무비자 입국`; replace the first screen with a direct Korean-passport answer and remove fixed claims lacking official support.

**Commit:** `seo: improve Serbia visa guide`

### Task 9: Rank 7 — Slovenia visa

**Files:** `kor/report/visa/slovenia.html`, rollout log.

**Baseline:** 91 impressions, 0 clicks, position 7.91; 1 GA4 session with 46 seconds.

**Requirements:** Verify with GOV.SI, the responsible Slovenian mission, and EU sources. Lead with `슬로베니아 비자·무비자 입국`. Specifically verify or remove the existing statement that documents must be mailed to the embassy in Japan.

**Commit:** `seo: improve Slovenia visa guide`

### Task 10: Rank 8 — Damyang camping

**Files:** `kor/report/camp/damyang.html`, rollout log.

**Baseline:** 301 impressions, 27 clicks, 8.97% CTR, position 6.72; 33 sessions, 17.5 seconds.

**Requirements:** Verify with Damyang municipal/tourism or public camping sources. Preserve the strong search promise while qualifying access, parking, cooking, fire, and facility claims. Link the camping index and related high-performing camping pages.

**Commit:** `seo: improve Damyang camping guide`

### Task 11: Rank 9 — Gimpo camping

**Files:** `kor/report/camp/gimpo.html`, rollout log.

**Baseline:** 315 impressions, 26 clicks, 8.25% CTR, position 6.37; 6 sessions, 36 seconds.

**Requirements:** Verify with Gimpo municipal/tourism or public camping sources. Preserve CTR while improving freshness, provenance, and nearby camping links.

**Commit:** `seo: improve Gimpo camping guide`

### Task 12: Rank 10 — Asan camping

**Files:** `kor/report/camp/asan.html`, rollout log.

**Baseline:** 173 impressions, 13 clicks, 7.51% CTR, position 7.23; 2 sessions, 1 second.

**Requirements:** Inspect mobile first-screen layout, title/body consistency, broken resources, and obstructive elements first. Verify with Asan municipal/tourism or public camping sources, then improve the answer-first section without weakening the existing CTR.

**Commit:** `seo: improve Asan camping guide`

### Task 13: Final regression and monitoring handoff

**Files:** all ten target pages and `docs/growth/2026-08-01-priority-rollout-log.md`.

**Interfaces:**
- Consumes: Published Tasks 2–12.
- Produces: Clean production state and a 28-day measurement handoff.

- [ ] Run `python3 -m unittest tests.test_validate_priority_pages -v`; expect PASS.
- [ ] Run the validator over all ten target pages; expect every page to pass.
- [ ] Run `git diff --check`, `git status --short --branch`, and `git log --oneline -15`; expect clean `main` aligned with `origin/main`.
- [ ] Record public verification for every page, unresolved external-console work, and the review date `2026-08-29`. Do not claim traffic or revenue improvement before post-change data exists.
- [ ] Commit the completed log with `docs: complete priority rollout baseline`, push `main`, and verify the final public URLs once more.
