# Search Console 성장 후보 4차 개선 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 슬로베니아·네팔·남수단·우간다 비자와 공주 캠핑 페이지를 공식 근거 중심으로 개선해 검색 클릭률과 첫 방문 만족도를 높인다.

**Architecture:** 다섯 정적 HTML의 URL, canonical, GA4와 AdSense 계약은 유지한다. 검색 스니펫, 첫 답변, 변동 정보, 공식 출처와 문맥형 내부 링크만 수정하고 전용 계약 테스트와 전체 회귀 검사로 검증한다.

**Tech Stack:** 정적 HTML, JSON-LD, Python `unittest`/`pytest`, GitHub Pages

## Global Constraints

- 대상은 `slovenia.html`, `nepal.html`, `southsudan.html`, `uganda.html`, `gongju.html` 다섯 페이지다.
- canonical, GA4 `G-QP5Q67GE5B`, AdSense `ca-pub-8830524482034754`와 기존 광고 위치를 유지한다.
- 변동 정보는 정부·이민국·지자체·한국관광공사·공식 안전기관의 현재 원문만 근거로 사용한다.
- 비자·입국·안전·운영·예약 가능을 보장하거나 확인되지 않은 비용·처리시간을 확정하지 않는다.
- 실제 확인한 항목만 `2026-08-12`로 갱신한다.

---

### Task 1: 공식 정보와 페이지 계약 개선

**Files:**
- Create: `tests/test_gsc_opportunity_batch_04.py`
- Modify: `kor/report/visa/slovenia.html`
- Modify: `kor/report/visa/nepal.html`
- Modify: `kor/report/visa/southsudan.html`
- Modify: `kor/report/visa/uganda.html`
- Modify: `kor/report/camp/gongju.html`

**Interfaces:**
- Consumes: 각 HTML의 메타데이터, canonical, JSON-LD, 본문 링크, GA4·AdSense 태그
- Produces: 현재 확인일, 답변 우선 구조, 공식 출처와 내부 다음 단계가 있는 다섯 페이지

- [ ] **Step 1: 공식 출처를 현재 시점에 확인한다**

슬로베니아 정부·EU ETIAS, 네팔 이민국, 남수단 eVisa·대한민국 외교부, 우간다 이민국, 고캠핑·공주시 원문에서 설계서의 변동 정보를 확인한다.

- [ ] **Step 2: 실패하는 공통 계약 테스트를 작성한다**

```python
def test_pages_keep_canonical_measurement_and_ads():
    for path, canonical in PAGES.items():
        html, page = parse(path)
        assert page.canonical == canonical
        assert "G-QP5Q67GE5B" in html
        assert "ca-pub-8830524482034754" in html

def test_pages_have_current_answer_sources_and_internal_next_step():
    for path, domains in OFFICIAL_DOMAINS.items():
        html, page = parse(path)
        assert "2026-08-12" in html
        assert any(label in html for label in ("먼저 답", "빠른 답", "핵심 답변"))
        assert all(any(domain in link for link in page.links) for domain in domains)
        assert any(link.endswith(".html") or link.startswith("/kor/report/") for link in page.links)
```

- [ ] **Step 3: 새 계약이 현재 페이지에서 실패하는지 확인한다**

Run: `pytest -q tests/test_gsc_opportunity_batch_04.py`

Expected: 최신 확인일, 첫 답변 표지, 공식 출처 또는 안전 우선 조건에서 FAIL.

- [ ] **Step 4: 공식 자료와 검색 의도에 맞게 다섯 페이지를 수정한다**

슬로베니아는 90/180일·ETIAS·장기체류, 공주는 등록·운영·예약과 노지 야영 확인, 네팔은 도착비자 기간·비용·여권, 남수단은 여행경보·eVisa·황열, 우간다는 사전 eVisa·비용·황열·EATV를 첫 판단부터 정리한다. 제목, description, 본문과 JSON-LD 날짜를 일치시킨다.

- [ ] **Step 5: 신규 및 관련 기존 테스트를 통과시킨다**

Run: `pytest -q tests/test_gsc_opportunity_batch_04.py $(rg --files tests | rg 'slovenia|nepal|southsudan|uganda|gongju')`

Expected: PASS.

- [ ] **Step 6: 구현을 커밋한다**

```bash
git add tests/test_gsc_opportunity_batch_04.py kor/report/visa/slovenia.html kor/report/visa/nepal.html kor/report/visa/southsudan.html kor/report/visa/uganda.html kor/report/camp/gongju.html
git commit -m "feat: improve fourth search opportunity batch"
```

### Task 2: 기록, 전체 검증, 배포

**Files:**
- Create: `docs/growth/2026-08-12-search-opportunity-batch-04.md`
- Modify: `docs/superpowers/plans/2026-08-12-gsc-opportunity-batch-04.md`

**Interfaces:**
- Consumes: Search Console 기준선, 공식 출처와 Task 1의 변경 결과
- Produces: 2026-09-09 이후 비교 가능한 기록과 원격 `main` 배포

- [ ] **Step 1: 페이지별 기준선·변경·공식 근거를 기록한다**

다섯 페이지의 클릭·노출·CTR·평균 순위, 적용 내용, 공식 출처와 AdSense 안전장치 유지 여부를 저장한다.

- [ ] **Step 2: 전체 회귀 검사를 실행한다**

Run: `pytest -q`

Expected: 전체 PASS, failure와 error 0개.

- [ ] **Step 3: 변경 품질을 검사하고 기록을 커밋한다**

Run: `git diff --check && git status --short`

```bash
git add docs/growth/2026-08-12-search-opportunity-batch-04.md docs/superpowers/plans/2026-08-12-gsc-opportunity-batch-04.md
git commit -m "docs: record fourth search opportunity batch"
```

- [ ] **Step 4: 원격 main에 배포하고 동기화를 검증한다**

Run: `git push origin main && git fetch origin main && git rev-parse HEAD && git rev-parse origin/main && git status --short`

Expected: 로컬과 원격 해시가 같고 작업 트리가 깨끗하다.
