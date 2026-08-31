# Site Quality Scoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evaluate every indexable page, calculate a defensible SITE_SCORE, rank improvement work by measured opportunity, and generate a private local quality dashboard for the AdSense $100/day project.

**Architecture:** Extend the existing deterministic site audit instead of reparsing the repository in multiple tools. Keep scoring, site aggregation, and report rendering in focused Python standard-library modules; a small CLI composes existing audit, metadata, health, and performance JSON into committed machine data and Markdown while generating an ignored local HTML dashboard.

**Tech Stack:** Python 3.11 standard library, static HTML/CSS/JavaScript, JSON, unittest/pytest, GitHub Actions, existing GitHub Pages SEO audit pipeline.

**Spec:** `docs/superpowers/specs/2026-08-31-site-quality-scoring-design.md`

## Global Constraints

- Preserve existing URLs, HTML content, AdSense, GA4, canonical values, tools, and sitemap behavior.
- Never auto-delete, merge, redirect, or noindex pages from a score.
- Never fabricate Search Console, GA4, AdSense, revenue, RPM, mobile, competitor, or originality evidence.
- Store every judgment with `VERIFIED`, `ESTIMATED`, `NOT_CONNECTED`, or `MANUAL_REVIEW_REQUIRED`.
- Keep `reports/site-quality-dashboard.html` local and Git-ignored.
- Do not add external runtime dependencies.
- Do not optimize AdSense CTR or track ad clicks.
- Keep scoring deterministic for identical inputs and `as_of` date.
- Use existing `data/performance/*.json`; URL-level AdSense revenue remains `NOT_CONNECTED`.
- Existing defects are recommendations, not automatic CI failures; CI fails only when evaluation breaks or lies about evidence.

## File Structure

- Create `scripts/quality_scoring.py`: page typing, eight category scorers, cap rules, grades, statuses, and recommendations.
- Create `scripts/quality_site.py`: performance lookup, improvement priority, site aggregation, data-connection states, and $100/day math.
- Create `scripts/quality_reports.py`: `SITE_SCORE.md` and local dashboard rendering.
- Create `scripts/quality_audit.py`: CLI orchestration and deterministic JSON serialization.
- Create `tests/test_quality_scoring.py`: fixture-level page classification, scoring, caps, and type-specific behavior.
- Create `tests/test_quality_site.py`: measured/estimated priority, site score, and revenue math.
- Create `tests/test_quality_reports.py`: Markdown/dashboard safety and content tests.
- Create `tests/test_quality_audit_integration.py`: CLI output, determinism, and full audit coverage.
- Modify `.gitignore`: ignore only the local HTML dashboard.
- Modify `.github/workflows/seo-qa.yml`: run the quality audit after the existing deterministic SEO audit.
- Generate `data/page-scores.json`, `data/site-score.json`, and `SITE_SCORE.md`.
- Modify `docs/growth/2026-08-31-site-quality-scoring.md`: implementation, results, limitations, and next action.

---

### Task 1: Evidence Model and Page Classification

**Files:**
- Create: `scripts/quality_scoring.py`
- Test: `tests/test_quality_scoring.py`

**Interfaces:**
- Consumes: one page dictionary from `data/site-audit.json` and optional metadata dictionary.
- Produces: `classify_page(page: dict, metadata: dict) -> str`, `evidence(value, status, reasons) -> dict`, `grade_for(score: int) -> str`, and `status_for(score: int) -> str`.

- [ ] **Step 1: Write failing classification and boundary tests**

```python
from scripts.quality_scoring import classify_page, grade_for, status_for

def test_classifies_page_types_without_treating_privacy_as_traffic():
    assert classify_page({"path": "privacy.html", "category": "root", "structured_data_types": []}, {}) == "TRUST"
    assert classify_page({"path": "util/roi-calculator/index.html", "category": "util", "structured_data_types": ["WebApplication"]}, {}) == "TOOL"
    assert classify_page({"path": "kor/report/camp/namyangju.html", "category": "report", "structured_data_types": ["Article"]}, {}) == "TRAFFIC"
    assert classify_page({"path": "stockwiki/abc.html", "category": "stockwiki", "structured_data_types": []}, {}) == "MONEY"

def test_grade_and_status_boundaries_are_exact():
    assert [(grade_for(x), status_for(x)) for x in (49, 50, 59, 60, 69, 70, 79, 80, 89, 90)] == [
        ("F", "FAIL"), ("D", "FAIL"), ("D", "FAIL"), ("C", "NEEDS_WORK"),
        ("C", "NEEDS_WORK"), ("B", "PUBLISHABLE"), ("B", "PUBLISHABLE"),
        ("A", "GOOD"), ("A", "GOOD"), ("S", "CORE"),
    ]
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `python3 -m pytest tests/test_quality_scoring.py -q`

Expected: collection fails because `scripts.quality_scoring` does not exist.

- [ ] **Step 3: Implement deterministic evidence helpers and classifier**

```python
EVIDENCE_STATUSES = {"VERIFIED", "ESTIMATED", "NOT_CONNECTED", "MANUAL_REVIEW_REQUIRED"}

def evidence(value, status, reasons=()):
    if status not in EVIDENCE_STATUSES:
        raise ValueError(f"invalid evidence status: {status}")
    return {"value": value, "status": status, "reasons": list(reasons)}

def classify_page(page, metadata):
    if metadata.get("page_type"):
        return metadata["page_type"]
    path = page["path"].lower()
    if any(name in path for name in ("privacy", "terms", "disclaimer", "about", "contact", "methodology")):
        return "TRUST"
    if page.get("category") == "util" and ("WebApplication" in page.get("structured_data_types", []) or "calculator" in path):
        return "TOOL"
    if page.get("category") in {"stockwiki", "finance"} or any(word in path for word in ("stock", "etf", "tax", "loan", "insurance")):
        return "MONEY"
    if path.endswith("index.html") and page.get("internal_links", 0) >= 12:
        return "HUB"
    if page.get("category") in {"game", "root"}:
        return "UTILITY"
    return "TRAFFIC"
```

Implement exact grade and status boundaries from the spec. Reject an invalid explicit `page_type` instead of silently accepting it.

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run: `python3 -m pytest tests/test_quality_scoring.py -q`

Expected: all tests pass.

- [ ] **Step 5: Commit the evidence model**

```bash
git add scripts/quality_scoring.py tests/test_quality_scoring.py
git commit -m "feat: add quality evidence model"
```

---

### Task 2: Eight Page Score Categories and Cap Rules

**Files:**
- Modify: `scripts/quality_scoring.py`
- Modify: `tests/test_quality_scoring.py`

**Interfaces:**
- Consumes: `score_page(page: dict, metadata: dict, context: dict) -> dict` where context contains duplicate groups, sitemap URL set, broken-link sources, and inbound-link counts.
- Produces: a page score with exactly eight category keys, `raw_score`, capped `score`, `grade`, `status`, `caps`, `cap_candidates`, `issues`, `strengths`, and `recommendations`.

- [ ] **Step 1: Add failing tests for a strong tool, weak finance page, TRUST exception, and cap distinction**

```python
def test_finance_without_sources_gets_verified_55_cap():
    result = score_page(finance_page(), {}, context())
    assert result["raw_score"] >= result["score"]
    assert result["score"] <= 55
    assert {cap["code"] for cap in result["caps"]} == {"finance_without_sources"}
    assert result["caps"][0]["status"] == "VERIFIED"

def test_manual_ai_duplicate_suspicion_is_not_silently_applied():
    result = score_page(templated_page(), {}, context(duplicate_body_candidate=True))
    assert result["caps"] == []
    assert result["cap_candidates"][0]["status"] == "MANUAL_REVIEW_REQUIRED"

def test_trust_page_does_not_require_three_related_articles():
    result = score_page(trust_page(), {}, context())
    assert "fewer_than_three_related_pages" not in result["issues"]
```

- [ ] **Step 2: Run tests and verify failures describe missing scoring behavior**

Run: `python3 -m pytest tests/test_quality_scoring.py -q`

Expected: failures for missing `score_page` and cap output.

- [ ] **Step 3: Implement category scorers with literal maximums**

Define and use:

```python
CATEGORY_MAX = {
    "searchIntent": 20, "contentValue": 20, "seo": 10, "trust": 15,
    "ux": 10, "internalLinks": 10, "monetization": 5, "technical": 10,
}
```

Each scorer returns `{"score": int, "max": int, "checks": list[dict]}`. Use observable signals only:

- search intent: title/H1 token overlap, answer text in first 25% of visible words, useful H2 breadth, non-clickbait title; competitor value remains manual.
- content value: table/form/calculator/schema/data signals, numeric examples, section breadth, duplicate candidates; word count only caps depth subpoints.
- SEO: unique title/description group membership, one H1, H2, meaningful slug, alt coverage from the extended audit, non-clickbait title.
- trust: external sources, dates, author/organization signal, method/limitations terms, official-source metadata, About/Methodology link.
- UX: viewport, typography/overflow/static signals from the extended audit; actual device usability remains estimated.
- internal links: contextual links, related section, hub link, inbound links, breadcrumb; TRUST-specific rules.
- monetization: substantive content, separation signal, no interactive-ad adjacency warning, commercial topic estimate, content-first ratio.
- technical: indexable, sitemap, canonical, HTTPS origin, robots, no known broken links, structured data, visible text, no duplicate canonical.

Every failed check supplies one concrete issue and recommendation, such as `Add a unique meta description summarizing inputs, result, and limitation in 120–160 characters.`

- [ ] **Step 4: Implement verified caps and manual cap candidates**

Apply only mechanically defensible caps:

```python
VERIFIED_CAPS = {
    "finance_without_sources": 55,
    "severe_duplicate_document": 50,
    "search_intent_mismatch": 50,
    "unclear_page_purpose": 60,
}
```

Place AI-copy, stale factual error, mobile unusability, and ad-dominant suspicion in `cap_candidates` until manually verified. Sort cap records by `(max_score, code)` and apply the lowest verified maximum.

- [ ] **Step 5: Verify category totals, caps, and type exceptions**

Run: `python3 -m pytest tests/test_quality_scoring.py -q`

Expected: all tests pass and every fixture category sum equals `raw_score`.

- [ ] **Step 6: Commit page scoring**

```bash
git add scripts/quality_scoring.py tests/test_quality_scoring.py
git commit -m "feat: score page quality with evidence caps"
```

---

### Task 3: Extend the Existing Audit with Required Static Signals

**Files:**
- Modify: `scripts/seo_audit.py`
- Modify: `tests/test_seo_audit.py`

**Interfaces:**
- Consumes: raw HTML and relative path through existing `parse_html`.
- Produces additional page fields: `h3_count`, `image_alt_missing`, `has_viewport`, `has_table`, `has_form`, `has_breadcrumb`, `has_related_section`, `has_author_signal`, `has_method_signal`, `has_limitation_signal`, `interactive_controls`, and `visible_text_prefix`.

- [ ] **Step 1: Add a failing parser fixture test**

```python
def test_parse_html_exposes_quality_signals():
    page = parse_html(SAMPLE_WITH_TOOL_AND_TRUST_SIGNALS, Path("util/example/index.html"))
    assert page["h3_count"] == 1
    assert page["image_alt_missing"] == 1
    assert page["has_viewport"] is True
    assert page["has_form"] is True
    assert page["has_breadcrumb"] is True
    assert page["interactive_controls"] == 2
    assert page["visible_text_prefix"].startswith("Immediate answer")
```

- [ ] **Step 2: Run the parser test and verify RED**

Run: `python3 -m pytest tests/test_seo_audit.py -q`

Expected: missing-key failures.

- [ ] **Step 3: Extend `PageParser` without changing existing fields**

Track the listed tags and signals in `handle_starttag`, `handle_data`, and `parse_html`. Limit `visible_text_prefix` to the first 400 normalized visible words so `site-audit.json` remains bounded. Do not parse or retain form values, user data, scripts, or ad interaction data.

- [ ] **Step 4: Run parser and existing SEO tests**

Run: `python3 -m pytest tests/test_seo_audit.py tests/test_seo_qa.py -q`

Expected: all tests pass; old output keys remain unchanged.

- [ ] **Step 5: Commit audit signals**

```bash
git add scripts/seo_audit.py tests/test_seo_audit.py
git commit -m "feat: collect quality scoring audit signals"
```

---

### Task 4: Performance Join and Improvement Priority

**Files:**
- Create: `scripts/quality_site.py`
- Test: `tests/test_quality_site.py`

**Interfaces:**
- Produces `normalize_url(url: str) -> str`, `latest_performance_file(directory: Path) -> Path | None`, `performance_by_url(data: dict) -> dict`, and `rank_priority(page_result: dict, metrics: dict | None) -> dict`.

- [ ] **Step 1: Write failing tests for measured and estimated priority**

```python
def test_measured_page_outranks_zero_data_page_when_opportunity_is_large():
    measured = rank_priority({"score": 72, "type": "TRAFFIC", "issues": ["missing_sources"]}, {
        "impressions": 20000, "organic_clicks": 100, "search_ctr": .005,
        "average_position": 8, "sessions": 900, "opportunity_score": 500,
    })
    estimated = rank_priority({"score": 45, "type": "TRAFFIC", "issues": ["thin_content"]}, None)
    assert measured["basis"] == "MEASURED"
    assert measured["score"] > estimated["score"]
    assert estimated["basis"] == "ESTIMATED"

def test_missing_url_revenue_is_not_replaced_with_site_revenue():
    result = rank_priority({"score": 70, "type": "MONEY", "issues": []}, {"impressions": 10})
    assert result["metrics"]["revenue"]["status"] == "NOT_CONNECTED"
    assert result["metrics"]["rpm"]["status"] == "NOT_CONNECTED"
```

- [ ] **Step 2: Run and verify RED**

Run: `python3 -m pytest tests/test_quality_site.py -q`

Expected: module import failure.

- [ ] **Step 3: Implement deterministic ranking**

Normalize components to 0–100 and calculate:

```python
priority = (
    quality_gap * 0.30
    + search_opportunity * 0.35
    + traffic_signal * 0.15
    + type_value * 0.10
    + ease_of_fix * 0.10
)
```

Use `search_opportunity=0` and `traffic_signal=0` when missing, label the result `ESTIMATED`, and retain component values in output. Never infer URL revenue from site-level AdSense.

- [ ] **Step 4: Run priority tests and verify GREEN**

Run: `python3 -m pytest tests/test_quality_site.py -q`

Expected: all tests pass.

- [ ] **Step 5: Commit priority logic**

```bash
git add scripts/quality_site.py tests/test_quality_site.py
git commit -m "feat: rank quality work by measured opportunity"
```

---

### Task 5: SITE_SCORE and AdSense $100/Day Math

**Files:**
- Modify: `scripts/quality_site.py`
- Modify: `tests/test_quality_site.py`

**Interfaces:**
- Produces `calculate_site_score(page_results: list[dict], system_context: dict) -> dict` and `calculate_revenue_goal(adsense: dict | None) -> dict`.

- [ ] **Step 1: Add failing exact-math and connection-state tests**

```python
def test_revenue_goal_uses_period_daily_average_and_actual_rpm():
    result = calculate_revenue_goal({
        "period": {"start": "2026-08-01", "end": "2026-08-10"},
        "estimated_earnings_usd": 10.0, "page_views": 2000, "page_rpm": 5.0,
    })
    assert result["daily_revenue_usd"] == 1.0
    assert result["required_growth"] == 100.0
    assert result["required_page_views"] == 20000
    assert result["label"] == "period_daily_average"

def test_missing_adsense_data_is_explicit():
    assert calculate_revenue_goal(None)["status"] == "DATA NOT AVAILABLE"
```

- [ ] **Step 2: Run tests and verify RED**

Run: `python3 -m pytest tests/test_quality_site.py -q`

Expected: missing-function failures.

- [ ] **Step 3: Implement site categories and KPI aggregation**

Return the six requested SITE_SCORE categories with exact maximums 25/20/15/15/10/15. Aggregate:

- total indexable and evaluated pages
- S/A/B/C/D/F counts
- mean and median page score
- percent score >=80 and percent score <60
- target gaps for SITE_SCORE 90, >=80 ratio 80%, and <60 ratio 3%
- trust page existence and quality
- CSV connection freshness based on period end and `as_of`

Custom-domain absence is an explicit operating decision and receives a neutral note; HTTPS and canonical-origin consistency carry technical points.

- [ ] **Step 4: Implement revenue math with inclusive date count**

Use `(end - start).days + 1`. Reject negative PV, revenue, or RPM. If supplied RPM conflicts materially with `revenue * 1000 / PV`, retain source RPM but add a data-quality warning.

- [ ] **Step 5: Run site and revenue tests**

Run: `python3 -m pytest tests/test_quality_site.py -q`

Expected: all tests pass.

- [ ] **Step 6: Commit site scoring**

```bash
git add scripts/quality_site.py tests/test_quality_site.py
git commit -m "feat: calculate site quality and revenue goal"
```

---

### Task 6: CLI Orchestration and Deterministic Machine Outputs

**Files:**
- Create: `scripts/quality_audit.py`
- Create: `tests/test_quality_audit_integration.py`

**Interfaces:**
- Initial CLI flags: `--audit`, `--metadata`, `--performance-dir`, `--cannibalization`, `--root`, `--as-of`, `--page-output`, and `--site-output`. Task 7 adds `--report` and `--dashboard` after the renderer exists.
- Default committed outputs: `data/page-scores.json`, `data/site-score.json`, `SITE_SCORE.md`.
- Default local output: `reports/site-quality-dashboard.html`.

- [ ] **Step 1: Write failing CLI integration test with three fixture pages**

```python
def test_quality_audit_writes_every_indexable_page_once_and_is_deterministic(tmp_path):
    first = run_quality_cli(tmp_path, as_of="2026-08-31")
    first_bytes = first.page_json.read_bytes()
    second = run_quality_cli(tmp_path, as_of="2026-08-31")
    assert second.page_json.read_bytes() == first_bytes
    payload = json.loads(first_bytes)
    assert [row["url"] for row in payload["pages"]] == sorted({"/a.html", "/tool/"})
    assert payload["summary"]["evaluated_indexable_pages"] == 2
```

- [ ] **Step 2: Run integration test and verify RED**

Run: `python3 -m pytest tests/test_quality_audit_integration.py -q`

Expected: CLI module missing.

- [ ] **Step 3: Implement orchestration without reparsing HTML**

Load the existing audit JSON, index metadata by normalized URL, load health context, select latest performance file, score only `indexable=true` pages, sort pages by URL before JSON serialization, and calculate priority and site score. Write the two JSON outputs only in this task. Include `schema_version: 1`, `rules_version: "2026-08-31"`, and caller-provided `as_of` in both JSON files.

- [ ] **Step 4: Add validation that prevents silent omissions and fabricated metrics**

Raise a clear exception when:

- evaluated URL count differs from unique indexable audit URL count
- duplicate URLs exist in output
- a category score exceeds its maximum
- category sum differs from `raw_score`
- applied cap lacks code, status, evidence, or maximum
- revenue/RPM is numeric while its evidence is `NOT_CONNECTED`

- [ ] **Step 5: Run integration and focused suites**

Run: `python3 -m pytest tests/test_quality_audit_integration.py tests/test_quality_scoring.py tests/test_quality_site.py -q`

Expected: all tests pass.

- [ ] **Step 6: Commit orchestration**

```bash
git add scripts/quality_audit.py tests/test_quality_audit_integration.py
git commit -m "feat: orchestrate deterministic quality audit"
```

---

### Task 7: Markdown and Private Local Dashboard

**Files:**
- Create: `scripts/quality_reports.py`
- Create: `tests/test_quality_reports.py`
- Modify: `scripts/quality_audit.py`
- Modify: `tests/test_quality_audit_integration.py`
- Modify: `.gitignore`

**Interfaces:**
- Produces `render_site_markdown(site: dict, pages: list[dict], previous: dict | None) -> str` and `render_dashboard(site: dict, pages: list[dict]) -> str`.

- [ ] **Step 1: Write failing report safety and completeness tests**

```python
def test_markdown_contains_required_decision_sections():
    text = render_site_markdown(site_fixture(), page_results(), None)
    for heading in ("현재 SITE SCORE", "가장 큰 사이트 문제", "가장 먼저 개선할 페이지", "데이터 제한", "다음 작업"):
        assert heading in text

def test_dashboard_has_filters_but_no_account_secrets_or_ad_click_tracking():
    html = render_dashboard(site_fixture(), page_results())
    assert 'id="grade-filter"' in html
    assert 'id="type-filter"' in html
    assert "ca-pub-" not in html
    assert "adsbygoogle" not in html
    assert "ad_click" not in html
```

- [ ] **Step 2: Run report tests and verify RED**

Run: `python3 -m pytest tests/test_quality_reports.py -q`

Expected: module import failure.

- [ ] **Step 3: Implement concise Markdown report**

Include SITE_SCORE, category breakdown, grade counts, target gaps, previous-run delta when compatible prior data exists, ten site issues, ten priority pages, connection states, and limitations. Use exact page recommendations, not generic “improve quality” text.

- [ ] **Step 4: Implement self-contained dashboard with safe embedded aggregate data**

Render local HTML with accessible tables and client-side filters for grade, type, status, priority basis, and text URL search. Embed only already-public URL metrics and quality results; do not embed source CSV rows, account IDs, credentials, or query-level data. Paginate 100 rows per view.

- [ ] **Step 5: Ignore the local dashboard only**

Append exactly:

```gitignore
/reports/site-quality-dashboard.html
```

Do not ignore committed `data/page-scores.json`, `data/site-score.json`, or `SITE_SCORE.md`.

- [ ] **Step 6: Connect renderers to the CLI**

Add `--report` with default `SITE_SCORE.md` and `--dashboard` with default `reports/site-quality-dashboard.html`. Load the compatible previous site-score JSON before overwriting it, pass it to `render_site_markdown`, and write both returned strings with UTF-8 encoding.

- [ ] **Step 7: Run report and CLI tests and verify GREEN**

Run: `python3 -m pytest tests/test_quality_reports.py tests/test_quality_audit_integration.py -q`

Expected: all tests pass.

- [ ] **Step 8: Commit reports and dashboard**

```bash
git add scripts/quality_reports.py scripts/quality_audit.py tests/test_quality_reports.py tests/test_quality_audit_integration.py .gitignore
git commit -m "feat: render private site quality dashboard"
```

---

### Task 8: Full-Site Execution and Result Validation

**Files:**
- Generate: `data/page-scores.json`
- Generate: `data/site-score.json`
- Generate: `SITE_SCORE.md`
- Local only: `reports/site-quality-dashboard.html`
- Modify: `docs/growth/2026-08-31-site-quality-scoring.md`

**Interfaces:**
- Consumes the current regenerated `data/site-audit.json` and latest performance data.
- Produces the first real baseline and actionable top-ten list.

- [ ] **Step 1: Regenerate the deterministic site audit**

Run:

```bash
python3 scripts/seo_audit.py . --json data/site-audit.json --markdown reports/seo-audit.md
```

Expected: parser errors remain zero and the summary reflects the current repository.

- [ ] **Step 2: Run the quality audit against all indexable pages**

Run:

```bash
python3 scripts/quality_audit.py --as-of 2026-08-31
```

Expected: evaluated indexable pages equals the unique indexable URL count; outputs are created and the dashboard remains ignored.

- [ ] **Step 3: Validate output distributions and suspicious uniformity**

Run a read-only Python check that asserts:

```python
assert len({row["score"] for row in pages}) >= 20
assert sum(grades.values()) == len(pages)
assert all(sum(x["score"] for x in row["scores"].values()) == row["raw_score"] for row in pages)
assert not any(row["metrics"]["revenue"].get("value") for row in pages)
```

If fewer than 20 distinct scores appear, stop and inspect the scorer instead of weakening this assertion.

- [ ] **Step 4: Inspect the top ten and bottom ten manually**

For each, compare the page HTML, score reasons, type, cap, and performance evidence. Correct only scoring-rule defects in this task; do not begin mass page edits.

- [ ] **Step 5: Record the first baseline and limitations**

Create `docs/growth/2026-08-31-site-quality-scoring.md` with date, purpose, changed files, SITE_SCORE, grade distribution, five major issues, top ten priority pages, evidence limitations, verification, and the next recommended page experiment.

- [ ] **Step 6: Run all tests and existing SEO QA locally**

Run:

```bash
python3 -m unittest discover -s tests -q
python3 -m pytest -q
qa_dir=$(mktemp -d /tmp/emfls-quality-qa.XXXXXX)
python3 scripts/seo_audit.py . --json "$qa_dir/site-audit.json" --markdown "$qa_dir/seo-audit.md"
python3 scripts/seo_qa.py . --audit "$qa_dir/site-audit.json" --baseline data/seo-qa-baseline.json --report "$qa_dir/seo-qa.md"
git diff --check
```

Expected: all test commands exit zero; SEO QA reports no new critical issues or warnings.

- [ ] **Step 7: Commit the first baseline**

```bash
git add data/site-audit.json reports/seo-audit.md data/page-scores.json data/site-score.json SITE_SCORE.md docs/growth/2026-08-31-site-quality-scoring.md
git commit -m "feat: establish site quality baseline"
```

---

### Task 9: Integrate with the Existing SEO QA Workflow

**Files:**
- Modify: `.github/workflows/seo-qa.yml`
- Modify: `tests/test_seo_workflow.py`

**Interfaces:**
- Existing workflow remains `SEO QA`; no second workflow is created.

- [ ] **Step 1: Add a failing workflow contract test**

```python
def test_seo_workflow_runs_quality_audit_once():
    workflow = Path(".github/workflows/seo-qa.yml").read_text(encoding="utf-8")
    assert workflow.count("python3 scripts/quality_audit.py") == 1
    assert "--dashboard /tmp/site-quality-dashboard.html" in workflow
    assert "reports/site-quality-dashboard.html" not in workflow
```

- [ ] **Step 2: Run and verify RED**

Run: `python3 -m pytest tests/test_seo_workflow.py -q`

Expected: the quality command assertion fails.

- [ ] **Step 3: Add one quality step after deterministic site audit**

Use:

```yaml
      - name: Generate site quality baseline
        run: >-
          python3 scripts/quality_audit.py
          --as-of "$(date +%F)"
          --dashboard /tmp/site-quality-dashboard.html
```

The action validates generation against committed inputs but does not upload the private dashboard. Keep existing SEO QA, unittest, pytest, and report artifact steps unchanged.

- [ ] **Step 4: Run workflow contract and complete local suites**

Run:

```bash
python3 -m pytest tests/test_seo_workflow.py -q
python3 -m unittest discover -s tests -q
python3 -m pytest -q
```

Expected: all commands pass.

- [ ] **Step 5: Commit workflow integration**

```bash
git add .github/workflows/seo-qa.yml tests/test_seo_workflow.py
git commit -m "ci: run site quality audit in SEO QA"
```

---

### Task 10: Push, Verify CI, and Handoff the Operating Loop

**Files:**
- Verify only: committed implementation and outputs.

**Interfaces:**
- Produces a passing main-branch SEO QA run and a concise user handoff.

- [ ] **Step 1: Confirm only intended files are committed**

Run:

```bash
git status --short
git log --oneline -10
```

Expected: the user-owned untracked `docs/analysis/` and prior plan remain untouched; no local dashboard is staged.

- [ ] **Step 2: Push main and wait for the triggered SEO QA run**

Run:

```bash
git push
run_id=$(gh run list --workflow "SEO QA" --limit 1 --json databaseId --jq '.[0].databaseId')
gh run watch "$run_id" --exit-status
```

Expected: workflow completes successfully. Treat the existing Node runtime deprecation annotation as an upstream action warning unless it becomes a failure.

- [ ] **Step 3: Report the required completion values**

Read only generated JSON and report:

- SITE_SCORE and site grade
- total evaluated pages
- S/A/B/C/D/F counts
- percentage >=80 and percentage <60
- five largest site problems
- top ten priority pages
- generated/modified files
- local and CI verification results
- `NOT_CONNECTED`, stale, and manual-review limitations

- [ ] **Step 4: Set the next revenue experiment from measured priority**

Select the highest-priority `MEASURED` page that has a concrete, policy-safe improvement and has not already been completed in `docs/growth/`. Do not automatically edit it in this task; record it as the next bounded task.
