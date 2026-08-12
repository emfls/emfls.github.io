# Search Console 성장 후보 3차 개선 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 스위스·르완다·토고·탄자니아 비자와 애들레이드 여행 페이지를 공식 근거 중심으로 개선해 검색 클릭률과 방문 만족도를 높인다.

**Architecture:** 다섯 정적 HTML의 URL, canonical, GA4와 AdSense 계약은 유지한다. 검색 스니펫, 첫 답변, 변동 정보, 공식 출처와 문맥형 내부 링크만 정밀 수정하고 전용 계약 테스트와 전체 회귀 검사로 검증한다.

**Tech Stack:** 정적 HTML, JSON-LD, Python `unittest`/`pytest`, GitHub Pages

## Global Constraints

- 대상은 `switzerland.html`, `rwanda.html`, `togo.html`, `tanzania.html`, `australia-adelaide.html` 다섯 페이지다.
- canonical, GA4 `G-QP5Q67GE5B`, AdSense `ca-pub-8830524482034754`와 기존 광고 위치를 유지한다.
- 변동 정보는 정부·이민국·공식 관광·교통기관의 현재 원문만 근거로 사용한다.
- 비자·입국·승인·안전·시설 운영을 보장하거나 확인되지 않은 비용·처리시간을 확정하지 않는다.
- 실제 확인한 항목만 `2026-08-12`로 갱신한다.

---

### Task 1: 공식 정보와 페이지 계약 개선

**Files:**
- Create: `tests/test_gsc_opportunity_batch_03.py`
- Modify: `kor/report/visa/switzerland.html`
- Modify: `kor/report/visa/rwanda.html`
- Modify: `kor/report/visa/togo.html`
- Modify: `kor/report/visa/tanzania.html`
- Modify: `kor/report/travel/australia-adelaide.html`

**Interfaces:**
- Consumes: 각 HTML의 메타데이터, canonical, JSON-LD, 본문 링크, GA4·AdSense 태그
- Produces: 현재 확인일, 답변 우선 구조, 공식 출처와 내부 다음 단계가 있는 다섯 페이지

- [x] **Step 1: 공식 출처를 현재 시점에 확인한다**

스위스 이민청·EU ETIAS, 르완다 이민국·보건기관, 토고 정부 여행 포털, 탄자니아 이민국, 호주 내무부·애들레이드 공식 관광·교통기관 원문에서 설계서의 변동 정보를 확인한다.

- [x] **Step 2: 실패하는 공통 계약 테스트를 작성한다**

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

- [x] **Step 3: 새 계약이 현재 페이지에서 실패하는지 확인한다**

Run: `pytest -q tests/test_gsc_opportunity_batch_03.py`

Expected: 최신 확인일, 첫 답변 표지 또는 필수 공식 출처 조건에서 FAIL.

- [x] **Step 4: 공식 자료와 검색 의도에 맞게 다섯 페이지를 수정한다**

스위스는 90/180일·ETIAS·장기체류 구분, 르완다는 도착비자·온라인 신청·황열, 토고는 eVisa와 입국 전 신청, 탄자니아는 eVisa·도착비자·서류 조건, 애들레이드는 공항 이동·2박 3일 동선·마켓 운영·ETA를 첫 판단부터 정리한다. 제목, description, 본문과 JSON-LD 날짜를 일치시킨다.

- [x] **Step 5: 신규 및 관련 기존 테스트를 통과시킨다**

Run: `pytest -q tests/test_gsc_opportunity_batch_03.py $(rg --files tests | rg 'switzerland|rwanda|togo|tanzania|adelaide')`

Expected: PASS.

- [x] **Step 6: 구현을 커밋한다**

```bash
git add tests/test_gsc_opportunity_batch_03.py kor/report/visa/switzerland.html kor/report/visa/rwanda.html kor/report/visa/togo.html kor/report/visa/tanzania.html kor/report/travel/australia-adelaide.html
git commit -m "feat: improve third search opportunity batch"
```

### Task 2: 기록, 전체 검증, 배포

**Files:**
- Create: `docs/growth/2026-08-12-search-opportunity-batch-03.md`
- Modify: `docs/superpowers/plans/2026-08-12-gsc-opportunity-batch-03.md`

**Interfaces:**
- Consumes: Search Console 기준선, 공식 출처와 Task 1의 변경 결과
- Produces: 2026-09-09 이후 비교 가능한 기록과 원격 `main` 배포

- [x] **Step 1: 페이지별 기준선·변경·공식 근거를 기록한다**

다섯 페이지의 클릭·노출·CTR·평균 순위, 적용 내용, 공식 출처와 AdSense 안전장치 유지 여부를 저장한다.

- [x] **Step 2: 전체 회귀 검사를 실행한다**

Run: `pytest -q`

Expected: 전체 PASS, failure와 error 0개.

- [x] **Step 3: 변경 품질을 검사하고 기록을 커밋한다**

Run: `git diff --check && git status --short`

```bash
git add docs/growth/2026-08-12-search-opportunity-batch-03.md docs/superpowers/plans/2026-08-12-gsc-opportunity-batch-03.md
git commit -m "docs: record third search opportunity batch"
```

- [x] **Step 4: 원격 main에 배포하고 동기화를 검증한다**

Run: `git push origin main && git fetch origin main && git rev-parse HEAD && git rev-parse origin/main && git status --short`

Expected: 로컬과 원격 해시가 같고 작업 트리가 깨끗하다.
