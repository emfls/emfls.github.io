# LadderGame Canonical Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Point the English LadderGame page canonical at its real public URL so Google no longer follows a nonexistent root URL.

**Architecture:** Add one static-page regression test that parses the canonical link, then make the smallest possible one-line metadata correction. Preserve gameplay, analytics, ads, translations, and sitemap behavior.

**Tech Stack:** Static HTML, Python `unittest`, GitHub Pages

## Global Constraints

- The canonical must be exactly `https://emfls.github.io/game/LadderGame/`.
- Do not change LadderGame gameplay or any localized LadderGame page.
- Keep GA4 and AdSense tags unchanged.

---

### Task 1: Correct the canonical contract

**Files:**
- Create: `tests/test_laddergame_canonical.py`
- Modify: `game/LadderGame/index.html`
- Modify: `docs/growth/2026-08-08-google-performance-audit.md`

**Interfaces:**
- Consumes: the published static HTML file at `game/LadderGame/index.html`
- Produces: a canonical link resolving to the same public page directory

- [ ] **Step 1: Write the failing test**

```python
def test_canonical_matches_public_game_directory(self):
    self.assertEqual(
        self.canonical,
        "https://emfls.github.io/game/LadderGame/",
    )
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python3 -m unittest tests.test_laddergame_canonical -v`
Expected: FAIL because the current value is `https://emfls.github.io/LadderGame/`.

- [ ] **Step 3: Write minimal implementation**

Replace the canonical href with:

```html
<link rel="canonical" href="https://emfls.github.io/game/LadderGame/" />
```

- [ ] **Step 4: Run focused and full verification**

Run: `python3 -m unittest tests.test_laddergame_canonical -v`
Expected: PASS.

Run: `python3 -m unittest discover -s tests -v`
Expected: all tests PASS.

Run: `git diff --check`
Expected: no output and exit code 0.

- [ ] **Step 5: Commit and deploy**

```bash
git add game/LadderGame/index.html tests/test_laddergame_canonical.py docs/growth/2026-08-08-google-performance-audit.md docs/superpowers/specs/2026-08-08-laddergame-canonical-design.md docs/superpowers/plans/2026-08-08-laddergame-canonical.md
git commit -m "Fix LadderGame canonical URL"
git push origin main
```

- [ ] **Step 6: Verify the public page**

Confirm the latest GitHub Pages build uses the new commit and the public page contains the corrected canonical. Then start Search Console `수정 결과 확인` for the one 404 item.
