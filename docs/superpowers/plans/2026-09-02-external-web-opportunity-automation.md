# External Web Opportunity Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a fail-closed external-web discovery pipeline that researches 10–30 new intents every two hours, queues only evidence-backed differentiated briefs, and allows at most three high-quality new pages per calendar day.

**Architecture:** Keep web discovery and factual research agent-driven, but make persistence, scoring, overlap gates, daily publication capacity, reporting, and launch protection deterministic Python code. Reuse the existing site audit, Revenue Opportunity artifacts, content launch manifest, launch guard, experiments, and GitHub Actions rather than creating a second publishing system.

**Tech Stack:** Python 3 standard library, JSON artifacts, pytest, static HTML, GitHub Actions, Codex local cron automation

**Spec:** `docs/superpowers/specs/2026-09-02-external-web-opportunity-automation-design.md`

## Global Constraints

- Discovery must start from `EXTERNAL_WEB`; existing emfls pages are used only for overlap checks, winner-pattern context, monetization context, and internal-link planning.
- Each run discovers 10–30 candidates without inventing monthly search volume.
- Demand status is one of `VERIFIED_SEARCH_DATA`, `OBSERVED_SEARCH_SIGNAL`, `ESTIMATED`, or `INSUFFICIENT_DATA`.
- Launch requires Opportunity Score >= 70, Quality Feasibility Score >= 75, and overlap in `NO_OVERLAP` or `LOW_OVERLAP`.
- Publication is limited to three pages per Asia/Seoul calendar day; zero pages is valid.
- `SAME_INTENT` never creates a new URL.
- WINNER pages and active COOLDOWN experiments, including Nonsan, Cheorwon, and Uljin, are protected.
- YMYL pages require official sources, reviewed date, limitations, and an appropriate disclaimer.
- External content, tables, images, structure, and analysis must not be copied or paraphrased as the sole value.
- Unverified facts remain `NOT_VERIFIED`; unavailable sources fail closed.
- URL, canonical, ads, analytics, AdSense CTR, mass rewrites, deletions, doorway pages, and region-name substitution are outside scope.

---

### Task 1: External candidate contract and explainable scores

**Files:**
- Create: `scripts/external_content_opportunity.py`
- Create: `tests/test_external_content_opportunity.py`

**Interfaces:**
- Consumes: candidate dictionaries written by the discovery agent.
- Produces: `normalize_external_candidate(candidate: dict, as_of: str) -> dict`, `score_external_opportunity(candidate: dict) -> dict`, `score_quality_feasibility(candidate: dict) -> dict`, and `launch_readiness(candidate: dict) -> dict`.

- [ ] **Step 1: Write failing tests for source status, score totals, and READY gates**

```python
from scripts.external_content_opportunity import (
    launch_readiness,
    normalize_external_candidate,
    score_external_opportunity,
    score_quality_feasibility,
)


def complete_candidate():
    return {
        "candidateId": "EXT-20260902-001",
        "idea": "전기요금 누진세 계산기",
        "discovery": {
            "origin": "EXTERNAL_WEB",
            "source": "GOOGLE",
            "method": "AUTOCOMPLETE",
            "observedTopic": "전기요금 누진세 계산",
            "demandStatus": "OBSERVED_SEARCH_SIGNAL",
            "evidenceRefs": ["https://www.google.com/search?q=전기요금+누진세+계산"],
        },
        "intent": {"primary": "전기 사용량으로 예상 요금 계산", "secondary": ["누진 구간 확인"]},
        "overlap": {"level": "NO_OVERLAP", "closestUrl": None},
        "contentGap": "설명만 제공하고 직접 계산 기능이 없다.",
        "additionalValue": ["CALCULATOR", "OFFICIAL_SOURCE_VERIFICATION"],
        "officialSources": [{"url": "https://example.go.kr/rates", "reviewedAt": "2026-09-02"}],
        "supportingSources": [],
        "opportunityInputs": {"demandSignal": .8, "problemStrength": .9, "nonOverlap": 1, "differentiation": .9, "monetization": .7, "sourceReliability": .9, "evergreen": 1, "benefitVsCost": .7},
        "qualityInputs": {"accuracy": 1, "sourceCoverage": .9, "officialSources": 1, "originalStructure": .9, "structuredValue": 1, "notThin": .9, "intentCompletion": .9, "maintainability": .8},
        "brief": {"primaryIntent": "전기 사용량으로 예상 요금 계산", "keyFacts": ["요금 구간"], "internalLinkPlan": [], "whySeparatePage": "기존 페이지에 계산 intent가 없다."},
    }


def test_observed_signal_is_not_converted_to_verified_volume():
    row = normalize_external_candidate(complete_candidate(), "2026-09-02")
    assert row["discovery"]["demandStatus"] == "OBSERVED_SEARCH_SIGNAL"
    assert "monthlySearchVolume" not in row["discovery"]


def test_scores_are_explainable_and_sum_to_100_maximum():
    opportunity = score_external_opportunity(complete_candidate())
    quality = score_quality_feasibility(complete_candidate())
    assert sum(component["max"] for component in opportunity["components"]) == 100
    assert sum(component["max"] for component in quality["components"]) == 100
    assert all(component["reason"] for component in opportunity["components"] + quality["components"])


def test_ready_requires_both_scores_low_overlap_sources_and_brief():
    row = complete_candidate()
    assert launch_readiness(row)["status"] == "READY_TO_LAUNCH"
    row["overlap"]["level"] = "SAME_INTENT"
    assert launch_readiness(row)["status"] == "SAME_INTENT"
```

- [ ] **Step 2: Run tests and verify the module is missing**

Run: `python3 -m pytest tests/test_external_content_opportunity.py -q`

Expected: FAIL with `ModuleNotFoundError: scripts.external_content_opportunity`.

- [ ] **Step 3: Implement immutable constants and pure validation functions**

```python
DEMAND_STATUSES = {"VERIFIED_SEARCH_DATA", "OBSERVED_SEARCH_SIGNAL", "ESTIMATED", "INSUFFICIENT_DATA"}
OVERLAP_LEVELS = {"NO_OVERLAP", "LOW_OVERLAP", "MEDIUM_OVERLAP", "HIGH_OVERLAP", "SAME_INTENT"}
OPPORTUNITY_WEIGHTS = {"demandSignal": 20, "problemStrength": 10, "nonOverlap": 20, "differentiation": 15, "monetization": 15, "sourceReliability": 10, "evergreen": 5, "benefitVsCost": 5}
QUALITY_WEIGHTS = {"accuracy": 15, "sourceCoverage": 15, "officialSources": 15, "originalStructure": 10, "structuredValue": 15, "notThin": 10, "intentCompletion": 15, "maintainability": 5}
```

Implement component scoring with values clamped to 0–1. `launch_readiness` must fail closed when external origin, evidence references, content gap, additional value, sources, or a complete brief is missing. YMYL candidates must additionally require `reviewedAt`, `limitations`, and `disclaimer`.

- [ ] **Step 4: Run focused tests**

Run: `python3 -m pytest tests/test_external_content_opportunity.py -q`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/external_content_opportunity.py tests/test_external_content_opportunity.py
git commit -m "feat: validate external content opportunities"
```

### Task 2: Persistent external discovery queue and duplicate suppression

**Files:**
- Create: `scripts/external_discovery_pipeline.py`
- Create: `tests/test_external_discovery_pipeline.py`
- Create: `data/external-content-opportunities.json`
- Create: `reports/external-discovery-pipeline.md`

**Interfaces:**
- Consumes: `data/external-discovery-input.json`, `data/site-audit.json`, and the previous external queue.
- Produces: `run_external_pipeline(root: Path, run_at: str, input_path: Path, write: bool = True) -> dict`, the canonical queue, TOP 10 report, and `READY_TO_LAUNCH` ordering.

- [ ] **Step 1: Write failing queue tests**

```python
def test_repeated_rejected_candidate_is_not_researched_without_new_evidence(tmp_path):
    existing = candidate("EXT-1", status="REJECTED", refs=["ref-a"])
    incoming = candidate("EXT-1", status="DISCOVERED", refs=["ref-a"])
    prepare(tmp_path, existing=[existing], incoming=[incoming])
    result = run_external_pipeline(tmp_path, "2026-09-02T12:00:00+09:00", tmp_path / "input.json")
    assert result["summary"]["reusedWithoutResearch"] == 1
    assert result["candidates"][0]["status"] == "REJECTED"


def test_run_requires_ten_to_thirty_external_candidates(tmp_path):
    prepare(tmp_path, incoming=[candidate(f"EXT-{i}") for i in range(9)])
    result = run_external_pipeline(tmp_path, "2026-09-02T12:00:00+09:00", tmp_path / "input.json")
    assert result["dataStatus"] == "INSUFFICIENT_DATA"
    assert result["readyToLaunch"] == []


def test_top_ten_are_sorted_by_expected_value_then_candidate_id(tmp_path):
    rows = [candidate(f"EXT-{i}", opportunity=70 + i, quality=80) for i in range(10)]
    prepare(tmp_path, incoming=rows)
    result = run_external_pipeline(tmp_path, "2026-09-02T12:00:00+09:00", tmp_path / "input.json")
    assert [row["candidateId"] for row in result["top10"]] == [f"EXT-{i}" for i in reversed(range(10))]
```

- [ ] **Step 2: Run tests and verify failure**

Run: `python3 -m pytest tests/test_external_discovery_pipeline.py -q`

Expected: FAIL because `run_external_pipeline` is not defined.

- [ ] **Step 3: Implement deterministic merge, stable IDs, and status transitions**

The merge key is a normalized primary intent plus locale. Preserve `firstDiscoveredAt`, append only new `evidenceRefs`, and update `lastDiscoveredAt`. Terminal statuses `REJECTED`, `SAME_INTENT`, and `FAILED_PATTERN` remain terminal unless at least one new evidence reference is present.

- [ ] **Step 4: Implement required report sections**

The report must include:

```text
EXTERNAL DISCOVERY PIPELINE
External ideas discovered
Google
Naver
Other websites
Rejected as existing intent
Researching
Brief ready
Ready to launch
Pages launched today
TOP 10 EXTERNAL OPPORTUNITIES
DUPLICATE REMOVAL RESULTS
```

- [ ] **Step 5: Run focused tests and a deterministic double-run check**

Run: `python3 -m pytest tests/test_external_discovery_pipeline.py -q`

Run twice with the same `--run-at` and input, then compare `sha256sum data/external-content-opportunities.json`.

Expected: tests pass and hashes match.

- [ ] **Step 6: Commit**

```bash
git add scripts/external_discovery_pipeline.py tests/test_external_discovery_pipeline.py data/external-content-opportunities.json reports/external-discovery-pipeline.md
git commit -m "feat: persist external discovery queue"
```

### Task 3: Enforce three launches per calendar day

**Files:**
- Modify: `scripts/new_content_opportunity.py`
- Modify: `scripts/daily_revenue_growth.py`
- Modify: `scripts/content_launch_guard.py`
- Modify: `tests/test_new_content_opportunity.py`
- Modify: `tests/test_daily_revenue_growth.py`
- Modify: `tests/test_content_launch_guard.py`

**Interfaces:**
- Consumes: launch experiments and `run_at` with timezone.
- Produces: `published_on_local_day(experiments: list[dict], run_at: str) -> list[dict]` and selection capacity capped at three.

- [ ] **Step 1: Replace five-page expectations with strict three-page failing tests**

```python
def test_selection_never_exceeds_three_pages_per_local_day():
    rows = [candidate(i, 99 - i) for i in range(1, 7)]
    assert len(select_new_pages(rows, active_launches=0, published_today=[])) == 3
    assert len(select_new_pages(rows, active_launches=0, published_today=[{"url": "/one"}, {"url": "/two"}])) == 1


def test_guard_rejects_fourth_added_html_page(tmp_path):
    setup_data(tmp_path)
    changed = [("A", f"kor/report/new-{i}.html") for i in range(4)]
    errors = validate_launch(tmp_path, manifest([f"/kor/report/new-{i}.html" for i in range(4)]), changed)
    assert "NEW_CONTENT_DAILY_LIMIT_EXCEEDED" in errors
```

- [ ] **Step 2: Run focused tests and confirm old five-page behavior fails**

Run: `python3 -m pytest tests/test_new_content_opportunity.py tests/test_daily_revenue_growth.py tests/test_content_launch_guard.py -q`

Expected: FAIL because the current selector and guard allow up to five pages.

- [ ] **Step 3: Implement the strict daily cap**

Change selector defaults to `daily_limit=3`, remove extra-slot behavior, count `publishedOn` using the Asia/Seoul date represented by `run_at`, and make capacity `3 - len(published_today)`. Change the launch guard threshold from five to three and emit `NEW_CONTENT_DAILY_LIMIT_EXCEEDED`.

- [ ] **Step 4: Run focused tests**

Run: `python3 -m pytest tests/test_new_content_opportunity.py tests/test_daily_revenue_growth.py tests/test_content_launch_guard.py -q`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/new_content_opportunity.py scripts/daily_revenue_growth.py scripts/content_launch_guard.py tests/test_new_content_opportunity.py tests/test_daily_revenue_growth.py tests/test_content_launch_guard.py
git commit -m "fix: cap external launches at three per day"
```

### Task 4: Connect READY queue to the existing launch manifest

**Files:**
- Create: `scripts/prepare_external_launch.py`
- Create: `tests/test_prepare_external_launch.py`
- Modify: `data/content-launch-manifest.json`
- Modify: `data/google-index-candidates.json`

**Interfaces:**
- Consumes: canonical external queue, launch experiments, current site audit, and run time.
- Produces: `prepare_external_launch(root: Path, run_at: str, write: bool = True) -> dict` with at most three manifest entries and no HTML generation when the queue is not fully ready.

- [ ] **Step 1: Write failing integration tests**

```python
def test_same_intent_and_incomplete_brief_never_enter_manifest(tmp_path):
    prepare_queue(tmp_path, [ready_candidate("A"), same_intent_candidate("B"), incomplete_candidate("C")])
    result = prepare_external_launch(tmp_path, "2026-09-02T14:00:00+09:00")
    assert result["candidateIds"] == ["A"]


def test_manifest_respects_remaining_daily_slots(tmp_path):
    prepare_queue(tmp_path, [ready_candidate(str(i)) for i in range(5)])
    prepare_experiments(tmp_path, published_today=2)
    result = prepare_external_launch(tmp_path, "2026-09-02T14:00:00+09:00")
    assert len(result["candidateIds"]) == 1
```

- [ ] **Step 2: Run test and verify failure**

Run: `python3 -m pytest tests/test_prepare_external_launch.py -q`

Expected: FAIL with missing module.

- [ ] **Step 3: Implement READY ordering and fail-closed manifest generation**

Sort by `expectedRevenueImpact * demandConfidence * qualityFeasibility * evergreenPotential / max(competitionCost, 0.1)`, then candidate ID. Require content path, URL, sitemap path, hub path, official sources, brief, and the Task 1 readiness result.

- [ ] **Step 4: Run focused tests and launch guard dry run**

Run: `python3 -m pytest tests/test_prepare_external_launch.py -q`

Run: `python3 scripts/content_launch_guard.py --root . --manifest data/content-launch-manifest.json --base-ref HEAD`

Expected: PASS with zero publication or only manifest-matching new HTML.

- [ ] **Step 5: Commit**

```bash
git add scripts/prepare_external_launch.py tests/test_prepare_external_launch.py data/content-launch-manifest.json data/google-index-candidates.json
git commit -m "feat: prepare external content launch manifests"
```

### Task 5: Add the two-hour operating runbook and Codex cron

**Files:**
- Create: `docs/growth/external-web-opportunity-runbook.md`
- Modify: `docs/growth/2026-09-01-daily-revenue-growth-automation.md`

**Interfaces:**
- Consumes: saved Codex project ID for `emfls-site` and all artifacts from Tasks 1–4.
- Produces: one ACTIVE local cron automation named `External Web Opportunity Discovery` with `RRULE:FREQ=HOURLY;INTERVAL=2`.

- [ ] **Step 1: Write the exact automation prompt into the runbook**

The prompt must instruct each run to:

```text
Read the spec, runbook, project history, canonical external queue, launch experiments, and latest data statuses first. Browse Google, Naver, and at least one additional external source where available. Discover 10–30 genuinely new intents; do not derive candidates only from emfls. Record observed signals without inventing search volume. Deduplicate against previous candidates and the full site audit. Research competition and official sources, write content gaps and briefs, calculate both scores, and update READY ordering. Publish zero to three pages only when every launch gate passes and daily capacity remains. Protect WINNER and COOLDOWN pages. Run launch guard and tests, update records, commit and push safe changes, then verify GitHub Actions. If web data or sources are unavailable, fail closed and record the status.
```

- [ ] **Step 2: Verify saved-project identity**

Call `list_projects`, select the project whose path is this `emfls-site` repository, and confirm `isGitRepository=true`. Do not invent a project ID.

- [ ] **Step 3: Create the cron automation**

Create a local cron automation with:

```text
name: External Web Opportunity Discovery
kind: cron
status: ACTIVE
executionEnvironment: local
projectId: <verified project id>
rrule: RRULE:FREQ=HOURLY;INTERVAL=2
notificationPolicy: failed_runs_only
```

Use the user's configured default model unless a model is required by the tool schema; if required, use an available balanced coding model and medium reasoning.

- [ ] **Step 4: View and verify the created automation**

Confirm the returned automation ID, `ACTIVE` status, two-hour RRULE, project ID, and prompt. Confirm the deleted `revenue-growth-5` heartbeat was not recreated.

- [ ] **Step 5: Commit the runbook and history update**

```bash
git add docs/growth/external-web-opportunity-runbook.md docs/growth/2026-09-01-daily-revenue-growth-automation.md
git commit -m "docs: add external discovery operating runbook"
```

### Task 6: Full verification, push, and first-run audit

**Files:**
- Modify only if generated by deterministic commands: `data/external-content-opportunities.json`, `reports/external-discovery-pipeline.md`, `data/content-launch-manifest.json`, `data/google-index-candidates.json`

**Interfaces:**
- Consumes: complete implementation and active cron.
- Produces: passing local suite, pushed commits, successful SEO QA and Pages deployment, and an auditable first discovery run.

- [ ] **Step 1: Run focused external pipeline tests**

Run: `python3 -m pytest tests/test_external_content_opportunity.py tests/test_external_discovery_pipeline.py tests/test_prepare_external_launch.py tests/test_new_content_opportunity.py tests/test_daily_revenue_growth.py tests/test_content_launch_guard.py -q`

Expected: PASS.

- [ ] **Step 2: Run the entire suite**

Run: `python3 -m pytest -q`

Expected: all tests pass.

- [ ] **Step 3: Run deterministic artifact and launch checks**

Run the external pipeline twice with the same fixture input and run time, compare hashes, then run:

```bash
python3 scripts/content_launch_guard.py --root . --manifest data/content-launch-manifest.json --base-ref HEAD
git diff --check
```

Expected: deterministic hashes, launch guard PASS, and no whitespace errors.

- [ ] **Step 4: Inspect scope before push**

Run: `git status --short` and `git diff --stat HEAD~1`.

Confirm unrelated untracked files remain unadded, no protected HTML changed without a valid manifest, and no ads, analytics, canonical, or deletion changes exist.

- [ ] **Step 5: Push main and monitor GitHub**

```bash
git push origin main
gh run list --branch main --limit 4
```

Watch the matching SEO QA run with `gh run watch <run-id> --exit-status` and confirm Pages deployment success.

- [ ] **Step 6: Audit the first scheduled run**

After the first cron trigger, verify the report includes source counts, rejection counts, queue counts, TOP 10, duplicate decisions, and pages launched today. Verify 10–30 external candidates or a truthful `INSUFFICIENT_DATA` result, and ensure no page was launched from an observed signal alone without the remaining evidence and quality gates.
