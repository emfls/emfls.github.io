# Naver URL Performance Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 네이버 Search Advisor UI의 실제 URL TOP 30 데이터를 기존 Revenue Opportunity 시스템에 안전하게 연결하고, 데이터 품질을 검증한 뒤 콘텐츠를 수정하지 않은 상태에서 최대 3개의 수정 가능 후보를 선별한다.

**Architecture:** 원본 UI 스냅샷은 불변 입력으로 보존하고, 새 `naver_performance.py`가 URL 정규화·행 검증·사이트 매칭·품질 게이트를 담당한다. `revenue_growth.py`는 검증 결과를 기존 페이지 성과 레코드에 결합하며, `revenue_opportunity.py`는 캠핑 분포 기반 점수와 보호 규칙을 적용한다. 보고서와 기존 대시보드는 같은 요약 JSON만 읽어 기간 불일치, 순위 부재, TOP 30 표본 한계를 일관되게 표시한다.

**Tech Stack:** Python 3.11 표준 라이브러리, JSON, pytest/unittest, 기존 정적 HTML 품질 대시보드, GitHub Actions

**Spec:** `docs/superpowers/specs/2026-08-31-naver-url-performance-design.md`

## Global Constraints

- 네이버 입력은 2026-08-01~2026-08-30 Search Advisor UI TOP 30의 실제 값만 사용한다.
- 평균 순위는 `null` 및 `NOT_AVAILABLE`이며 다른 점수 항목으로 10점을 재분배하지 않는다.
- TOP 30 밖 URL은 검색 성과 0이 아니라 `NOT_AVAILABLE`이다. 실제 0이 확인된 행만 `ZERO_VERIFIED`다.
- 네이버 30일과 GA4·Google·AdSense 28일은 합산하지 않고 `PERIOD_MISMATCH`로 표시한다.
- 매칭률 95% 미만, invalid 행, 정규화 중복 충돌 또는 CTR 산술 오류가 있으면 Opportunity 재분류와 후보 선별을 중단한다.
- WINNER와 COOLDOWN은 후보에서 제외하며 수정 가능 후보는 최대 3개다.
- 이번 실행에서 HTML, URL, title, description, canonical, 광고 배치 및 콘텐츠 본문은 수정하지 않는다.
- AdSense CTR은 어떤 점수·분류·추천에도 사용하지 않는다.
- 기존 PAGE_SCORE 대시보드는 제거하지 않고 Revenue Growth Control Center를 확장한다.
- 모든 생성 결과는 결정적으로 재현되어야 하며 중요한 변경과 실험 상태를 `PROJECT_HISTORY.md`에 기록한다.

## File Structure

- Modify: `scripts/quality_site.py` — shared canonical URL normalization for performance joins.
- Create: `scripts/naver_performance.py` — Naver UI snapshot schema validation, canonical inventory matching, quality gate and cluster distribution calculations.
- Create: `tests/test_naver_performance.py` — normalization, arithmetic validation, zero/unavailable distinction, duplicate/invalid/gate tests.
- Create: `data/naver/search-advisor-2026-08-30.json` — browser UI에서 확인한 원본 TOP 30 snapshot and source metadata.
- Modify: `scripts/revenue_opportunity.py` — supported evidence statuses, distribution-aware components, Naver eligibility and protection rules.
- Modify: `scripts/revenue_growth.py` — snapshot import, page join, cluster benchmarks, quality summary and maximum-three eligible candidates.
- Modify: `tests/test_revenue_opportunity.py` — rank-null, exposure threshold, WINNER/COOLDOWN, maximum-three and AdSense CTR regressions.
- Modify: `tests/test_revenue_growth_integration.py` — matching gate pass/fail, page records, period mismatch and deterministic output integration tests.
- Modify: `scripts/quality_reports.py` — existing dashboard Revenue Growth section with data quality warning, Naver metrics and eligible candidates.
- Modify: `tests/test_quality_reports.py` — warning/status/TOP10/dashboard rendering assertions.
- Modify: `.github/workflows/seo-qa.yml` — validate Naver snapshot before Revenue Opportunity generation and upload the data-quality report.
- Create: `reports/naver-data-quality.md` — deterministic import and matching-quality report.
- Modify generated: `data/page-performance.json`, `data/revenue-opportunities.json`, `reports/revenue-growth-report.md`, `reports/site-quality-dashboard.html`.
- Modify: `PROJECT_HISTORY.md` — source limits, selected candidates, zero content edits, observation decision and verification evidence.

---

### Task 1: Naver Snapshot Validation and URL Normalization

**Files:**
- Modify: `scripts/quality_site.py`
- Create: `scripts/naver_performance.py`
- Create: `tests/test_naver_performance.py`
- Modify: `tests/test_quality_site.py`

**Interfaces:**
- Consumes: raw row dictionaries with `sourceUrl`, `clicks`, `impressions`, `ctr`, and snapshot metadata.
- Produces: expanded shared `normalize_url(url: str) -> str`, `normalize_naver_url(url: str) -> str`, `validate_naver_row(row: dict) -> list[str]`, `load_naver_snapshot(path: Path) -> dict`, and `match_naver_rows(snapshot: dict, site_urls: list[str], canonical_map: dict[str, str] | None = None) -> dict`.

- [ ] **Step 1: Write failing normalization tests**

```python
from scripts.naver_performance import normalize_naver_url
from scripts.quality_site import normalize_url


def test_normalize_naver_url_removes_origin_query_fragment_and_index():
    assert normalize_naver_url("https://www.emfls.github.io/kor/report/camp/index.html?x=1#top") == "/kor/report/camp/"


def test_normalize_naver_url_decodes_utf8_once_and_preserves_case():
    assert normalize_naver_url("https://emfls.github.io/%ED%95%9C%EA%B8%80/A.html") == "/한글/A.html"


def test_shared_normalizer_is_the_same_joining_rule():
    source = "https://emfls.github.io/a/index.html?utm_source=x#answer"
    assert normalize_naver_url(source) == normalize_url(source) == "/a/"
```

- [ ] **Step 2: Run the normalization tests and confirm the missing-module failure**

Run: `python3 -m pytest tests/test_naver_performance.py tests/test_quality_site.py -k normalize -v`

Expected: FAIL because `scripts.naver_performance` does not exist and the shared normalizer still retains query/fragment on relative paths.

- [ ] **Step 3: Implement deterministic Naver URL normalization**

```python
from scripts.quality_site import normalize_url


def normalize_naver_url(url):
    return normalize_url(url)
```

Extend `scripts.quality_site.normalize_url` with `urlsplit` and one UTF-8 `unquote` pass so every performance join uses the same rule. The implementation must reject non-HTTP schemes during Naver row validation and must not lowercase paths. Run all existing `quality_site` tests immediately to catch join regressions.

- [ ] **Step 4: Write failing row validation and matching tests**

```python
def test_validate_row_rejects_ctr_that_does_not_match_clicks_over_impressions():
    row = {"sourceUrl": "https://emfls.github.io/a.html", "clicks": 10, "impressions": 100, "ctr": 0.05}
    assert "CTR_MISMATCH" in validate_naver_row(row)


def test_matcher_reports_duplicate_normalized_urls_and_blocks_gate():
    snapshot = snapshot_with_rows([
        verified_row("https://emfls.github.io/a.html", 10, 100),
        verified_row("https://emfls.github.io/a.html?ref=x", 10, 100),
    ])
    result = match_naver_rows(snapshot, ["/a.html"])
    assert result["quality"]["duplicateNormalizedUrls"] == ["/a.html"]
    assert result["quality"]["gatePassed"] is False


def test_match_rate_below_95_percent_blocks_gate():
    rows = [verified_row(f"https://emfls.github.io/p-{index}.html", 1, 10) for index in range(20)]
    result = match_naver_rows(snapshot_with_rows(rows), [f"/p-{index}.html" for index in range(18)])
    assert result["quality"]["matchRate"] == 0.9
    assert result["quality"]["gatePassed"] is False
```

- [ ] **Step 5: Implement schema validation, canonical inventory matching and quality statistics**

Build the canonical map from `data/site-audit.json` rows where a canonical target is present, normalize both source and target, and pass it into `match_naver_rows`. The function must return this stable shape:

```python
{
    "matchedByUrl": {"/a.html": validated_row},
    "quality": {
        "rows": 1,
        "uniqueUrls": 1,
        "matched": 1,
        "matchRate": 1.0,
        "unmatched": [],
        "duplicateNormalizedUrls": [],
        "invalidRows": [],
        "rankAvailability": "NOT_AVAILABLE",
        "periodStatus": "PERIOD_MISMATCH",
        "gatePassed": True,
        "gateFailures": [],
    },
}
```

CTR validation accepts the one-decimal percentage shown by Search Advisor: `abs(displayed_ctr_percent - round(clicks / impressions * 100, 1)) <= 0.1`. If impressions are zero, clicks must also be zero and CTR must be zero. Canonical exact matches are automatic; case-insensitive-only matches are reported as ambiguous and left unmatched.

- [ ] **Step 6: Run focused tests**

Run: `python3 -m pytest tests/test_naver_performance.py -v`

Expected: PASS.

- [ ] **Step 7: Commit the validated adapter**

```bash
git add scripts/quality_site.py scripts/naver_performance.py tests/test_quality_site.py tests/test_naver_performance.py
git commit -m "feat: validate Naver URL performance snapshots"
```

### Task 2: Verified TOP 30 Snapshot and Data-Quality Gate

**Files:**
- Create: `data/naver/search-advisor-2026-08-30.json`
- Create: `reports/naver-data-quality.md`
- Modify: `tests/test_naver_performance.py`

**Interfaces:**
- Consumes: the 30 UI rows listed in the approved design evidence and site URLs from `data/page-scores.json`.
- Produces: `build_naver_quality_report(snapshot_path: Path, site_urls: list[str]) -> tuple[dict, str]` and a checked-in verified source snapshot.

- [ ] **Step 1: Add a failing fixture-level test for the real snapshot**

```python
def test_checked_in_snapshot_contains_exactly_30_verified_ui_rows():
    snapshot = load_naver_snapshot(Path("data/naver/search-advisor-2026-08-30.json"))
    assert len(snapshot["rows"]) == 30
    assert snapshot["source"] == "NAVER_SEARCH_ADVISOR_UI_TOP_30"
    assert snapshot["period"] == {"start": "2026-08-01", "end": "2026-08-30"}
    assert snapshot["rows"][0]["sourceUrl"].endswith("/kor/report/camp/gyeonggi-best.html")
    assert snapshot["rows"][0]["clicks"] == 138
    assert snapshot["rows"][0]["impressions"] == 1816
    assert snapshot["rows"][0]["ctr"] == 0.076
```

- [ ] **Step 2: Run the fixture test and confirm it fails because the snapshot is absent**

Run: `python3 -m pytest tests/test_naver_performance.py::test_checked_in_snapshot_contains_exactly_30_verified_ui_rows -v`

Expected: FAIL with `FileNotFoundError`.

- [ ] **Step 3: Add all 30 verified rows without rank or inferred metrics**

The JSON root must include:

```json
{
  "schemaVersion": 1,
  "source": "NAVER_SEARCH_ADVISOR_UI_TOP_30",
  "site": "https://emfls.github.io",
  "periodPreset": "RECENT_30_DAYS",
  "period": {"start": "2026-08-01", "end": "2026-08-30"},
  "dataUpdatedAt": "2026-08-30",
  "capturedAt": "2026-08-31",
  "limitations": ["TOP_30_ONLY", "AVERAGE_RANK_NOT_AVAILABLE", "NO_OFFICIAL_EXPORT"],
  "rows": []
}
```

Each row must carry the visible clicks, impressions and decimal CTR exactly. Set `averageRank` to `null`, `rankStatus` to `NOT_AVAILABLE`, and `status` to `VERIFIED`; do not add a row for any URL not shown in the UI.

- [ ] **Step 4: Write the failing real-data quality-report test**

```python
def test_real_snapshot_matches_site_inventory_and_reports_limitations():
    site_urls = [row["url"] for row in json.loads(Path("data/page-scores.json").read_text())["pages"]]
    result, markdown = build_naver_quality_report(Path("data/naver/search-advisor-2026-08-30.json"), site_urls)
    assert result["quality"]["matchRate"] >= 0.95
    assert result["quality"]["gatePassed"] is True
    assert result["quality"]["rankAvailability"] == "NOT_AVAILABLE"
    assert "PERIOD_MISMATCH" in markdown
    assert "TOP_30_ONLY" in markdown
```

- [ ] **Step 5: Implement deterministic Markdown quality reporting and CLI output**

Add `main()` options `--snapshot`, `--page-scores`, `--json-output` and `--report`. The report must list row count, unique count, matches, match rate, unmatched URLs, duplicates, invalid rows, period, rank availability, gate result and gate failures. It must never describe non-TOP30 URLs as zero.

- [ ] **Step 6: Generate and validate the real quality report**

Run: `python3 scripts/naver_performance.py --snapshot data/naver/search-advisor-2026-08-30.json --page-scores data/page-scores.json --report reports/naver-data-quality.md`

Expected: exit 0, `gatePassed: true`, match rate at least 95%, no invalid rows and no duplicate normalized URLs.

- [ ] **Step 7: Commit the source snapshot and quality report**

```bash
git add data/naver/search-advisor-2026-08-30.json reports/naver-data-quality.md scripts/naver_performance.py tests/test_naver_performance.py
git commit -m "data: add verified Naver URL performance snapshot"
```

### Task 3: Revenue Opportunity Scoring and Classification Integration

**Files:**
- Modify: `scripts/revenue_opportunity.py`
- Modify: `scripts/revenue_growth.py`
- Modify: `tests/test_revenue_opportunity.py`
- Modify: `tests/test_revenue_growth_integration.py`

**Interfaces:**
- Consumes: `match_naver_rows(...)["matchedByUrl"]`, `quality`, existing performance page records, optimization history and experiments.
- Produces: `camping_naver_benchmarks(records: list[dict]) -> dict`, enriched page channels, explainable score components, protected classifications and `eligibleCandidates` limited to three.

- [ ] **Step 1: Write failing scoring tests for rank absence and distribution thresholds**

```python
def test_naver_rank_absence_keeps_ranking_component_at_zero():
    record = performance_record(naver={"impressions": 704, "clicks": 40, "ctr": 0.057, "position": None, "positionStatus": "NOT_AVAILABLE", "status": "VERIFIED"})
    result = score_opportunity(record, naver_benchmarks(impressionsMedian=450, ctrMedian=0.084))
    ranking = next(item for item in result["components"] if item["name"] == "ranking_upside")
    assert ranking["score"] == 0
    assert ranking["status"] == "NOT_AVAILABLE"


def test_low_ctr_only_scores_ctr_gap_when_impressions_reach_cluster_median():
    low_exposure = performance_record(naver={"impressions": 100, "clicks": 1, "ctr": 0.01, "position": None, "status": "VERIFIED"})
    result = score_opportunity(low_exposure, naver_benchmarks(impressionsMedian=450, ctrMedian=0.084))
    ctr = next(item for item in result["components"] if item["name"] == "search_ctr_gap")
    assert ctr["score"] == 0
```

- [ ] **Step 2: Run the focused tests and verify the old scoring behavior fails**

Run: `python3 -m pytest tests/test_revenue_opportunity.py -k 'rank_absence or cluster_median' -v`

Expected: FAIL because current rank status is inherited as VERIFIED and CTR gap ignores exposure threshold.

- [ ] **Step 3: Implement camping percentiles and updated scoring**

`camping_naver_benchmarks` must calculate `coveredPages`, `impressionsMedian`, `clicksMedian`, `ctrMedian`, `weightedCtr`, and per-URL percentile ranks from the 29 verified camp rows. Impression and click components use a 50/50 blend of percentile and `log1p(value) / log1p(cluster_max)`; output remains capped at 20 and 15. CTR gap receives points only when `impressions >= impressionsMedian` and `ctr < ctrMedian`. `position is None` produces zero points with `NOT_AVAILABLE` status.

- [ ] **Step 4: Write failing protection, gate and candidate-limit tests**

```python
def test_verified_winner_is_protected_even_with_low_page_score_and_low_ctr():
    record = performance_record(pageScore=20, ga4=verified_revenue(), naver=verified_low_ctr())
    classification, action, _ = classify_record(record, score_opportunity(record, benchmarks()))
    assert (classification, action) == ("WINNER", "PROTECT")


def test_cooldown_and_below_median_exposure_are_not_eligible_candidates():
    records = [opportunity_record(cooldown=True), opportunity_record(impressions=100)]
    assert select_improvements(records, limit=3) == []


def test_quality_gate_failure_blocks_all_naver_reclassification():
    _, summary = run_fixture(naver_quality={"gatePassed": False})
    assert summary["eligibleCandidates"] == []
    assert summary["dataQuality"]["naver"]["rankingReliable"] is False
```

- [ ] **Step 5: Integrate the Naver snapshot and preserve evidence-state distinctions**

Extend `run_revenue_growth` with `naver_snapshot_path`. Matched rows get:

```python
{
    "impressions": row["impressions"],
    "clicks": row["clicks"],
    "ctr": row["ctr"],
    "position": None,
    "positionStatus": "NOT_AVAILABLE",
    "status": "VERIFIED",
    "period": snapshot["period"],
    "periodPreset": snapshot["periodPreset"],
    "source": snapshot["source"],
    "dataUpdatedAt": snapshot["dataUpdatedAt"],
    "crossSourceStatus": "PERIOD_MISMATCH"
}
```

Unmatched page inventory records get the same fields with metric values `None` and `status: NOT_AVAILABLE`. Add `NOT_AVAILABLE` and `ZERO_VERIFIED` to channel status validation without treating either as fresh verified evidence. Keep the overall candidate evidence label `VERIFIED_WITH_LIMITATIONS`, while retaining `naver.status == VERIFIED` for matched metrics.

- [ ] **Step 6: Tighten OPPORTUNITY eligibility and selection**

Classification requires verified Naver data, a passed quality gate, camping cluster, exposure at or above its median, CTR below its median, no verified revenue WINNER signal and no cooldown. `select_improvements` must cap at three even if a larger limit is passed. Gate failure must leave existing WINNERs protected while assigning non-winners `WAIT_FOR_DATA`; it must never create DEAD_CANDIDATE from `NOT_AVAILABLE` metrics.

- [ ] **Step 7: Verify integration and all Revenue Opportunity regressions**

Run: `python3 -m pytest tests/test_naver_performance.py tests/test_revenue_opportunity.py tests/test_revenue_growth_integration.py -v`

Expected: PASS, including AdSense CTR non-use, WINNER protection, COOLDOWN exclusion, maximum-three selection and deterministic rerun tests.

- [ ] **Step 8: Commit scoring and integration**

```bash
git add scripts/revenue_opportunity.py scripts/revenue_growth.py tests/test_revenue_opportunity.py tests/test_revenue_growth_integration.py
git commit -m "feat: rank verified Naver revenue opportunities"
```

### Task 4: Revenue Report and Existing Dashboard Extension

**Files:**
- Modify: `scripts/revenue_growth.py`
- Modify: `scripts/quality_reports.py`
- Modify: `tests/test_quality_reports.py`
- Modify generated: `data/page-performance.json`
- Modify generated: `data/revenue-opportunities.json`
- Modify generated: `reports/revenue-growth-report.md`
- Modify generated: `reports/site-quality-dashboard.html`

**Interfaces:**
- Consumes: the enriched Revenue Opportunity summary and page records from Task 3.
- Produces: a human-readable data-quality section, camping benchmarks, Naver-aware TOP 10, protected WINNERs and zero-change execution record in Markdown and HTML.

- [ ] **Step 1: Write failing report and dashboard assertions**

```python
def test_dashboard_shows_verified_matching_but_preserves_source_limit_warnings():
    html = render_dashboard(revenue_summary_with_verified_naver())
    assert "URL matching verified" in html
    assert "PERIOD_MISMATCH" in html
    assert "RANK_NOT_AVAILABLE" in html
    assert "TOP_30_ONLY" in html


def test_dashboard_top_opportunity_contains_actual_naver_metrics_and_benchmark():
    html = render_dashboard(revenue_summary_with_verified_naver())
    assert "704" in html
    assert "5.7%" in html
    assert "Camping CTR median" in html
    assert "Eligible for next content experiment" in html
```

- [ ] **Step 2: Run focused rendering tests and confirm missing fields fail**

Run: `python3 -m pytest tests/test_quality_reports.py -k 'naver or opportunity' -v`

Expected: FAIL because the current dashboard lacks Naver data-quality and benchmark fields.

- [ ] **Step 3: Extend the summary JSON and Markdown report**

Add `dataQuality.naver`, `crossSourcePeriodAlignment`, `campingCluster.naver`, `eligibleCandidates`, and `contentChanges: []`. Each TOP 10 entry must print actual Naver impressions/clicks/CTR, rank `N/A`, cluster medians, GA4 values, PAGE_SCORE, last optimization date, cooldown, classification, score status, reasons and concrete NEXT_ACTION. The report must state “이번 콘텐츠 실제 수정: 0페이지”.

- [ ] **Step 4: Extend the existing HTML dashboard without replacing PAGE_SCORE views**

At the Revenue Growth Control Center top, render:

```html
<div class="warning">⚠ PERIOD_MISMATCH · RANK_NOT_AVAILABLE · TOP_30_ONLY</div>
<div class="verified">URL matching verified: 30/30 (100.0%)</div>
```

If the gate fails, replace the verified line with `⚠ OPPORTUNITY RANKING NOT RELIABLE` and render no eligible modification cards. Keep WINNERS — DO NOT REWRITE and active experiments visible. Escape every URL and reason before inserting HTML.

- [ ] **Step 5: Generate real outputs from the checked-in snapshot**

Run: `python3 scripts/revenue_growth.py --as-of 2026-08-31 --naver-snapshot data/naver/search-advisor-2026-08-30.json`

Run: `python3 scripts/quality_audit.py --as-of 2026-08-31 --revenue data/revenue-opportunities.json --dashboard reports/site-quality-dashboard.html`

Expected: quality gate pass, 30 matched Naver rows, 29 camp rows, at most three eligible candidates and zero content changes.

- [ ] **Step 6: Run rendering and integration tests**

Run: `python3 -m pytest tests/test_quality_reports.py tests/test_revenue_growth_integration.py -v`

Expected: PASS.

- [ ] **Step 7: Commit reports and dashboard integration**

```bash
git add scripts/revenue_growth.py scripts/quality_reports.py tests/test_quality_reports.py data/page-performance.json data/revenue-opportunities.json reports/revenue-growth-report.md
git add -f reports/site-quality-dashboard.html
git commit -m "feat: show Naver data quality in revenue dashboard"
```

### Task 5: Automation, Full Verification and Durable History

**Files:**
- Modify: `.github/workflows/seo-qa.yml`
- Modify: `PROJECT_HISTORY.md`
- Modify: `docs/growth/2026-08-31-revenue-opportunity-control-center.md`

**Interfaces:**
- Consumes: the deterministic commands and generated artifacts from Tasks 1–4.
- Produces: CI ordering, regression guarantees and the durable operating record for the next 14–28 day run.

- [ ] **Step 1: Add a failing workflow-order regression test**

In `tests/test_revenue_growth_integration.py`, parse `.github/workflows/seo-qa.yml` as text and assert the Naver validation command appears after quality scoring and before `scripts/revenue_growth.py`; also assert `reports/naver-data-quality.md` is uploaded.

- [ ] **Step 2: Run the workflow regression and confirm it fails**

Run: `python3 -m pytest tests/test_revenue_growth_integration.py -k workflow -v`

Expected: FAIL because the Naver validation step is not present.

- [ ] **Step 3: Insert the Naver quality gate into GitHub Actions**

Use this order:

```yaml
- name: Validate Naver URL performance snapshot
  run: python3 scripts/naver_performance.py --snapshot data/naver/search-advisor-2026-08-30.json --page-scores data/page-scores.json --report reports/naver-data-quality.md

- name: Calculate revenue opportunities from available performance data
  run: python3 scripts/revenue_growth.py --as-of "$(date +%F)" --naver-snapshot data/naver/search-advisor-2026-08-30.json
```

The validation CLI must exit nonzero when the gate fails so CI cannot publish a misleading ranking. Add `reports/naver-data-quality.md` to uploaded artifacts.

- [ ] **Step 4: Run all automated tests**

Run: `python3 -m unittest discover -s tests -q`

Expected: PASS.

Run: `python3 -m pytest -q`

Expected: PASS with no skipped Revenue Opportunity safety tests.

- [ ] **Step 5: Verify deterministic generation and content non-modification**

Run the Naver validator, Revenue generator and dashboard generator twice with `--as-of 2026-08-31`, then run:

```bash
git diff --exit-code -- data/naver/search-advisor-2026-08-30.json data/page-performance.json data/revenue-opportunities.json reports/naver-data-quality.md reports/revenue-growth-report.md reports/site-quality-dashboard.html
git diff --name-only | grep -E '\.(html|md)$'
```

Expected: the first command has no diff after checked-in generation. The second lists only approved reports/docs/history and no `/kor/report/camp/*.html` content page.

- [ ] **Step 6: Record the decision and reusable measurement state**

Append a dated `PROJECT_HISTORY.md` entry and extend the growth document with:

- source: Naver Search Advisor UI TOP 30, updated 2026-08-30
- Naver period 2026-08-01~2026-08-30 and cross-source `PERIOD_MISMATCH`
- URL match/invalid/duplicate/gate figures
- camping coverage and actual median/weighted benchmarks
- TOP 10 and up to three eligible candidates with reasons and hypotheses
- protected WINNER list and cooldown exclusions
- actual content modifications: zero
- average rank: unavailable, ranking points: zero
- next measurement window: after at least 14 days, ideally 28 days, only after a separately approved content experiment

- [ ] **Step 7: Inspect the final change set and commit**

Run: `git status --short`

Run: `git diff --check`

Expected: no whitespace errors; pre-existing unrelated untracked files remain untouched.

```bash
git add .github/workflows/seo-qa.yml PROJECT_HISTORY.md docs/growth/2026-08-31-revenue-opportunity-control-center.md tests/test_revenue_growth_integration.py reports/naver-data-quality.md
git commit -m "chore: automate verified Naver opportunity analysis"
```

- [ ] **Step 8: Produce the Korean completion report**

The final response must include current 28-day revenue/KPIs, data quality status, Naver TOP 10, camping cluster benchmarks, up to three eligible candidates, protected WINNERs, zero modified content pages, test counts, source limitations and the exact 14–28 day validation method. It must explicitly answer which pages may be worth money, how many should be modified next, which pages must not be touched and why.
