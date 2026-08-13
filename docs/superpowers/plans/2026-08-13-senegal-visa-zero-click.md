# Senegal Visa Zero-Click Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the zero-click `세네갈 비자` search result by answering the visa decision immediately and refreshing official health sources without changing ad density.

**Architecture:** Keep the existing static page and its shared interaction contract. Add one focused regression test, revise only decision-critical copy and official links, then verify the deployed GitHub Pages output.

**Tech Stack:** Static HTML, Python `unittest`, GitHub Pages

## Global Constraints

- Keep the canonical URL unchanged.
- Keep the current AdSense unit count and placement unchanged.
- Use Senegal MFA and WHO primary sources.
- Do not state a fixed airport-transit threshold when current official wording is route-dependent.

---

### Task 1: Search-intent and source refresh

**Files:**
- Create: `tests/test_senegal_visa_zero_click.py`
- Modify: `kor/report/visa/senegal.html`
- Modify: `tests/test_senegal_visa_page.py`
- Modify: `tests/test_gsc_opportunity_batch_08.py`
- Create: `docs/growth/2026-08-13-senegal-visa-zero-click.md`

**Interfaces:**
- Consumes: the existing static-page metadata, FAQ JSON-LD, AdSense, and JavaScript contract.
- Produces: a clearer Korean visa decision and current official-source links at the same canonical URL.

- [ ] **Step 1: Write the failing regression test**

Assert that the rendered page exposes the direct three-month visa answer, six-month passport rule, long-stay branch, current Senegal MFA URL, current WHO country list, lifetime ICVP wording, and the 2026-08-13 review date while omitting the stale fixed 12-hour claim.

- [ ] **Step 2: Run the focused test and verify the expected failure**

Run `python3 -m unittest tests.test_senegal_visa_zero_click` and confirm it fails because the new title, answer, links, and date are absent.

- [ ] **Step 3: Apply the minimal page and existing-contract updates**

Change only the title/description, lead answer, decision checklist, yellow-fever wording, FAQ, source links, and review date. Update old exact-value tests to the approved title and date.

- [ ] **Step 4: Verify focused and regression tests**

Run `python3 -m unittest tests.test_senegal_visa_zero_click tests.test_senegal_visa_page tests.test_gsc_opportunity_batch_08` and `git diff --check`.

- [ ] **Step 5: Record, commit, deploy, and verify public output**

Document the Search Console evidence and policy constraints, commit and push to `main`, wait for GitHub Pages, then confirm the public title, direct answer, official links, and unchanged ad marker.
