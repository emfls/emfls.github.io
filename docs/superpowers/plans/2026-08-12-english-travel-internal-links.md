# English Travel Internal Links Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 영어 여행 페이지를 국가별 허브와 같은 국가 관련 도시 링크로 연결한다.

**Architecture:** 독립적인 Python 생성기가 영어 여행 HTML을 분류하고 링크 계획을 만든 뒤, 생성 마커 사이만 갱신한다. 국가 허브와 여행 메인 국가 디렉터리를 정적 HTML로 생성하며 별도 검증 명령으로 전체 링크를 검사한다.

**Tech Stack:** Python 3 표준 라이브러리, pytest, 정적 HTML

## Global Constraints

- 기존 상세 페이지 URL과 canonical URL을 변경하지 않는다.
- 영어 여행 페이지끼리만 관련 도시를 연결한다.
- 모든 탐색 링크는 정적 `<a href>`로 출력한다.
- 생성기를 반복 실행해도 추가 변경이 없어야 한다.

---

### Task 1: 분류 및 링크 계획기

**Files:**
- Create: `scripts/generate_english_travel_links.py`
- Create: `tests/test_generate_english_travel_links.py`

**Interfaces:**
- Produces: `collect_pages(root: Path) -> list[TravelPage]`
- Produces: `group_by_country(pages: list[TravelPage]) -> dict[str, list[TravelPage]]`
- Produces: `related_pages(page: TravelPage, country_pages: list[TravelPage], limit: int = 3) -> list[TravelPage]`

- [ ] **Step 1: Write failing classification and related-city tests**
- [ ] **Step 2: Run `pytest -q tests/test_generate_english_travel_links.py` and verify failure because the module is absent**
- [ ] **Step 3: Implement metadata extraction, normalized country slugs, deterministic related-city selection**
- [ ] **Step 4: Run the focused tests and verify they pass**
- [ ] **Step 5: Commit the tested planner**

### Task 2: 정적 허브 및 상세 링크 렌더링

**Files:**
- Modify: `scripts/generate_english_travel_links.py`
- Modify: `tests/test_generate_english_travel_links.py`

**Interfaces:**
- Produces: `render_country_hub(country: CountryGroup, page_number: int) -> str`
- Produces: `render_related_block(page: TravelPage, related: list[TravelPage]) -> str`
- Produces: `apply_generated_block(html: str, marker: str, block: str, before: str) -> str`

- [ ] **Step 1: Write failing tests for valid static links, pagination, language isolation, and idempotent marker replacement**
- [ ] **Step 2: Run the focused tests and verify the new tests fail for missing behavior**
- [ ] **Step 3: Implement minimal renderers and marker replacement**
- [ ] **Step 4: Run the focused tests and verify they pass**
- [ ] **Step 5: Commit the tested renderer**

### Task 3: 전체 생성 및 검증

**Files:**
- Modify: `report/travel/index.html`
- Create: `report/travel/country/*/index.html`
- Modify: `report/travel/*.html`
- Create: `docs/growth/2026-08-12-english-travel-link-exceptions.csv`
- Modify: `docs/growth/2026-08-12-internal-link-classification.md`

**Interfaces:**
- Consumes: Task 1 and Task 2 generator functions
- Produces: `generate(root: Path, check: bool = False) -> GenerationSummary`

- [ ] **Step 1: Write failing integration tests for dry-run/check mode and broken-link detection**
- [ ] **Step 2: Run the focused tests and verify expected failures**
- [ ] **Step 3: Implement atomic generation, exception CSV, and validation summary**
- [ ] **Step 4: Run the generator on the repository, then run it again in check mode**
- [ ] **Step 5: Recompute inbound-link metrics and record them in the growth report**
- [ ] **Step 6: Run focused tests, relevant existing tests, broken-link validation, and `git diff --check`**
- [ ] **Step 7: Commit generated pages, generator, tests, and report**

