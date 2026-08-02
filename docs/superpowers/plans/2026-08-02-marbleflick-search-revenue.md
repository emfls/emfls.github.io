# MarbleFlick Search Revenue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve MarbleFlick search click-through and first-play clarity while fixing only the duplicate turn and winner notification defects.

**Architecture:** Keep the single static HTML game and its existing canvas engine. Add semantic content and structured data around the unchanged game, then make two isolated duplicate-removal fixes in the current markup and winner path.

**Tech Stack:** Static HTML/CSS/JavaScript, Python `unittest`, GitHub Pages.

## Global Constraints

- Keep game rules, initial piece layout, physics constants, drag threshold, AI selection logic, and AI difficulty unchanged.
- Keep canonical `https://emfls.github.io/kor/game/MarbleFlick/`, GA4 `G-QP5Q67GE5B`, and AdSense `ca-pub-8830524482034754`.
- Use `VideoGame` and `FAQPage` JSON-LD only; do not add a site-search action.
- Display verification date `2026-08-02` and bound automatic ad elements to the mobile viewport.

---

### Task 1: Static page contract and duplicate defect regression tests

**Files:**
- Create: `tests/test_marbleflick_page.py`
- Read: `kor/game/MarbleFlick/index.html`

**Interfaces:**
- Consumes: `PageParser` from `tests.test_gapyeong_camping_page`.
- Produces: a static contract for metadata, JSON-LD, measurement, mobile CSS, unique `turn` ID, and a single winner call.

- [ ] **Step 1: Write the failing test**

```python
class MarbleFlickPageTest(unittest.TestCase):
    def test_search_and_measurement_contract(self): ...
    def test_gameplay_duplicate_defects_are_absent(self): ...
    def test_structured_data_and_mobile_ads(self): ...
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python3 -m unittest tests.test_marbleflick_page -v`
Expected: FAIL because the current title is only `마블 플릭`, JSON-LD and mobile ad CSS are absent, `id="turn"` appears twice, and `showWinner(lastSurvivorColor)` is duplicated.

- [ ] **Step 3: Commit the failing contract**

Run: `git add tests/test_marbleflick_page.py && git commit -m "test: define MarbleFlick search page contract"`

### Task 2: Search content, structured data, and isolated defect fixes

**Files:**
- Modify: `kor/game/MarbleFlick/index.html`
- Test: `tests/test_marbleflick_page.py`

**Interfaces:**
- Consumes: existing `resetGame()`, `showWinner(winnerColor)`, mode buttons, canvas input handlers, canonical and measurement scripts.
- Produces: one `#turn`, one winner notification call, semantic H1, visible play instructions, `VideoGame` and `FAQPage` JSON-LD.

- [ ] **Step 1: Implement the minimal markup and metadata changes**

Set the title to `마블 플릭 게임 | 무료 2인용·AI 구슬 튕기기`, add the matching Korean description and H1, show free/no-download/2-player/AI information, and add a one-sentence drag instruction.

- [ ] **Step 2: Add structured data and viewport safety**

Add separate `VideoGame` and `FAQPage` JSON-LD blocks with `dateModified: 2026-08-02`; add:

```css
div[id^="aswift_"],iframe[id^="aswift_"]{max-width:100% !important;overflow-x:clip !important}
```

- [ ] **Step 3: Remove only the confirmed duplicates**

Remove the second `<div id="turn">` and the second consecutive `showWinner(lastSurvivorColor);`. Do not alter physics or AI code.

- [ ] **Step 4: Run focused and full verification**

Run: `python3 -m unittest tests.test_marbleflick_page -v`
Expected: PASS.

Run: `python3 -m unittest discover -s tests -v && git diff --check`
Expected: all tests PASS and no whitespace errors.

- [ ] **Step 5: Commit the implementation**

Run: `git add kor/game/MarbleFlick/index.html && git commit -m "feat: improve MarbleFlick search landing page"`

### Task 3: Public deployment and growth record

**Files:**
- Modify: `docs/growth/2026-08-01-priority-rollout-log.md`

**Interfaces:**
- Consumes: Search Console baseline and verified page commit.
- Produces: reproducible rollout record and public GitHub Pages deployment.

- [ ] **Step 1: Record baseline, changes, tests, and 28-day decision rule**

Record clicks 1, impressions 42, CTR 2.38%, average position 8.98, the duplicate fixes, preserved gameplay constraints, and reassessment date 2026-08-30.

- [ ] **Step 2: Run final verification and commit the log**

Run: `python3 -m unittest discover -s tests -v && git diff --check`
Expected: all tests PASS.

Run: `git add docs/growth/2026-08-01-priority-rollout-log.md && git commit -m "docs: log MarbleFlick search rollout"`

- [ ] **Step 3: Push approved main and verify deployment**

Run: `git push origin main`, watch the Pages workflow, then verify the public title, H1, measurement IDs, unique turn element, mode buttons, and 375px horizontal overflow.
