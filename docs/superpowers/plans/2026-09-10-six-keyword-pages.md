# Six Keyword Opportunity Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish six distinct Korean keyword-opportunity pages with useful browser-side interactions, authoritative sources, safe high-stakes wording, and complete discovery and experiment records.

**Architecture:** Add three self-contained utility directories and three self-contained guide HTML files, following the existing static-site patterns. Keep calculation functions in marked pure JavaScript blocks so Node tests can execute them without a browser; keep UI adapters separate and render user-derived values with `textContent`. Integrate the pages through existing topic hubs, sitemaps, metadata, launch manifest, experiments, and Keyword Hunter state only after page contracts pass.

**Tech Stack:** Static HTML5, CSS, vanilla JavaScript, Python `pytest`/`unittest`, Node.js for pure JavaScript execution, JSON/CSV publication records.

**Spec:** `docs/superpowers/specs/2026-09-10-six-keyword-pages-design.md`

## Global Constraints

- Create exactly the six canonical URLs named in the spec; do not create keyword-variant pages.
- All user inputs remain in the browser and no new network requests, storage, accounts, or APIs are introduced.
- Preserve `G-QP5Q67GE5B`, `ca-pub-8830524482034754`, canonical behavior, policy links, and existing ad placement.
- Verify current high-stakes claims from primary official sources and show `Reviewed: 2026-09-10` or `최근 확인: 2026-09-10` on every page.
- Never invent missing fees, tax outcomes, visa eligibility, health diagnoses, product rankings, or guarantees.
- Use `textContent` or DOM node creation for user-derived output; no user-controlled `innerHTML`.
- Preserve all unrelated working-tree changes and do not edit protected winner or active-experiment page bodies.

---

### Task 1: Publication contract and reusable test helpers

**Files:**
- Create: `tests/test_six_keyword_opportunity_pages.py`

**Interfaces:**
- Consumes: the six canonical paths and shared contract from the spec.
- Produces: `PAGES`, `read_page(slug)`, and `run_pure(path, expression)` used by later tests.

- [ ] **Step 1: Write the failing shared publication test**

```python
PAGES = {
    "car": ("kor/util/car-inspection-cost/index.html", "자동차검사 비용·예약 도우미"),
    "date": ("kor/util/date-calculator/index.html", "날짜 계산기"),
    "pension": ("kor/util/retirement-pension-withdrawal/index.html", "퇴직연금 수령 시나리오 비교기"),
    "camp": ("kor/report/camp/carbon-monoxide-detector.html", "캠핑 일산화탄소 경보기 안전 가이드"),
    "esta": ("kor/report/visa/esta-application-checklist.html", "ESTA 신청 체크 도우미"),
    "pet": ("kor/report/animal/pet-food-selector.html", "반려동물 사료 선택 도우미"),
}

def test_all_pages_meet_shared_publication_contract():
    for relative, h1 in PAGES.values():
        html = (ROOT / relative).read_text(encoding="utf-8")
        assert '<meta name="viewport"' in html
        assert f'<h1>{h1}</h1>' in html
        assert f'https://emfls.github.io/{relative.removesuffix("index.html")}' in html
        assert "G-QP5Q67GE5B" in html
        assert "ca-pub-8830524482034754" in html
        assert "2026-09-10" in html
        assert "application/ld+json" in html
        assert "개인정보" in html or "브라우저" in html
```

- [ ] **Step 2: Run the shared test and verify RED**

Run: `python3 -m pytest tests/test_six_keyword_opportunity_pages.py -q`  
Expected: FAIL because the first new page does not exist.

- [ ] **Step 3: Add pure-function execution helper and per-page placeholder assertions only in the test file**

```python
def run_pure(relative, expression):
    html = (ROOT / relative).read_text(encoding="utf-8")
    block = re.search(r"<!-- PURE_START -->(.*?)<!-- PURE_END -->", html, re.S)
    assert block, f"missing pure block: {relative}"
    result = subprocess.run(
        ["node", "-e", block.group(1) + f"\nconsole.log(JSON.stringify({expression}));"],
        text=True, capture_output=True, check=True,
    )
    return json.loads(result.stdout)
```

- [ ] **Step 4: Re-run to confirm failure is still caused by missing production pages**

Run: `python3 -m pytest tests/test_six_keyword_opportunity_pages.py -q`  
Expected: FAIL on missing page, not a syntax or import error.

### Task 2: 자동차검사 비용·예약 도우미

**Files:**
- Create: `kor/util/car-inspection-cost/index.html`
- Modify: `tests/test_six_keyword_opportunity_pages.py`

**Interfaces:**
- Consumes: a source-verified list of inspection types, vehicle groups, fees, limitations, reductions, and official reservation URL.
- Produces: `lookupInspectionFee(inspectionType, vehicleClass) -> {status, fee, label}` in the pure block.

- [ ] **Step 1: Verify official facts and record the exact primary URLs in the test fixture**

Use only the current Korea Transportation Safety Authority/Cyber Inspection official fee, reduction, definition, and booking pages. Record the checked URLs in `OFFICIAL_SOURCES["car"]`; if an exact fee table cannot be established, make the page return `확인 필요` and link to official lookup rather than embedding a number.

- [ ] **Step 2: Write failing behavior and safety tests**

```python
def test_car_tool_has_bounded_fee_lookup_and_official_handoff():
    result = run_pure(PAGES["car"][0], "lookupInspectionFee('unknown','unknown')")
    assert result["status"] == "unknown"
    html = read_page("car")
    assert "대행 수수료와 검사 수수료는 다릅니다" in html
    assert "확정 견적이 아닙니다" in html
    assert OFFICIAL_SOURCES["car"] in html
```

- [ ] **Step 3: Run the car test and verify RED**

Run: `python3 -m pytest tests/test_six_keyword_opportunity_pages.py -q -k car`  
Expected: FAIL because the car page and function are missing.

- [ ] **Step 4: Implement the car page minimally**

Build an accessible form with two selects, a result region with `aria-live="polite"`, a source-backed lookup table, explicit unknown fallback, official reservation link, fee-reduction checklist, distinction between inspection and agency charges, visible source/check date, related car hub link, WebApplication schema, and matching visible FAQ.

- [ ] **Step 5: Run the car and shared tests**

Run: `python3 -m pytest tests/test_six_keyword_opportunity_pages.py -q -k 'car or shared'`  
Expected: PASS for car-specific behavior; remaining missing-page shared assertions are expected until Task 7.

- [ ] **Step 6: Commit the car page slice**

```bash
git add tests/test_six_keyword_opportunity_pages.py kor/util/car-inspection-cost/index.html
git commit -m "feat: add car inspection cost helper"
```

### Task 3: 날짜 계산기

**Files:**
- Create: `kor/util/date-calculator/index.html`
- Modify: `tests/test_six_keyword_opportunity_pages.py`

**Interfaces:**
- Produces: `daysBetween(start, end, inclusive)`, `shiftDate(date, days)`, and `weekdaysBetween(start, end, inclusive)` in the pure block; all return serializable result objects with an `error` field on invalid input.

- [ ] **Step 1: Write failing calculation tests**

```python
def test_date_calculator_handles_leap_reverse_inclusive_and_weekdays():
    path = PAGES["date"][0]
    assert run_pure(path, "daysBetween('2024-02-28','2024-03-01',false)")["days"] == 2
    assert run_pure(path, "daysBetween('2024-03-01','2024-02-28',false)")["days"] == -2
    assert run_pure(path, "daysBetween('2024-02-28','2024-03-01',true)")["days"] == 3
    assert run_pure(path, "shiftDate('2024-02-28',1)")["date"] == "2024-02-29"
    assert run_pure(path, "weekdaysBetween('2026-09-07','2026-09-13',true)")["days"] == 5
```

- [ ] **Step 2: Run and verify RED**

Run: `python3 -m pytest tests/test_six_keyword_opportunity_pages.py -q -k date_calculator`  
Expected: FAIL because the date page is missing.

- [ ] **Step 3: Implement the pure functions and four-mode UI**

Use UTC date components to avoid daylight-saving drift. Add date difference, add/subtract, D-day, and weekday panels; an inclusive toggle; public-holiday exclusion disclaimer; local-processing statement; accessible tab buttons; text-only results; WebApplication schema; and links to related time tools without claiming that the new page replaces them.

- [ ] **Step 4: Run date tests and Node syntax check**

Run: `python3 -m pytest tests/test_six_keyword_opportunity_pages.py -q -k date_calculator`  
Expected: PASS.

- [ ] **Step 5: Commit the date page slice**

```bash
git add tests/test_six_keyword_opportunity_pages.py kor/util/date-calculator/index.html
git commit -m "feat: add Korean date calculator"
```

### Task 4: 퇴직연금 수령 시나리오 비교기

**Files:**
- Create: `kor/util/retirement-pension-withdrawal/index.html`
- Modify: `tests/test_six_keyword_opportunity_pages.py`

**Interfaces:**
- Produces: `calculatePensionIllustration(balance, years, annualRate) -> {status, zeroReturnMonthly, assumedReturnMonthly}`.

- [ ] **Step 1: Verify official pension definitions and limits**

Use current Korean government, Financial Supervisory Service, National Tax Service, or governing-law primary pages. Save the exact URLs in the test and use them visibly in the page. Do not encode tax rates or personalized eligibility.

- [ ] **Step 2: Write failing math and disclosure tests**

```python
def test_pension_tool_calculates_only_gross_illustrations():
    path = PAGES["pension"][0]
    result = run_pure(path, "calculatePensionIllustration(12000000,10,0)")
    assert result["zeroReturnMonthly"] == 100000
    assert result["assumedReturnMonthly"] == 100000
    assert "세금·수수료를 계산하지 않습니다" in read_page("pension")
    assert "수익률을 직접 입력" in read_page("pension")
```

- [ ] **Step 3: Run and verify RED**

Run: `python3 -m pytest tests/test_six_keyword_opportunity_pages.py -q -k pension`  
Expected: FAIL because the pension page is missing.

- [ ] **Step 4: Implement the bounded illustration tool**

Reject non-positive balance/years and rates at or below -100%. Leave return blank by default; calculate equal gross withdrawal and optional monthly amortization only after explicit input. Include DB/DC/IRP high-level distinctions, provider/professional handoff, excluded factors, official sources and check date, WebApplication schema, and visible FAQ.

- [ ] **Step 5: Run pension tests**

Run: `python3 -m pytest tests/test_six_keyword_opportunity_pages.py -q -k pension`  
Expected: PASS.

- [ ] **Step 6: Commit the pension page slice**

```bash
git add tests/test_six_keyword_opportunity_pages.py kor/util/retirement-pension-withdrawal/index.html
git commit -m "feat: add retirement pension scenario helper"
```

### Task 5: 캠핑 일산화탄소 경보기 안전 가이드

**Files:**
- Create: `kor/report/camp/carbon-monoxide-detector.html`
- Modify: `tests/test_six_keyword_opportunity_pages.py`

**Interfaces:**
- Produces: a static emergency-first guide and local checklist with `toggleChecklistItem(id, checked) -> {checkedCount, total}` in the pure block.

- [ ] **Step 1: Verify public-safety guidance from primary authorities**

Prefer Korean fire/public-safety authorities; use a recognized government public-health or fire authority for any gap and label its jurisdiction. Record exact source URLs and checked date. Do not translate device placement into a universal distance if the authority defers to manufacturer instructions.

- [ ] **Step 2: Write failing emergency-priority tests**

```python
def test_co_guide_puts_emergency_action_before_product_criteria():
    html = read_page("camp")
    assert html.index("경보가 울리면") < html.index("제품 선택 기준")
    assert "경보기가 있어도 텐트나 차량 안에서 연소기기를 사용하면 안전해지는 것은 아닙니다" in html
    assert "119" in html
    assert "제조사 설치 지침" in html
```

- [ ] **Step 3: Run and verify RED**

Run: `python3 -m pytest tests/test_six_keyword_opportunity_pages.py -q -k co_guide`  
Expected: FAIL because the camp guide is missing.

- [ ] **Step 4: Implement the emergency-first guide**

Place immediate actions at the top, then prevention, placement principles, trip checklist, testing/replacement checks, neutral product criteria, affiliate-disclosure policy, authoritative sources, reviewed date, visible FAQ, and related camping links. Keep checkbox state in memory only.

- [ ] **Step 5: Run camp tests**

Run: `python3 -m pytest tests/test_six_keyword_opportunity_pages.py -q -k co_guide`  
Expected: PASS.

- [ ] **Step 6: Commit the camp guide slice**

```bash
git add tests/test_six_keyword_opportunity_pages.py kor/report/camp/carbon-monoxide-detector.html
git commit -m "feat: publish camping carbon monoxide guide"
```

### Task 6: ESTA 신청 체크 도우미

**Files:**
- Create: `kor/report/visa/esta-application-checklist.html`
- Modify: `tests/test_six_keyword_opportunity_pages.py`

**Interfaces:**
- Produces: `summarizeChecklist(values) -> {complete, remaining}` using only boolean checklist state.

- [ ] **Step 1: Verify current ESTA facts from official U.S. government sources**

Confirm the official application URL, definition, timing wording, current fee if shown, and non-guarantee language from U.S. Customs and Border Protection or another official `.gov` page. Record the exact source URLs in the test and page.

- [ ] **Step 2: Write failing official-link and privacy tests**

```python
def test_esta_helper_is_official_first_and_collects_no_sensitive_fields():
    html = read_page("esta")
    assert "https://esta.cbp.dhs.gov/" in html
    assert html.index("공식 ESTA 신청") < html.index("관련 글")
    assert "입국을 보장하지 않습니다" in html
    for forbidden in ('name="passport"', 'type="file"', 'name="card"', 'name="address"'):
        assert forbidden not in html
```

- [ ] **Step 3: Run and verify RED**

Run: `python3 -m pytest tests/test_six_keyword_opportunity_pages.py -q -k esta`  
Expected: FAIL because the ESTA page is missing.

- [ ] **Step 4: Implement the non-sensitive checklist**

Use boolean preparation items only, an official-site warning panel before advertising or related content, definition and limitations, current verified fee/timing only if official evidence is clear, scam avoidance, visible sources/check date, WebPage schema, and matching FAQ.

- [ ] **Step 5: Run ESTA tests**

Run: `python3 -m pytest tests/test_six_keyword_opportunity_pages.py -q -k esta`  
Expected: PASS.

- [ ] **Step 6: Commit the ESTA guide slice**

```bash
git add tests/test_six_keyword_opportunity_pages.py kor/report/visa/esta-application-checklist.html
git commit -m "feat: publish official-first ESTA checklist"
```

### Task 7: 반려동물 사료 선택 도우미

**Files:**
- Create: `kor/report/animal/pet-food-selector.html`
- Modify: `tests/test_six_keyword_opportunity_pages.py`

**Interfaces:**
- Produces: `buildLabelChecklist({species, lifeStage, bodyGoal, sensitivity}) -> {status, checks, veterinaryPrompt}`.

- [ ] **Step 1: Verify label-reading principles from primary regulatory/veterinary sources**

Use Korean regulator guidance when adequate and recognized primary veterinary/regulatory guidance for missing general principles. Record exact URLs and avoid brand or therapeutic diet claims.

- [ ] **Step 2: Write failing neutral-selector safety tests**

```python
def test_pet_selector_returns_label_questions_not_products_or_diagnoses():
    result = run_pure(PAGES["pet"][0], "buildLabelChecklist({species:'cat',lifeStage:'kitten',bodyGoal:'maintain',sensitivity:true})")
    assert result["status"] == "veterinary_review"
    assert result["checks"]
    html = read_page("pet")
    assert "제품이나 브랜드를 추천하지 않습니다" in html
    assert "진단하지 않습니다" in html
    assert "수의사" in html
```

- [ ] **Step 3: Run and verify RED**

Run: `python3 -m pytest tests/test_six_keyword_opportunity_pages.py -q -k pet_selector`  
Expected: FAIL because the pet selector is missing.

- [ ] **Step 4: Implement the neutral label checklist**

Provide species, life stage, body goal, and known-sensitivity controls. Return label-reading prompts and veterinary questions through DOM-safe rendering. Route young, pregnant, symptomatic, diagnosed, weight-loss, or sensitivity cases to professional review; include transition guidance, warning signs, visible sources/check date, WebPage schema, and matching FAQ.

- [ ] **Step 5: Run all six page tests**

Run: `python3 -m pytest tests/test_six_keyword_opportunity_pages.py -q`  
Expected: PASS.

- [ ] **Step 6: Commit the pet selector slice**

```bash
git add tests/test_six_keyword_opportunity_pages.py kor/report/animal/pet-food-selector.html
git commit -m "feat: add neutral pet food label selector"
```

### Task 8: Discovery, metadata, and publication records

**Files:**
- Modify: `kor/util/index.html`
- Modify: `kor/sitemap.xml`
- Modify: `kor/report/camp/index.html`
- Modify: `kor/report/camp/sitemap.xml`
- Modify: `kor/report/visa/index.html`
- Modify: `kor/report/visa/sitemap.xml`
- Modify: `kor/report/animal/index.html`
- Modify: `kor/report/animal/sitemap.xml`
- Modify: `data/content-metadata.json`
- Modify: `data/content-launch-manifest.json`
- Modify: `data/content-launch-experiments.json`
- Modify: `data/keywords_master.csv`
- Modify: `data/published_keywords.json`
- Modify: `tests/test_six_keyword_opportunity_pages.py`

**Interfaces:**
- Consumes: six complete pages and their canonical URLs, target queries, sources, and reviewed dates.
- Produces: discoverability and internally consistent `PUBLISHED`/28-day observation records.

- [ ] **Step 1: Write failing integration-record tests**

```python
def test_all_pages_are_discoverable_and_registered():
    for key, (relative, _) in PAGES.items():
        url = "/" + relative.removesuffix("index.html")
        assert url in relevant_hub_text(key)
        assert "https://emfls.github.io" + url in relevant_sitemap_text(key)
        assert metadata_entry(url)["target_query"]
        assert experiment_entry(url)["status"] == "OBSERVING"
        assert keyword_rows_for_url(url)
        assert all(row["status"] == "PUBLISHED" for row in keyword_rows_for_url(url))
```

- [ ] **Step 2: Run and verify RED**

Run: `python3 -m pytest tests/test_six_keyword_opportunity_pages.py -q -k discoverable`  
Expected: FAIL because hubs, sitemaps, or publication records do not yet include the pages.

- [ ] **Step 3: Update hubs and sitemaps minimally**

Add one clear card/link per page to the relevant hub. Update hub visible counts and structured-data modification dates only where present. Add one `<url>` per new canonical to the correct sitemap with `<lastmod>2026-09-10</lastmod>` and add utility URLs to `kor/sitemap.xml` because no `kor/util/sitemap.xml` exists.

- [ ] **Step 4: Append content metadata and six experiments**

Use target queries `자동차검사비용`, `날짜계산`, `퇴직연금수령방법`, `캠핑일산화탄소경보기`, `ESTA신청`, and `고양이사료추천`. Use experiment IDs `EXP-CONTENT-20260910-01` through `-06`, publication date `2026-09-10`, and observation/cooldown date `2026-10-08`. Preserve existing entries and JSON ordering conventions.

- [ ] **Step 5: Replace the launch manifest with the exact current batch**

Set `urls` and `contentPaths` to exactly the six new pages, list the four changed hub paths and four sitemap paths, set `publishedToday` to 6, retain the no-limit state, and use a unique `runId` for this batch.

- [ ] **Step 6: Mark mapped Keyword Hunter rows published**

For each canonical page, update only the intended canonical keyword and close variants that the page genuinely answers. Set `status=PUBLISHED`, `closest_url` to the canonical path, and append matching entries to `published_keywords.json`; preserve unrelated rows and do not publish ambiguous variants.

- [ ] **Step 7: Run integration and launch-guard tests**

Run: `python3 -m pytest tests/test_six_keyword_opportunity_pages.py tests/test_content_launch_guard.py -q`  
Expected: PASS.

- [ ] **Step 8: Commit publication integration**

```bash
git add kor/util/index.html kor/sitemap.xml kor/report/camp/index.html kor/report/camp/sitemap.xml kor/report/visa/index.html kor/report/visa/sitemap.xml kor/report/animal/index.html kor/report/animal/sitemap.xml data/content-metadata.json data/content-launch-manifest.json data/content-launch-experiments.json data/keywords_master.csv data/published_keywords.json tests/test_six_keyword_opportunity_pages.py
git commit -m "feat: register six keyword opportunity pages"
```

### Task 9: Focused QA, browser verification, and durable project record

**Files:**
- Modify: `PROJECT_HISTORY.md`
- Modify: `TASKS.md` only if an existing tracked task directly matches this batch; otherwise leave it unchanged.

**Interfaces:**
- Consumes: completed pages and publication records.
- Produces: verified final state and a compact durable history entry.

- [ ] **Step 1: Run focused page and publication tests**

Run: `python3 -m pytest tests/test_six_keyword_opportunity_pages.py tests/test_content_launch_guard.py tests/test_seo_qa.py tests/test_sitemap_audit.py -q`  
Expected: PASS with no warnings attributable to the six pages.

- [ ] **Step 2: Run changed-page link and content QA**

Run the repository's existing SEO QA and sitemap checks against the changed paths. Confirm unique titles/H1s, canonical equality, structured-data parsing, no broken internal links, no ad-click prompts, and no protected-page body changes.

- [ ] **Step 3: Inspect all distinct layouts in a browser**

Serve the static site locally and inspect the car tool, date tool, pension tool, and each guide at desktop and narrow mobile widths. Exercise keyboard focus, each calculator/selector, invalid input, source links, and overflow. Correct failures and repeat the focused tests.

- [ ] **Step 4: Review the final change set**

Run: `git status --short` and `git diff --check` plus a path-limited diff for every file in this plan. Confirm unrelated pre-existing modifications are neither staged nor altered.

- [ ] **Step 5: Record the completed batch**

Append a concise `2026-09-10 — 키워드 기회 페이지 6개 발행` entry to `PROJECT_HISTORY.md` with URLs, official-source boundaries, test counts, experiment window, and remaining monitoring caveats.

- [ ] **Step 6: Commit the verified project record**

```bash
git add PROJECT_HISTORY.md
git commit -m "docs: record six keyword page launch"
```

