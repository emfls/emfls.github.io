# Revenue Opportunity Control Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기존 PAGE_SCORE 시스템을 유지하면서 실제 검색·방문·수익 데이터, 최근 수정 이력과 페이지 유형을 결합해 설명 가능한 Revenue Opportunity 분석·보호·측정 시스템을 구축한다.

**Architecture:** 기존 품질 감사 산출물은 읽기 전용 입력으로 취급하고, `scripts/revenue_opportunity.py`가 데이터 상태·점수·분류·COOLDOWN·선택을 담당한다. `scripts/revenue_growth.py`는 파일 입출력과 KPI 집계만 담당하며, 기존 `quality_reports.py` 대시보드 렌더러는 Revenue Control Center 데이터를 선택적으로 받아 상단에 표시한다.

**Tech Stack:** Python 3.11 표준 라이브러리, unittest/pytest, JSON, Markdown, 정적 HTML, GitHub Actions

**Spec:** `docs/superpowers/specs/2026-08-31-revenue-opportunity-control-center-design.md`

## Global Constraints

- 실제 수정 추천은 최대 3개이며 최신 URL별 검색 데이터가 부족하면 0개다.
- PAGE_SCORE와 REVENUE_OPPORTUNITY_SCORE는 독립적이다.
- 값이 없는 성과 필드는 `null`이며 0으로 대체하지 않는다.
- 허용 데이터 상태는 `VERIFIED`, `ESTIMATED`, `STALE_DATA`, `NOT_CONNECTED`, `INSUFFICIENT_DATA`다.
- AdSense CTR은 점수, 분류, 추천과 실험 KPI에 사용하지 않는다.
- WINNER와 최근 14일 수정 URL은 보호한다.
- DEAD_CANDIDATE는 검토 표식이며 자동 삭제·noindex·canonical 변경을 만들지 않는다.
- 서로 다른 기간의 데이터를 합산하지 않는다.
- URL 변경, 광고 배치 변경과 대량 콘텐츠 변경을 하지 않는다.

---

## File Structure

- Create `scripts/revenue_opportunity.py`: 순수 함수 기반 상태 판정, 채널 정규화, 점수, 분류, COOLDOWN과 후보 선택.
- Create `scripts/revenue_growth.py`: 기존 산출물과 최신 성과 스냅샷을 읽고 URL 통합 레코드·KPI·클러스터·보고서를 생성하는 실행 진입점.
- Create `tests/test_revenue_opportunity.py`: 점수·분류·보호·데이터 무결성 단위 테스트.
- Create `tests/test_revenue_growth_integration.py`: 파일 생성, 결정성, 기간 안전성과 실제 수정 한도 통합 테스트.
- Create `data/performance/2026-08-31.json`: 사용자가 승인한 수동 검증 성과 스냅샷.
- Create `data/experiments.json`: 빈 실험 레지스트리와 스키마.
- Create generated `data/page-performance.json`, `data/revenue-opportunities.json`, `reports/revenue-growth-report.md`.
- Modify `scripts/quality_reports.py`: Revenue Control Center를 선택 인자로 받아 기존 화면 상단에 렌더링.
- Modify `scripts/quality_audit.py`: 기존 산출물을 유지하면서 Revenue 산출물이 있으면 대시보드에 전달.
- Modify `tests/test_quality_reports.py`: 새 상단 영역과 기존 PAGE_SCORE 화면 보존 검증.
- Modify `tests/test_quality_audit_integration.py`: Revenue 데이터 없이도 기존 경로가 정상 동작하는 하위 호환 검증.
- Modify `.github/workflows/seo-qa.yml`: 감사→성과→품질 점수→Revenue 분석→보고서/대시보드→테스트 순서.
- Create `docs/growth/2026-08-31-revenue-opportunity-control-center.md`: 적용 결과와 다음 측정 조건 기록.

---

### Task 1: Data Status and Channel Normalization

**Files:**
- Create: `scripts/revenue_opportunity.py`
- Create: `tests/test_revenue_opportunity.py`

**Interfaces:**
- Produces: `freshness_status(channel: dict, as_of: str, max_age_days: int = 7) -> str`
- Produces: `empty_channel(fields: tuple[str, ...], status: str = "NOT_CONNECTED") -> dict`
- Produces: `normalize_channel(channel: dict | None, fields: tuple[str, ...], as_of: str) -> dict`

- [ ] **Step 1: Write failing data-state tests**

```python
import unittest

from scripts.revenue_opportunity import empty_channel, freshness_status, normalize_channel


class RevenueOpportunityDataTest(unittest.TestCase):
    def test_data_older_than_seven_days_is_stale(self):
        channel = {"period": {"start": "2026-08-01", "end": "2026-08-20"}, "status": "VERIFIED"}
        self.assertEqual(freshness_status(channel, "2026-08-31"), "STALE_DATA")

    def test_missing_channel_uses_null_not_zero(self):
        channel = empty_channel(("impressions", "clicks", "ctr"))
        self.assertEqual(channel["status"], "NOT_CONNECTED")
        self.assertIsNone(channel["impressions"])
        self.assertIsNone(channel["clicks"])
        self.assertIsNone(channel["ctr"])

    def test_normalization_preserves_verified_zero(self):
        channel = normalize_channel(
            {"impressions": 0, "clicks": 0, "ctr": 0.0, "status": "VERIFIED", "period": {"start": "2026-08-25", "end": "2026-08-30"}},
            ("impressions", "clicks", "ctr"),
            "2026-08-31",
        )
        self.assertEqual(channel["impressions"], 0)
        self.assertEqual(channel["status"], "VERIFIED")
```

- [ ] **Step 2: Run tests and verify RED**

Run: `python3 -m pytest tests/test_revenue_opportunity.py -q`

Expected: collection fails with `ModuleNotFoundError: No module named 'scripts.revenue_opportunity'`.

- [ ] **Step 3: Implement minimal state functions**

```python
from datetime import date

ALLOWED_STATUSES = {"VERIFIED", "ESTIMATED", "STALE_DATA", "NOT_CONNECTED", "INSUFFICIENT_DATA"}


def freshness_status(channel, as_of, max_age_days=7):
    if not channel or channel.get("status") == "NOT_CONNECTED":
        return "NOT_CONNECTED"
    end = (channel.get("period") or {}).get("end")
    if not end:
        return "INSUFFICIENT_DATA"
    age = (date.fromisoformat(as_of) - date.fromisoformat(end)).days
    return "STALE_DATA" if age > max_age_days else channel.get("status", "INSUFFICIENT_DATA")


def empty_channel(fields, status="NOT_CONNECTED"):
    return {**{field: None for field in fields}, "status": status, "period": None, "source": None}


def normalize_channel(channel, fields, as_of):
    if channel is None:
        return empty_channel(fields)
    result = {field: channel.get(field) for field in fields}
    result.update({"status": freshness_status(channel, as_of), "period": channel.get("period"), "source": channel.get("source")})
    return result
```

- [ ] **Step 4: Run tests and verify GREEN**

Run: `python3 -m pytest tests/test_revenue_opportunity.py -q`

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/revenue_opportunity.py tests/test_revenue_opportunity.py
git commit -m "feat: add revenue data status model"
```

---

### Task 2: Explainable Score, Classification, Protection and Selection

**Files:**
- Modify: `scripts/revenue_opportunity.py`
- Modify: `tests/test_revenue_opportunity.py`

**Interfaces:**
- Produces: `score_opportunity(record: dict, cluster_medians: dict) -> dict`
- Produces: `classify_record(record: dict, score: dict) -> tuple[str | None, str, list[str]]`
- Produces: `cooldown_state(last_optimization_date: str | None, as_of: str, observe_until: str | None = None) -> dict`
- Produces: `select_improvements(records: list[dict], limit: int = 3) -> list[dict]`

- [ ] **Step 1: Add failing behavioral tests**

```python
from scripts.revenue_opportunity import classify_record, cooldown_state, score_opportunity, select_improvements


def performance_record(**overrides):
    record = {
        "url": "/kor/report/camp/example.html",
        "pageScore": 70,
        "pageType": "TRAFFIC",
        "cluster": "camping",
        "naver": {"impressions": 10000, "clicks": 100, "ctr": 0.01, "position": 18, "status": "VERIFIED"},
        "google": {"impressions": None, "clicks": None, "ctr": None, "position": None, "status": "NOT_CONNECTED"},
        "ga4": {"views": 100, "users": 80, "engagementSeconds": 50, "revenue": 0.2, "status": "VERIFIED"},
        "adsense": {"revenue": None, "rpm": None, "status": "NOT_CONNECTED"},
        "lastOptimizationDate": None,
        "cooldown": False,
    }
    record.update(overrides)
    return record


class RevenueOpportunityBehaviorTest(unittest.TestCase):
    def test_high_impressions_low_ctr_scores_above_low_demand_page(self):
        high = score_opportunity(performance_record(), {"naver_ctr": 0.024})
        low = score_opportunity(performance_record(naver={"impressions": 10, "clicks": 0, "ctr": 0.0, "position": 80, "status": "VERIFIED"}), {"naver_ctr": 0.024})
        self.assertGreater(high["score"], low["score"])
        self.assertEqual(sum(item["max"] for item in high["components"]), 100)

    def test_low_page_score_does_not_unprotect_winner(self):
        record = performance_record(pageScore=30, ga4={"views": 143, "users": 117, "engagementSeconds": 71, "revenue": 0.88, "status": "VERIFIED"})
        classification, action, _ = classify_record(record, score_opportunity(record, {"naver_ctr": 0.024}))
        self.assertEqual(classification, "WINNER")
        self.assertEqual(action, "PROTECT")

    def test_cooldown_is_excluded_from_improvement_selection(self):
        record = performance_record(lastOptimizationDate="2026-08-25")
        record.update(cooldown_state(record["lastOptimizationDate"], "2026-08-31"))
        record.update({"classification": "OPPORTUNITY", "nextAction": "IMPROVE_SEARCH_CTR", "revenueOpportunityScore": 95, "dataStatus": "VERIFIED"})
        self.assertEqual(select_improvements([record]), [])

    def test_selection_is_capped_at_three(self):
        rows = []
        for index in range(8):
            row = performance_record(url=f"/p-{index}.html")
            row.update({"classification": "OPPORTUNITY", "nextAction": "IMPROVE_SEARCH_CTR", "revenueOpportunityScore": 90 - index, "dataStatus": "VERIFIED"})
            rows.append(row)
        self.assertEqual(len(select_improvements(rows)), 3)

    def test_adsense_ctr_cannot_change_score(self):
        first = performance_record(adsense={"revenue": None, "rpm": None, "ctr": 0.01, "status": "NOT_CONNECTED"})
        second = performance_record(adsense={"revenue": None, "rpm": None, "ctr": 0.99, "status": "NOT_CONNECTED"})
        self.assertEqual(score_opportunity(first, {"naver_ctr": 0.024}), score_opportunity(second, {"naver_ctr": 0.024}))

    def test_dead_candidate_only_returns_review_action(self):
        record = performance_record(
            naver={"impressions": 0, "clicks": 0, "ctr": 0.0, "position": None, "status": "VERIFIED"},
            ga4={"views": 0, "users": 0, "engagementSeconds": 0, "revenue": 0, "status": "VERIFIED"},
            duplicate=True,
            inboundLinks=0,
        )
        classification, action, _ = classify_record(record, score_opportunity(record, {"naver_ctr": 0.024}))
        self.assertEqual((classification, action), ("DEAD_CANDIDATE", "DEAD_CANDIDATE_REVIEW"))
        self.assertNotIn(action, {"DELETE", "NOINDEX", "CHANGE_CANONICAL"})
```

- [ ] **Step 2: Run tests and verify RED**

Run: `python3 -m pytest tests/test_revenue_opportunity.py -q`

Expected: import fails for the four new functions.

- [ ] **Step 3: Implement scoring and rules**

Implement exactly eight named components with maxima `[20, 15, 10, 15, 15, 10, 10, 5]`. Use `log1p` normalization for impressions, clicks and revenue; give CTR-gap points only when a verified channel CTR is below its cluster median; give position points only for verified position; derive revenue efficiency only when both verified revenue and positive views exist. Return component dictionaries containing `name`, `score`, `max`, `status`, `reason`, and `inputs`.

Classification order must be: protected revenue WINNER, DEAD_CANDIDATE with all verified zero signals plus duplicate/low-link evidence, OPPORTUNITY with verified current search inputs and no cooldown, EXPERIMENT with current demand but insufficient monetization, otherwise `None` with `WAIT_FOR_DATA`. `select_improvements` must accept only `classification == "OPPORTUNITY"`, `dataStatus == "VERIFIED"`, `cooldown is False`, and allowed concrete actions, then sort by score descending and URL ascending before slicing to `min(limit, 3)`.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `python3 -m pytest tests/test_revenue_opportunity.py -q`

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/revenue_opportunity.py tests/test_revenue_opportunity.py
git commit -m "feat: score and protect revenue opportunities"
```

---

### Task 3: Revenue Growth Pipeline and Deterministic Outputs

**Files:**
- Create: `scripts/revenue_growth.py`
- Create: `tests/test_revenue_growth_integration.py`
- Create: `data/experiments.json`
- Create: `data/performance/2026-08-31.json`

**Interfaces:**
- Consumes: Task 1 and Task 2 functions.
- Produces: `run_revenue_growth(*, page_scores_path, audit_path, performance_path, experiments_path, as_of, page_output, opportunity_output, report_output) -> tuple[dict, dict]`
- Produces CLI arguments `--page-scores`, `--audit`, `--performance`, `--experiments`, `--as-of`, `--page-output`, `--opportunity-output`, `--report`.

- [ ] **Step 1: Write failing integration tests**

Create a temporary fixture with four page-score rows: a low-score verified WINNER, a verified high-impression/low-CTR OPPORTUNITY, a recent COOLDOWN URL, and a missing-data URL. Assert:

```python
pages, summary = run_revenue_growth(...)
self.assertEqual(pages["summary"]["evaluatedIndexablePages"], 4)
self.assertEqual(len(summary["topOpportunities"]), 4)
self.assertEqual([row["url"] for row in summary["selectedImprovements"]], ["/camp/opportunity.html"])
self.assertIsNone(next(row for row in pages["pages"] if row["url"] == "/missing.html")["adsense"]["revenue"])
self.assertEqual(next(row for row in pages["pages"] if row["url"] == "/winner.html")["nextAction"], "PROTECT")
self.assertEqual(next(row for row in pages["pages"] if row["url"] == "/cooldown.html")["cooldown"], True)
self.assertEqual(page_output.read_bytes(), rerun_page_output.read_bytes())
```

Add a separate test where Google and GA4 periods differ and assert the summary does not create a combined search-and-revenue KPI and records `periodCompatibility: "MISMATCH"`.

- [ ] **Step 2: Run tests and verify RED**

Run: `python3 -m pytest tests/test_revenue_growth_integration.py -q`

Expected: collection fails with `ModuleNotFoundError: No module named 'scripts.revenue_growth'`.

- [ ] **Step 3: Implement the pipeline**

Build normalized URL maps from page scores, audit rows, performance `pages`, and experiments. Each output page must include all four channel objects, classification, explainable score, last optimization date, cooldown, next action and reasons. Derive camping cluster from `/kor/report/camp/` or `cluster: camping`.

Summary KPI rules:

- `revenue28d = 13.88`, `dailyAverage28d = round(13.88 / 28, 2)`, and goal phase from the site-level AdSense 28-day snapshot.
- `revenuePerIndexedPage` uses 13.88 divided by the page-score indexable count because both have explicit site scope; mark source and status.
- Revenue-producing ratio, search-active ratio and winner concentration are `value: null` until complete URL coverage exists.
- Views per active user uses GA4 site totals and returns 1.34.
- Camping aggregate only sums URL rows with exactly matching periods and reports missing Naver URL data separately.
- TOP 10 contains up to ten rows sorted by score and does not imply selection.
- Selected improvements comes only from `select_improvements`.

Render the Markdown headings and fields required by the design. When no page can safely be selected, print `이번 실행 실제 콘텐츠 수정: 0페이지` and the data reason.

- [ ] **Step 4: Add approved structured snapshot and experiment schema**

Write `data/performance/2026-08-31.json` with `schema_version`, `as_of`, site-level AdSense/GA4/Naver/Google objects, exact periods, source labels and the nine URL-level GA4 rows in the approved baseline. Do not include AdSense CTR. Mark approximate Naver totals `ESTIMATED`. Set URL-level Naver and AdSense records absent rather than synthesizing rows.

Write `data/experiments.json` as:

```json
{
  "schema_version": 1,
  "as_of": "2026-08-31",
  "experiments": []
}
```

- [ ] **Step 5: Run tests and verify GREEN**

Run: `python3 -m pytest tests/test_revenue_opportunity.py tests/test_revenue_growth_integration.py -q`

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add scripts/revenue_growth.py tests/test_revenue_growth_integration.py data/performance/2026-08-31.json data/experiments.json
git commit -m "feat: generate revenue growth control data"
```

---

### Task 4: Revenue Control Center Dashboard

**Files:**
- Modify: `scripts/quality_reports.py`
- Modify: `scripts/quality_audit.py`
- Modify: `tests/test_quality_reports.py`
- Modify: `tests/test_quality_audit_integration.py`

**Interfaces:**
- Modify: `render_dashboard(site: dict, pages: list[dict], revenue: dict | None = None) -> str`
- Modify: `run_quality_audit(..., revenue_path: Path | None = None)` without breaking existing callers.

- [ ] **Step 1: Write failing dashboard tests**

Add a `revenue_fixture()` with Revenue, Traffic, Efficiency, classification counts, top opportunities, protected winners, active experiments, camping cluster and freshness warnings. Assert the rendered HTML contains:

```python
self.assertIn("REVENUE GROWTH CONTROL CENTER", html)
self.assertIn("TODAY'S TOP OPPORTUNITIES", html)
self.assertIn("WINNERS - DO NOT REWRITE", html)
self.assertIn("ACTIVE EXPERIMENTS", html)
self.assertIn("Camping Cluster", html)
self.assertIn("PAGE SCORE", html)
self.assertNotIn("adsenseCtr", html)
self.assertNotIn("ad_click", html)
```

Add an integration assertion that `run_quality_audit` still renders the original dashboard when `revenue_path` is absent.

- [ ] **Step 2: Run tests and verify RED**

Run: `python3 -m pytest tests/test_quality_reports.py tests/test_quality_audit_integration.py -q`

Expected: `render_dashboard()` rejects the `revenue` argument or the new headings are absent.

- [ ] **Step 3: Extend the renderer and audit entry point**

Render the revenue section before the existing site-quality cards. Use server-rendered text for totals and TOP 10 so the report remains useful without JavaScript. Show `N/A` plus status for null KPIs. Keep the existing filterable PAGE_SCORE table and private `noindex,nofollow` metadata unchanged.

Load `data/revenue-opportunities.json` only when the optional path exists. Missing revenue output must not fail the quality audit.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `python3 -m pytest tests/test_quality_reports.py tests/test_quality_audit_integration.py -q`

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/quality_reports.py scripts/quality_audit.py tests/test_quality_reports.py tests/test_quality_audit_integration.py
git commit -m "feat: add revenue control center dashboard"
```

---

### Task 5: Automation Order and Regression Contract

**Files:**
- Modify: `.github/workflows/seo-qa.yml`
- Modify: `tests/test_seo_qa_workflow.py`

**Interfaces:**
- Consumes: `scripts/revenue_growth.py` CLI from Task 3.

- [ ] **Step 1: Write a failing workflow-order test**

```python
def test_workflow_generates_revenue_opportunities_before_dashboard_and_tests(self):
    source = WORKFLOW.read_text(encoding="utf-8")
    audit = source.index("scripts/seo_audit.py")
    quality = source.index("scripts/quality_audit.py")
    revenue = source.index("scripts/revenue_growth.py")
    dashboard = source.rindex("scripts/quality_audit.py")
    tests = source.index("python3 -m unittest discover")
    self.assertLess(audit, quality)
    self.assertLess(quality, revenue)
    self.assertLess(revenue, dashboard)
    self.assertLess(dashboard, tests)
    self.assertIn("data/revenue-opportunities.json", source)
    self.assertIn("reports/revenue-growth-report.md", source)
```

- [ ] **Step 2: Run test and verify RED**

Run: `python3 -m pytest tests/test_seo_qa_workflow.py -q`

Expected: fails because `scripts/revenue_growth.py` is absent from the workflow.

- [ ] **Step 3: Update workflow**

After deterministic site audit, run PAGE_SCORE once to ensure current inputs, then run Revenue Opportunity, then rerun only the dashboard render with `--revenue data/revenue-opportunities.json` if the CLI supports it. Preserve read-only permissions and do not fetch external data. Upload the revenue JSON and Markdown report with existing QA artifacts.

- [ ] **Step 4: Run test and verify GREEN**

Run: `python3 -m pytest tests/test_seo_qa_workflow.py -q`

Expected: all workflow tests pass.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/seo-qa.yml tests/test_seo_qa_workflow.py
git commit -m "ci: generate revenue opportunity reports"
```

---

### Task 6: Generate Real Outputs, Record the Decision and Verify

**Files:**
- Generate: `data/page-performance.json`
- Generate: `data/revenue-opportunities.json`
- Generate: `reports/revenue-growth-report.md`
- Generate: `reports/site-quality-dashboard.html`
- Create: `docs/growth/2026-08-31-revenue-opportunity-control-center.md`

**Interfaces:**
- Consumes all previous tasks.

- [ ] **Step 1: Generate current outputs**

Run:

```bash
python3 scripts/revenue_growth.py --as-of 2026-08-31
python3 scripts/quality_audit.py --as-of 2026-08-31 --revenue data/revenue-opportunities.json --dashboard reports/site-quality-dashboard.html
```

Expected: 19,063 URL records, Revenue Opportunity TOP 10, protected winners, camping-cluster section and zero selected content changes when current URL-level search evidence is insufficient.

- [ ] **Step 2: Inspect invariants**

Run:

```bash
jq '{summary, selected: .selectedImprovements, top: (.topOpportunities | length)}' data/revenue-opportunities.json
jq '[.pages[] | select(.adsense.status == "NOT_CONNECTED" and .adsense.revenue != null)] | length' data/page-performance.json
jq '[.pages[] | select(.cooldown == true)] | length' data/page-performance.json
```

Expected: selected length `0` unless a record has current verified URL-level search data; fabricated AdSense revenue count `0`; COOLDOWN count greater than `0` from recent growth logs.

- [ ] **Step 3: Write the growth history record**

Record exact generated KPI values, TOP 10, protected WINNER URLs, selected improvement count, data freshness warnings, files changed, test commands and the next required data import. State explicitly that no content page was edited when selection is zero and that this is the intended safety result.

- [ ] **Step 4: Run focused and full regression tests**

Run:

```bash
python3 -m pytest tests/test_revenue_opportunity.py tests/test_revenue_growth_integration.py tests/test_quality_reports.py tests/test_quality_audit_integration.py tests/test_seo_qa_workflow.py -q
python3 -m unittest discover -s tests -q
python3 -m pytest -q
```

Expected: all commands exit 0 with no new warnings caused by Revenue Opportunity code.

- [ ] **Step 5: Verify generated files and diff**

Run:

```bash
git diff --check
git status --short
git diff --stat
```

Confirm no content HTML, URL, canonical or ad-placement file changed. Confirm unrelated pre-existing untracked files remain untouched.

- [ ] **Step 6: Commit final outputs and history**

```bash
git add data/page-performance.json data/revenue-opportunities.json reports/revenue-growth-report.md reports/site-quality-dashboard.html docs/growth/2026-08-31-revenue-opportunity-control-center.md
git commit -m "docs: record revenue opportunity baseline"
```

---

## Completion Evidence

The final response must quote values from generated JSON rather than memory and include:

- 28-day revenue and daily average
- indexed pages and revenue per indexed page
- views per active user
- classification counts
- TOP 10 URL, score, classification, reason, next action, cooldown and data status
- actual edited pages, including zero when evidence blocks editing
- protected winners and reasons
- camping cluster totals and missing-data warnings
- exact test results
- next measurement/import requirement for a 14~28 day experiment
