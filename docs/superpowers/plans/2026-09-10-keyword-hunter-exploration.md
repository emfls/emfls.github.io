# Keyword Hunter Autonomous Exploration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace anchored seed repetition with measurable, reproducible breadth-first exploration that promotes verified Winner themes.

**Architecture:** Add one focused exploration-policy module consumed by the existing runner. Persist the last ten run summaries in a JSON file and extend the existing markdown report without changing API clients or scoring contracts.

**Tech Stack:** Python 3.9 standard library, CSV/JSON, pytest.

**Spec:** `docs/superpowers/specs/2026-09-10-keyword-hunter-exploration-design.md`

## Global Constraints

- Preserve existing API authentication, rate limits, cache, duplicate detection, and score validity rules.
- New-theme allocation is at least 40% when enough eligible source-backed seeds exist.
- Production seed selection excludes manually anchored initial seed sources.
- No automatic content publication.

---

### Task 1: Exploration policy and recent memory

**Files:**
- Create: `scripts/keyword_hunter_exploration.py`
- Create: `tests/test_keyword_hunter_exploration.py`

**Interfaces:**
- Produces: `novelty_score`, `select_exploration_seeds`, `summarize_history`, `update_history`.

- [ ] Write failing tests for novelty, cooldown, 40/30/20/10 allocation, deterministic 70/30 sampling, category/cluster caps, and ten-run retention.
- [ ] Run the focused tests and confirm expected failures.
- [ ] Implement the smallest policy functions that satisfy those tests.
- [ ] Run the focused tests and confirm they pass.

### Task 2: Runner integration and report metrics

**Files:**
- Modify: `scripts/keyword_hunter.py`
- Modify: `scripts/keyword_hunter_core.py`
- Modify: `tests/test_keyword_hunter.py`

**Interfaces:**
- Consumes: exploration policy functions from Task 1.
- Produces: persisted novelty fields, theme state, report metrics, and next exploration directions.

- [ ] Write failing integration tests proving anchored initial sources are excluded and every required metric appears in the report.
- [ ] Run the focused tests and confirm expected failures.
- [ ] Integrate selection before API calls and history persistence in the existing atomic commit.
- [ ] Run the focused and existing Keyword Hunter tests.

### Task 3: Production state migration, documentation, and live validation

**Files:**
- Modify: `data/keyword_hunter_config.json`
- Modify: `data/keyword_seeds.json`
- Create: `data/recent_exploration_history.json`
- Modify: `docs/keyword-hunter.md`
- Modify: `PROJECT_HISTORY.md`

**Interfaces:**
- Consumes: the integrated runner.
- Produces: a live report and updated persistent database.

- [ ] Remove only initial manually anchored seed records from the production seed pool.
- [ ] Document the exploration budgets, cooldowns, report fields, and content queue boundary.
- [ ] Run all Keyword Hunter regression tests and `git diff --check`.
- [ ] Run Keyword Hunter once with live APIs and verify novelty, overlap, category share, Winners, and next directions.
- [ ] Record architecture and live results in `PROJECT_HISTORY.md`.
