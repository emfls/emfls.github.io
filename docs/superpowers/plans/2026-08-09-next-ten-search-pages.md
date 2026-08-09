# Next Ten Search Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve and deploy the next ten highest-impression, not-yet-improved pages from the 2026-08-01 Search Console export.

**Architecture:** Keep each existing standalone HTML page and its working behavior. Add page-specific regression tests, replace unstable claims with current primary-source guidance, add structured data and mobile safeguards, then record every deployment in the growth log.

**Tech Stack:** Static HTML/CSS/JavaScript, Python `unittest`, repository priority-page validator, GitHub Pages.

## Global Constraints

- Preserve working interactive behavior and GA4 ID `G-QP5Q67GE5B` and AdSense publisher `ca-pub-8830524482034754`.
- Use current official primary sources for visas, travel, and game policy claims.
- Write the failing page contract test before editing its production HTML.
- Use `2026-08-09` as the source review and modification date.
- Run focused tests, full tests, `git diff --check`, and the common validator where applicable.
- Append applied changes to `docs/growth/2026-08-01-priority-rollout-log.md`.

---

### Task 1: MBTI browser test
**Files:** Modify `game/MBTI/index.html`; create `tests/test_mbti_game_page.py`; update growth log.
- [ ] Write assertions for search intent, actual test behavior, WebApplication/FAQPage, canonical, measurement IDs, date, and mobile ad bounds.
- [ ] Run the focused test and confirm expected failure.
- [ ] Add accurate visible instructions/privacy copy and metadata without changing scoring behavior.
- [ ] Run focused and full tests, record results, commit, and deploy.

### Task 2: Singapore visa
**Files:** Modify `kor/report/visa/singapore.html`; create or extend a focused visa test; update growth log.
- [ ] Verify Korean-passport short-visit, SG Arrival Card, passport, prohibited activity, and official links from Singapore ICA/MFA.
- [ ] Write and fail the page contract test.
- [ ] Replace stale content with a concise first answer, checklist, WebPage/FAQPage, and internal links.
- [ ] Validate, commit, and deploy.

### Task 3: Russia visa
**Files:** Modify `kor/report/visa/russia.html`; focused test; growth log.
- [ ] Verify current Korean-passport visa/eVisa and Korean travel-safety constraints using official sources.
- [ ] Write and fail the contract test, implement source-backed content, validate, commit, and deploy.

### Task 4: Mabinogi Mobile jobs
**Files:** Modify `kor/report/mabinogi-mobile-jobs.html`; focused test; growth log.
- [ ] Check current official Nexon job/class information and policy-sensitive claims.
- [ ] Write and fail the contract test, replace unsupported rankings with decision guidance, validate, commit, and deploy.

### Task 5: UAE visa
**Files:** Modify `kor/report/visa/uae.html`; focused test; growth log.
- [ ] Verify Korean-passport short-stay terms and official UAE entry sources.
- [ ] Write and fail the contract test, implement the verified guide, validate, commit, and deploy.

### Task 6: Philippines visa
**Files:** Modify `kor/report/visa/philippines.html`; focused test; growth log.
- [ ] Verify Korean-passport visa-free stay, eTravel, onward ticket, passport, and extension guidance from official Philippine sources.
- [ ] Write and fail the contract test, implement the guide, validate, commit, and deploy.

### Task 7: Newcastle travel
**Files:** Modify `kor/report/travel/australia-newcastle.html`; focused test; growth log.
- [ ] Verify attractions, Sydney transport, and ETA from official tourism/transport/home-affairs sources.
- [ ] Write and fail the contract test, implement a practical itinerary, validate, commit, and deploy.

### Task 8: Adelaide travel
**Files:** Modify `kor/report/travel/australia-adelaide.html`; focused test; growth log.
- [ ] Verify attractions, airport/city transport, and ETA with official sources.
- [ ] Write and fail the contract test, implement the guide, validate, commit, and deploy.

### Task 9: Saudi Arabia visa
**Files:** Modify `kor/report/visa/saudiarabia.html`; focused test; growth log.
- [ ] Verify Korean eligibility, tourist eVisa terms, insurance, passport, and prohibited activities from official Saudi sources.
- [ ] Write and fail the contract test, implement the guide, validate, commit, and deploy.

### Task 10: Perth travel
**Files:** Modify `kor/report/travel/australia-perth.html`; focused test; growth log.
- [ ] Verify attractions, airport transport, and ETA from official sources.
- [ ] Write and fail the contract test, implement the guide, validate, commit, and deploy.

### Final verification
- [ ] Run the complete unittest suite and all applicable priority-page validations.
- [ ] Confirm a clean worktree, push main, and wait for the final GitHub Pages deployment result.
