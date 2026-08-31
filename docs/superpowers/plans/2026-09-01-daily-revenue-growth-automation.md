# Daily Revenue Growth Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 2026-09-01 04:00 Asia/Seoul을 시작점으로 5시간마다 직접 검증된 검색 수요를 바탕으로 신규 후보 10~20개를 평가하고, 기존 intent와 겹치지 않는 후보만 기본 3개·최대 5개까지 안전하게 발행·측정하는 운영 시스템을 구축한다.

**Architecture:** 기존 `revenue_opportunity.py`와 `revenue_growth.py`는 기존 URL 개선 판단을 계속 담당한다. 신규 `new_content_opportunity.py`는 직접 수요 증거, 의미 중복, 신규 점수, 선발 및 28일 cohort 판정을 순수 함수로 제공하고, `daily_revenue_growth.py`는 heartbeat가 저장한 조사 입력을 결정적 JSON·Markdown 산출물로 변환한다. 콘텐츠 파일 생성은 heartbeat가 담당하지만 `content_launch_guard.py`가 manifest와 git diff를 대조해 보호 URL, 발행량, 실험량, sitemap·hub·canonical·광고/GA4 불변성을 커밋 전에 강제한다.

**Tech Stack:** Python 3.11 표준 라이브러리, unittest/pytest, JSON, Markdown, 정적 HTML, Git, GitHub Actions, Codex heartbeat

**Spec:** `docs/superpowers/specs/2026-09-01-daily-revenue-growth-automation-design.md`

## Global Constraints

- 예약은 `2026-09-01 04:00 Asia/Seoul`을 시작점으로 하는 연속 5시간 간격이며, 예시는 `04:00 → 09:00 → 14:00 → 19:00 → 다음 날 00:00 → 05:00`이다.
- 매 실행 후보 조사량은 10~20개다.
- 자동 발행 기본 한도는 점수 70 이상 최대 3개다.
- 4~5번째 슬롯은 점수 85 이상, 직접 수요 `VERIFIED`, overlap `NO_OVERLAP`일 때만 허용한다.
- 5시간 간격 실행 전체를 합산한 최근 24시간 신규 발행량은 기본 3개, 절대 최대 5개이며 자정이나 새 실행마다 초기화하지 않는다.
- 직접 query 수요 증거와 재확인 가능한 원본 파일·URL이 없으면 발행 0개다.
- 허용 상태는 `VERIFIED`, `ESTIMATED`, `STALE_DATA`, `NOT_CONNECTED`, `INSUFFICIENT_DATA`이며 신규 페이지 baseline에는 `NOT_AVAILABLE`을 사용한다.
- overlap `MEDIUM_OVERLAP`, `HIGH_OVERLAP`, `SAME_INTENT`는 자동 신규 발행하지 않는다.
- 활성 `CONTENT_LAUNCH_EXPERIMENT`는 최대 20개이며 신규 페이지는 28일 COOLDOWN이다.
- 기존 WINNER와 `data/experiments.json`의 관찰 중 URL은 변경하지 않는다.
- 논산·철원·울진 CTR 실험 URL은 2026-09-29까지 변경하지 않으며 신규 발행 슬롯을 차감하지 않는다.
- URL·canonical·광고 배치·GA4 코드 변경, 일반 콘텐츠 Indexing API 사용, force push를 금지한다.
- AdSense CTR은 입력, 점수, 추천, 실험 KPI에 사용하지 않는다.
- 데이터가 없으면 `null`과 상태를 기록하며 검색량·수익·순위를 추정 생성하지 않는다.
- 안전 게이트 또는 회귀 테스트가 실패하면 콘텐츠 commit/push를 수행하지 않는다.

---

## File Structure

- Create `scripts/new_content_opportunity.py`: 검색 수요 증거 검증, overlap 상태, 신규 점수, 발행 선발, cohort와 pattern 판정 순수 함수.
- Create `scripts/daily_revenue_growth.py`: 조사 입력·기존 URL 인벤토리·실험을 읽고 후보/실험/색인 후보/일일 보고서를 생성하는 CLI.
- Create `scripts/content_launch_guard.py`: manifest와 staged 또는 기준 ref diff를 비교하는 커밋 전 안전 게이트.
- Create `tests/test_new_content_opportunity.py`: 증거, 점수, overlap, 선발, 실험·pattern 단위 테스트.
- Create `tests/test_daily_revenue_growth.py`: 결정적 산출물, 데이터 미확보 0발행, KPI와 기록 통합 테스트.
- Create `tests/test_content_launch_guard.py`: 보호 URL, 개수, manifest, canonical, 광고/GA4, sitemap/hub 검증 테스트.
- Create `data/new-content-research.json`: heartbeat가 채우는 10~20개 후보 조사 입력의 빈 초기 스키마.
- Create `data/new-content-opportunities.json`: 계산된 후보·decision·점수·근거 산출물.
- Create `data/content-launch-experiments.json`: 신규 페이지 전용 관찰 레지스트리.
- Create `data/google-index-candidates.json`: 자동 요청이 아닌 검토 큐.
- Create `data/content-launch-manifest.json`: 이번 실행에서 허용된 신규 URL과 관련 파일 목록.
- Create `reports/daily-revenue-growth.md`: 후보, 발행/보류 이유, 신규 KPI, pattern 상태와 데이터 한계.
- Create `docs/growth/daily-revenue-growth-runbook.md`: heartbeat가 매번 따를 실행 순서와 실패 처리.
- Modify `scripts/revenue_growth.py`: 신규 콘텐츠 KPI와 실험 요약을 기존 Revenue 산출물에 선택적으로 결합.
- Modify `scripts/quality_reports.py`: active content experiments, new-page win rate, pattern/cluster 위험을 기존 상단 대시보드에 추가.
- Modify `.github/workflows/seo-qa.yml`: 기존 감사→성과→Revenue→dashboard 순서를 유지하며 content launch guard를 회귀 테스트 전에 추가.
- Modify `PROJECT_HISTORY.md`가 존재하면 해당 파일, 없으면 `docs/growth/2026-09-01-daily-revenue-growth-automation.md`: 구현·검증·예약 상태 기록.

---

### Task 1: Direct Demand Evidence and New Content Score

**Files:**
- Create: `scripts/new_content_opportunity.py`
- Create: `tests/test_new_content_opportunity.py`

**Interfaces:**
- Produces: `validate_demand_evidence(evidence: dict, as_of: str, max_age_days: int = 7) -> dict`
- Produces: `classify_overlap(candidate: dict, closest: dict | None) -> dict`
- Produces: `score_new_content(candidate: dict) -> dict`

- [ ] **Step 1: Write failing evidence and overlap tests**

```python
from scripts.new_content_opportunity import classify_overlap, score_new_content, validate_demand_evidence


def verified_query_evidence():
    return {
        "source": "NAVER_QUERY_EXPORT",
        "query": "논산 무료 차박 화장실",
        "period": {"start": "2026-08-25", "end": "2026-08-31"},
        "metrics": {"impressions": 420, "clicks": 12},
        "collectedAt": "2026-09-01T03:40:00+09:00",
        "evidenceRef": "data/research/naver-query-2026-09-01.json",
        "status": "VERIFIED",
    }


def test_verified_evidence_requires_query_period_metric_and_reference():
    result = validate_demand_evidence(verified_query_evidence(), "2026-09-01")
    assert result["status"] == "VERIFIED"
    missing = {**verified_query_evidence(), "evidenceRef": None}
    assert validate_demand_evidence(missing, "2026-09-01")["status"] == "INSUFFICIENT_DATA"


def test_winner_url_performance_is_not_direct_query_demand():
    evidence = {**verified_query_evidence(), "source": "RELATED_WINNER_URL_PERFORMANCE"}
    assert validate_demand_evidence(evidence, "2026-09-01")["status"] == "ESTIMATED"


def test_same_user_goal_is_same_intent_even_when_words_differ():
    candidate = {"targetIntent": "논산에서 무료로 차박하고 화장실을 이용할 장소 찾기"}
    closest = {"url": "/kor/report/camp/nonsan.html", "targetIntent": "논산 무료 차박 장소와 화장실 확인"}
    result = classify_overlap(candidate, closest)
    assert result["level"] == "SAME_INTENT"
    assert result["decision"] == "IMPROVE_EXISTING"


def test_score_has_exactly_100_available_points_and_explanations():
    candidate = {
        "demand": {"status": "VERIFIED", "strength": 0.8},
        "winnerRelevance": 0.8,
        "overlap": {"level": "NO_OVERLAP"},
        "monetizationPotential": 0.6,
        "clusterExpandability": 0.7,
        "differentiation": 0.9,
        "benefitVsCost": 0.8,
    }
    result = score_new_content(candidate)
    assert sum(row["max"] for row in result["components"]) == 100
    assert all(row["reason"] for row in result["components"])
    assert "adsenseCtr" not in str(result)
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `python3 -m pytest tests/test_new_content_opportunity.py -q`

Expected: FAIL because `scripts.new_content_opportunity` does not exist.

- [ ] **Step 3: Implement evidence validation, deterministic overlap rules and score components**

```python
DIRECT_QUERY_SOURCES = {"NAVER_QUERY_EXPORT", "GSC_QUERY_EXPORT", "SEARCH_SERVICE_QUERY_METRIC"}
OVERLAP_DECISIONS = {
    "NO_OVERLAP": "NEW_PAGE",
    "LOW_OVERLAP": "NEW_PAGE",
    "MEDIUM_OVERLAP": "WAIT_FOR_DATA",
    "HIGH_OVERLAP": "REJECT",
    "SAME_INTENT": "IMPROVE_EXISTING",
}
SCORE_WEIGHTS = {
    "searchDemand": 25,
    "winnerRelevance": 15,
    "intentNonOverlap": 20,
    "monetizationPotential": 15,
    "clusterExpandability": 10,
    "differentiation": 10,
    "benefitVsCost": 5,
}


def validate_demand_evidence(evidence, as_of, max_age_days=7):
    required = evidence.get("query") and evidence.get("period", {}).get("end") and evidence.get("metrics") and evidence.get("evidenceRef")
    if not required:
        return {**evidence, "status": "INSUFFICIENT_DATA", "reason": "Missing query, period, metrics, or evidence reference."}
    if evidence.get("source") not in DIRECT_QUERY_SOURCES:
        return {**evidence, "status": "ESTIMATED", "reason": "Source is not direct query demand."}
    age = (date.fromisoformat(as_of) - date.fromisoformat(evidence["period"]["end"])).days
    status = "STALE_DATA" if age > max_age_days else "VERIFIED"
    return {**evidence, "status": status, "reason": "Direct query evidence validated."}
```

Implement `classify_overlap` so an exact normalized goal match returns `SAME_INTENT`; otherwise it consumes heartbeat-provided `semanticSimilarity` and `goalRelation` with fixed thresholds: same goal→`SAME_INTENT`, similarity `>=0.85`→`HIGH_OVERLAP`, `>=0.65`→`MEDIUM_OVERLAP`, `>=0.35`→`LOW_OVERLAP`, else `NO_OVERLAP`. Store closest URL, similarity, compared title/H1/H2 and explanation. Implement `score_new_content` with the exact weights above and clamp every normalized input to 0–1; map overlap to non-overlap factors `NO=1`, `LOW=.65`, `MEDIUM=.25`, `HIGH=0`, `SAME=0`.

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run: `python3 -m pytest tests/test_new_content_opportunity.py -q`

Expected: all Task 1 tests pass.

- [ ] **Step 5: Commit the evidence and scoring unit**

```bash
git add scripts/new_content_opportunity.py tests/test_new_content_opportunity.py
git commit -m "feat: score verified new content demand"
```

---

### Task 2: Candidate Selection, Experiment Capacity and Pattern Learning

**Files:**
- Modify: `scripts/new_content_opportunity.py`
- Modify: `tests/test_new_content_opportunity.py`

**Interfaces:**
- Produces: `select_new_pages(candidates: list[dict], active_launches: int, published_last_24h: list[dict], default_limit: int = 3, hard_limit: int = 5) -> list[dict]`
- Produces: `evaluate_launch_cohort(experiments: list[dict], as_of: str) -> dict`
- Produces: `evaluate_pattern(experiments: list[dict], pattern: str, as_of: str) -> str`
- Produces: `build_experiment(candidate: dict, published_on: str) -> dict`

- [ ] **Step 1: Add failing selection and cohort tests**

```python
from scripts.new_content_opportunity import build_experiment, evaluate_launch_cohort, evaluate_pattern, select_new_pages


def candidate(index, score, overlap="NO_OVERLAP", demand="VERIFIED"):
    return {
        "candidateId": f"C-{index}", "url": f"/new-{index}.html", "score": score,
        "demand": {"status": demand}, "overlap": {"level": overlap}, "decision": "NEW_PAGE",
    }


def test_default_three_and_strict_extra_slots():
    rows = [candidate(1, 94), candidate(2, 90), candidate(3, 82), candidate(4, 86), candidate(5, 84)]
    assert [row["candidateId"] for row in select_new_pages(rows, 0, [])] == ["C-1", "C-2", "C-3", "C-4"]


def test_low_overlap_cannot_use_fourth_slot_and_unverified_never_publishes():
    rows = [candidate(1, 95), candidate(2, 94), candidate(3, 93), candidate(4, 92, "LOW_OVERLAP"), candidate(5, 99, demand="ESTIMATED")]
    assert len(select_new_pages(rows, 0, [])) == 3


def test_twenty_active_launches_block_all_new_pages_but_ctr_experiments_do_not_count():
    assert select_new_pages([candidate(1, 99)], 20, []) == []


def test_recent_24_hour_publications_reduce_remaining_slots():
    recent = [{"publishedAt": "2026-09-01T01:00:00+09:00"} for _ in range(4)]
    assert len(select_new_pages([candidate(1, 99), candidate(2, 98)], 4, recent)) == 1


def test_only_mature_28_day_launches_enter_win_rate():
    rows = [
        {"type": "CONTENT_LAUNCH_EXPERIMENT", "publishedOn": "2026-08-01", "result": "WINNER"},
        {"type": "CONTENT_LAUNCH_EXPERIMENT", "publishedOn": "2026-08-20", "result": None},
        {"type": "SEARCH_CTR_EXPERIMENT", "publishedOn": "2026-08-01", "result": "WINNER"},
    ]
    result = evaluate_launch_cohort(rows, "2026-09-01")
    assert result == {"mature": 1, "winners": 1, "winRate": 1.0}


def test_pattern_requires_ten_mature_results():
    nine = [{"type": "CONTENT_LAUNCH_EXPERIMENT", "pattern": "camp-free", "publishedOn": "2026-07-01", "result": "WINNER"} for _ in range(9)]
    assert evaluate_pattern(nine, "camp-free", "2026-09-01") == "OBSERVE_PATTERN"
    ten = nine + [{"type": "CONTENT_LAUNCH_EXPERIMENT", "pattern": "camp-free", "publishedOn": "2026-07-01", "result": "WINNER"}]
    assert evaluate_pattern(ten, "camp-free", "2026-09-01") == "SCALE_PATTERN"
```

- [ ] **Step 2: Run tests and verify RED**

Run: `python3 -m pytest tests/test_new_content_opportunity.py -q`

Expected: FAIL on imports for the four new functions.

- [ ] **Step 3: Implement exact selection and experiment rules**

Implement selection as follows: discard non-`VERIFIED`, non-`NEW_PAGE`, score `<70`, overlap outside `NO_OVERLAP|LOW_OVERLAP`; sort by `(-score, url)`; select the first three; append positions four and five only when score `>=85` and overlap is exactly `NO_OVERLAP`; return none when `active_launches >=20`. Count launches whose `publishedAt` is within the rolling 24 hours ending at the run time and cap the result by both `5-published_last_24h` and `20-active_launches`; do not reset the count at midnight. `build_experiment` must create `EXP-CONTENT-YYYYMMDD-NN`, `status: OBSERVING`, `publishedAt`, `cooldownUntil` and `observeUntil` at +28 days, and all new-page before metrics as `null` with `NOT_AVAILABLE`.

Implement mature cohort age with calendar days. Pattern rules use only mature launch experiments: at least 10 records, `WINNER >=4` or `WINNER+PROMISING >=7` → `SCALE_PATTERN`; `FAILED >=8` and `WINNER ==0` → `PAUSE_PATTERN`; otherwise `OBSERVE_PATTERN`.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `python3 -m pytest tests/test_new_content_opportunity.py -q`

Expected: all tests pass.

- [ ] **Step 5: Commit selection and learning rules**

```bash
git add scripts/new_content_opportunity.py tests/test_new_content_opportunity.py
git commit -m "feat: select and measure content launches"
```

---

### Task 3: Deterministic Daily Analysis Artifacts

**Files:**
- Create: `scripts/daily_revenue_growth.py`
- Create: `tests/test_daily_revenue_growth.py`
- Create: `data/new-content-research.json`
- Create: `data/new-content-opportunities.json`
- Create: `data/content-launch-experiments.json`
- Create: `data/google-index-candidates.json`
- Create: `data/content-launch-manifest.json`
- Create: `reports/daily-revenue-growth.md`

**Interfaces:**
- Produces: `run_daily_analysis(root: Path, as_of: str, research_path: Path, write: bool = True) -> dict`
- Consumes: Task 1 and 2 functions, `data/page-performance.json`, `data/revenue-opportunities.json`, `data/experiments.json`.

- [ ] **Step 1: Write a failing zero-publication integration test**

```python
def test_indirect_or_missing_demand_generates_wait_for_data_and_zero_manifest(tmp_path):
    write_json(tmp_path / "research.json", {
        "asOf": "2026-09-01", "candidates": [{
            "candidateId": "C-1", "url": "/kor/report/camp/new.html",
            "targetIntent": "새 장소 찾기", "demandEvidence": [{
                "source": "RELATED_WINNER_URL_PERFORMANCE", "query": "새 장소",
                "period": {"start": "2026-08-25", "end": "2026-08-31"},
                "metrics": {"impressions": 100}, "evidenceRef": "data/page-performance.json", "status": "VERIFIED",
            }], "semanticSimilarity": 0.1, "goalRelation": "DISTINCT",
        }]})
    summary = run_daily_analysis(tmp_path, "2026-09-01", tmp_path / "research.json")
    assert summary["selected"] == []
    assert summary["candidates"][0]["decision"] == "WAIT_FOR_DATA"
    assert json.loads((tmp_path / "data/content-launch-manifest.json").read_text())["urls"] == []
```

- [ ] **Step 2: Write a failing deterministic 10–20 candidate and KPI test**

Create a fixture with 10 candidates, four valid direct-query candidates, three existing CTR experiments, and one mature launch winner. Assert the first and second runs produce byte-identical JSON; selected URLs follow Task 2; CTR experiments do not reduce launch capacity; report contains `New Page Win Rate`, `Active Content Experiments`, `Data Limitations`, `Published 0` or the exact selected count.

- [ ] **Step 3: Run tests and verify RED**

Run: `python3 -m pytest tests/test_daily_revenue_growth.py -q`

Expected: FAIL because the daily runner and initial artifacts do not exist.

- [ ] **Step 4: Implement the daily runner and CLI**

Use this schema boundary:

```python
def run_daily_analysis(root, as_of, research_path, write=True):
    research = read_json(research_path, {"candidates": []})
    inventory = read_json(root / "data/page-performance.json", {"pages": []})
    launches = read_json(root / "data/content-launch-experiments.json", {"experiments": []})
    ctr = read_json(root / "data/experiments.json", {"experiments": []})
    candidates = evaluate_candidates(research["candidates"], inventory["pages"], as_of)
    active_launches = sum(row.get("status") == "OBSERVING" for row in launches["experiments"])
    recent = launches_published_in_last_24h(launches["experiments"], as_of)
    selected = select_new_pages(candidates, active_launches, recent)
    return build_daily_payload(candidates, selected, launches, ctr, as_of)
```

Reject research counts outside 10–20 when any candidate is selected; an empty/unavailable research input is a valid 0-publication run with `INSUFFICIENT_DATA`. Write JSON with sorted keys and stable URL ordering. The manifest contains `runId`, `asOf`, selected `urls`, `candidateIds`, allowed content paths, sitemap path, hub path, experiment IDs and `status: READY|NO_PUBLICATION`. Google index candidates contain review state only and no API call field.

- [ ] **Step 5: Add initial empty artifacts without fabricated metrics**

Initialize all data files with `schemaVersion: 1`, `asOf: 2026-09-01`, empty arrays, and status `INSUFFICIENT_DATA` or `NO_PUBLICATION`. The report must state that no direct query research snapshot has yet been stored and therefore zero pages were published.

- [ ] **Step 6: Run focused tests and verify GREEN**

Run: `python3 -m pytest tests/test_daily_revenue_growth.py -q`

Expected: all tests pass and reruns are byte-identical.

- [ ] **Step 7: Commit daily analysis artifacts**

```bash
git add scripts/daily_revenue_growth.py tests/test_daily_revenue_growth.py data/new-content-research.json data/new-content-opportunities.json data/content-launch-experiments.json data/google-index-candidates.json data/content-launch-manifest.json reports/daily-revenue-growth.md
git commit -m "feat: add deterministic daily growth analysis"
```

---

### Task 4: Pre-Commit Content Launch Safety Gate

**Files:**
- Create: `scripts/content_launch_guard.py`
- Create: `tests/test_content_launch_guard.py`

**Interfaces:**
- Produces: `validate_launch(root: Path, manifest: dict, changed_paths: list[str]) -> list[str]`
- Produces CLI: `python3 scripts/content_launch_guard.py --root . --manifest data/content-launch-manifest.json --base-ref HEAD`

- [ ] **Step 1: Write failing guard tests**

```python
def test_guard_rejects_unmanifested_sixth_page(tmp_path):
    manifest = launch_manifest(urls=[f"/kor/report/camp/n-{i}.html" for i in range(5)])
    changed = [f"kor/report/camp/n-{i}.html" for i in range(6)]
    assert "NEW_CONTENT_LIMIT_EXCEEDED" in validate_launch(tmp_path, manifest, changed)


def test_guard_rejects_protected_ctr_and_winner_changes(tmp_path):
    changed = ["kor/report/camp/nonsan.html", "kor/report/camp/namyangju.html"]
    errors = validate_launch(tmp_path, launch_manifest(urls=[]), changed)
    assert "PROTECTED_EXPERIMENT_CHANGED" in errors
    assert "PROTECTED_WINNER_CHANGED" in errors


def test_guard_rejects_manifest_html_mismatch_and_missing_discovery(tmp_path):
    create_page(tmp_path, "kor/report/camp/new.html", canonical="/wrong.html")
    errors = validate_launch(tmp_path, launch_manifest(urls=["/kor/report/camp/new.html"]), ["kor/report/camp/new.html"])
    assert {"MANIFEST_DIFF_MISMATCH", "CANONICAL_MISMATCH", "SITEMAP_ENTRY_MISSING", "HUB_LINK_MISSING"} <= set(errors)


def test_guard_rejects_ad_or_ga4_mutation_in_existing_files(tmp_path):
    errors = validate_launch(tmp_path, launch_manifest(urls=[]), ["assets/js/ads.js", "assets/js/ga4.js"])
    assert "MONETIZATION_OR_ANALYTICS_CHANGED" in errors


def test_dead_candidate_never_becomes_delete_instruction(tmp_path):
    manifest = {**launch_manifest(urls=[]), "deletions": ["old.html"]}
    assert "DELETION_NOT_ALLOWED" in validate_launch(tmp_path, manifest, ["old.html"])
```

- [ ] **Step 2: Run tests and verify RED**

Run: `python3 -m pytest tests/test_content_launch_guard.py -q`

Expected: FAIL because the guard does not exist.

- [ ] **Step 3: Implement diff and HTML contract validation**

Parse `git diff --name-status <base-ref>` without shell interpolation. Accept only manifest-listed new HTML, the listed sitemap/hub, experiment/index/report/history artifacts, and deterministic audit outputs. Load protected winners from `data/revenue-opportunities.json` and protected experiment URLs from `data/experiments.json`. Reject deletions and renames. For every new HTML parse title, H1, canonical, viewport, JSON-LD and internal links; require exact canonical, unique title/H1/canonical against `data/site-audit.json`, sitemap entry, hub link and no broken local target. Compare existing changed HTML against base-ref and reject changes containing `adsbygoogle`, `ca-pub-`, GA4 loader/config or canonical differences.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `python3 -m pytest tests/test_content_launch_guard.py -q`

Expected: all guard tests pass.

- [ ] **Step 5: Commit the safety gate**

```bash
git add scripts/content_launch_guard.py tests/test_content_launch_guard.py
git commit -m "feat: guard automated content launches"
```

---

### Task 5: Revenue KPI and Dashboard Integration

**Files:**
- Modify: `scripts/revenue_growth.py`
- Modify: `scripts/quality_reports.py`
- Modify: `tests/test_revenue_growth_integration.py`
- Modify: `tests/test_quality_reports.py`

**Interfaces:**
- Modify: `run_revenue_growth(..., content_experiments_path: Path | None = None, daily_growth_path: Path | None = None) -> tuple[dict, dict]`
- Consumes Task 3 daily payload.

- [ ] **Step 1: Add failing Revenue aggregation tests**

Add fixtures with two active launch experiments, one mature winner and one mature failed launch. Assert summary fields are:

```python
assert summary["contentGrowth"]["activeExperiments"] == 2
assert summary["contentGrowth"]["newPages28d"] == 2
assert summary["contentGrowth"]["matureCohort"] == 2
assert summary["contentGrowth"]["newPageWinRate"] == 0.5
assert summary["contentGrowth"]["revenuePerNewPage"] is None
assert summary["contentGrowth"]["revenuePerNewPageStatus"] == "INSUFFICIENT_DATA"
```

- [ ] **Step 2: Add failing dashboard assertions**

Extend `revenue_fixture()` with `contentGrowth` and assert the rendered page contains `CONTENT LAUNCH EXPERIMENTS`, `New pages / 28d`, `New page win rate`, `Pattern status`, and `Secondary cluster`, while still placing `REVENUE GROWTH CONTROL CENTER` before `PAGE SCORE` and containing no AdSense CTR or ad-click code.

- [ ] **Step 3: Run focused tests and verify RED**

Run: `python3 -m pytest tests/test_revenue_growth_integration.py tests/test_quality_reports.py -q`

Expected: FAIL because content-growth fields and dashboard cards are absent.

- [ ] **Step 4: Implement optional aggregation and rendering**

When files are absent, return empty counts with `NOT_CONNECTED`/`INSUFFICIENT_DATA`; never substitute zero revenue. Compute `revenuePerNewPage` only when identical-period URL revenue exists for every denominator page. Render active experiments with URL, started, observe-until and status; show pattern `SCALE|PAUSE|OBSERVE`, camping cluster and secondary-cluster candidates. Keep current winner and CTR experiment sections unchanged.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `python3 -m pytest tests/test_revenue_growth_integration.py tests/test_quality_reports.py -q`

Expected: all focused tests pass.

- [ ] **Step 6: Commit dashboard integration**

```bash
git add scripts/revenue_growth.py scripts/quality_reports.py tests/test_revenue_growth_integration.py tests/test_quality_reports.py
git commit -m "feat: report content launch performance"
```

---

### Task 6: GitHub Actions Deterministic Validation Gate

**Files:**
- Modify: `.github/workflows/seo-qa.yml`
- Modify: `tests/test_seo_qa_workflow.py`

**Interfaces:**
- Consumes: Task 3 CLI and Task 4 guard CLI.

- [ ] **Step 1: Add failing workflow-order tests**

```python
def test_workflow_runs_daily_analysis_and_launch_guard_before_regression_tests(self):
    source = WORKFLOW.read_text(encoding="utf-8")
    audit = source.index("scripts/seo_audit.py")
    revenue = source.index("scripts/revenue_growth.py")
    daily = source.index("scripts/daily_revenue_growth.py")
    guard = source.index("scripts/content_launch_guard.py")
    dashboard = source.rindex("scripts/quality_audit.py")
    tests = source.index("python3 -m unittest discover")
    assert audit < revenue < daily < guard < dashboard < tests
    assert "schedule:" not in source
    assert "permissions:\n  contents: read" in source
```

- [ ] **Step 2: Run the workflow test and verify RED**

Run: `python3 -m pytest tests/test_seo_qa_workflow.py -q`

Expected: FAIL because both new commands are absent.

- [ ] **Step 3: Add validation-only workflow steps**

After existing Revenue calculation, run daily analysis in validation mode against committed research, then guard against `${{ github.event.before }}` on push and `origin/${{ github.base_ref }}` on pull requests. If the event has no usable base, use `HEAD^`. Do not add `schedule`, write permission, commit or push commands. Add new JSON and daily report to the uploaded artifact paths.

- [ ] **Step 4: Run workflow tests and verify GREEN**

Run: `python3 -m pytest tests/test_seo_qa_workflow.py -q`

Expected: all workflow tests pass.

- [ ] **Step 5: Commit workflow integration**

```bash
git add .github/workflows/seo-qa.yml tests/test_seo_qa_workflow.py
git commit -m "ci: validate daily content launches"
```

---

### Task 7: Operating Runbook, History and Fail-Closed Dry Run

**Files:**
- Create: `docs/growth/daily-revenue-growth-runbook.md`
- Create or modify: `docs/growth/2026-09-01-daily-revenue-growth-automation.md`
- Modify only if present: `PROJECT_HISTORY.md`
- Modify: `reports/daily-revenue-growth.md`
- Modify: `data/new-content-opportunities.json`
- Modify: `data/content-launch-manifest.json`

**Interfaces:**
- The runbook becomes the source text for the Codex heartbeat prompt in Task 8.

- [ ] **Step 1: Write the runbook with the exact execution contract**

Document this order: update/read performance data → verify dates and periods → research 10–20 candidates → store query evidence → run analysis → stop with 0 pages if no eligible candidates → write at most selected pages → add only natural hub/sitemap links → create experiments and index review candidates → run guard → run SEO audit, quality audit, unittest, pytest → inspect allowed diff → fast-forward check → commit → push main. State that data/login/network/test/push conflict failures stop the run, never lower thresholds, never force push, and never edit protected URLs.

- [ ] **Step 2: Execute a no-evidence dry run**

Run:

```bash
python3 scripts/daily_revenue_growth.py --as-of 2026-09-01 --research data/new-content-research.json
python3 scripts/content_launch_guard.py --root . --manifest data/content-launch-manifest.json --base-ref HEAD
```

Expected: success, `selected: 0`, manifest `NO_PUBLICATION`, no content HTML changes, report explicitly says `INSUFFICIENT_DATA`.

- [ ] **Step 3: Run complete project verification**

Run:

```bash
python3 scripts/seo_audit.py . --json data/site-audit.json --markdown reports/seo-audit.md
python3 scripts/quality_audit.py --as-of 2026-09-01 --dashboard /tmp/site-quality-dashboard.html
python3 scripts/revenue_growth.py --as-of 2026-09-01 --naver-snapshot data/naver/search-advisor-2026-08-30.json
python3 scripts/daily_revenue_growth.py --as-of 2026-09-01 --research data/new-content-research.json
python3 scripts/content_launch_guard.py --root . --manifest data/content-launch-manifest.json --base-ref HEAD
python3 -m unittest discover -s tests -q
python3 -m pytest -q
```

Expected: every command exits 0; no existing content pages are modified; all tests pass.

- [ ] **Step 4: Record implementation and current experiment state**

Record the commit list, generated files, zero-publication reason, active CTR experiments through 2026-09-29, launch capacity 20, rolling 24-hour remaining publication slots, data limitations, test totals and next five-hour run time. If `PROJECT_HISTORY.md` does not exist, use the dated growth log as the authoritative same-purpose record and state that choice.

- [ ] **Step 5: Commit the verified operating system**

```bash
git add docs/growth/daily-revenue-growth-runbook.md docs/growth/2026-09-01-daily-revenue-growth-automation.md reports/daily-revenue-growth.md data/new-content-opportunities.json data/content-launch-manifest.json data/google-index-candidates.json data/content-launch-experiments.json
git commit -m "docs: record daily revenue growth operations"
```

---

### Task 8: Create the Five-Hour Codex Heartbeat

**Files:**
- No repository file mutation beyond Task 7; create the schedule through the Codex automation API.

**Interfaces:**
- Consumes: `docs/growth/daily-revenue-growth-runbook.md` and all verified CLIs.

- [ ] **Step 1: Confirm the repository is clean except pre-existing user files**

Run: `git status --short`

Expected: no uncommitted implementation files; only the previously identified unrelated user-owned untracked files may remain.

- [ ] **Step 2: Push the verified commits to main**

Run: `git pull --ff-only` followed by `git push origin main`.

Expected: fast-forward succeeds and remote main accepts the commits. On conflict or network failure, stop without force push and do not create an active heartbeat that could run against an unshipped system.

- [ ] **Step 3: Create one heartbeat on a continuous five-hour interval**

Use the Codex automation API with kind `heartbeat`, destination `thread`, status active, start `2026-09-01 04:00 Asia/Seoul`, and an interval of five hours. The prompt must instruct the task to read the runbook and current project history, collect and preserve direct query evidence, allow 0 pages, enforce all thresholds, run all guards/tests, commit and push only on success, and report failures without force push. Do not create a GitHub Actions cron.

- [ ] **Step 4: View and verify the saved automation**

Use the returned automation ID in view mode. Verify name, active state, target thread, `2026-09-01 04:00 Asia/Seoul` start, five-hour interval, and the complete fail-closed prompt. If any field differs, update the same automation instead of creating a duplicate.

- [ ] **Step 5: Record the automation ID without credentials**

Append the automation name, ID, schedule and activation date to the authoritative growth history. Do not store cookies, tokens, account IDs or login data.

- [ ] **Step 6: Commit and push the schedule record**

```bash
git add docs/growth/2026-09-01-daily-revenue-growth-automation.md PROJECT_HISTORY.md
git commit -m "docs: activate five-hour revenue growth heartbeat"
git push origin main
```

If `PROJECT_HISTORY.md` is absent, omit it from `git add` and commit only the growth log.

---

### Task 9: Final Regression and Handoff

**Files:**
- Verify only; modify only if a regression is found, using the relevant task’s TDD loop.

- [ ] **Step 1: Run targeted safety tests**

Run:

```bash
python3 -m pytest tests/test_new_content_opportunity.py tests/test_daily_revenue_growth.py tests/test_content_launch_guard.py tests/test_revenue_growth_integration.py tests/test_quality_reports.py tests/test_seo_qa_workflow.py -q
```

Expected: all targeted tests pass, including 0-publication, maximum five, active limit 20, protected winners/CTR URLs, missing data, no AdSense CTR and no deletion.

- [ ] **Step 2: Run the complete suite one final time**

Run:

```bash
python3 -m unittest discover -s tests -q
python3 -m pytest -q
git diff --check
git status --short
```

Expected: both suites pass; no whitespace errors; no unexpected tracked changes.

- [ ] **Step 3: Report the operational outcome**

Report current 28-day revenue/KPIs only from verified files, candidate count, selected/published count, active launch experiments, protected winners and CTR experiments, exact data status, automation schedule and ID, commit hashes, test totals, and the next 14/28-day measurement dates. If the initial run published 0 pages, state that this is the intended safe result rather than a failure.
