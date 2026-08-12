# Search Console 성장 후보 2차 개선 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 검색 노출이 있으나 CTR 또는 순위 개선 여지가 있는 러시아·우크라이나·UAE·사우디 비자와 가평 캠핑 페이지를 공식 근거 중심으로 개선한다.

**Architecture:** 다섯 정적 HTML의 URL과 측정·광고 계약은 유지하고 검색 스니펫, 첫 답변, 변동 정보, 공식 출처와 내부 링크만 정밀 수정한다. 공통 계약 테스트와 기존 개별 테스트가 최신성 및 회귀를 검증한다.

**Tech Stack:** 정적 HTML, JSON-LD, Python `unittest`/`pytest`, GitHub Pages

## Global Constraints

- 대상은 `russia.html`, `ukraine.html`, `uae.html`, `saudiarabia.html`, `gapyeong.html` 다섯 페이지다.
- canonical, GA4 `G-QP5Q67GE5B`, AdSense `ca-pub-8830524482034754`를 유지한다.
- 여행경보는 대한민국 외교부, 입국 조건은 정부·영사·공식 비자 포털, 캠핑은 고캠핑·운영기관을 근거로 한다.
- 광고 수·위치 변경, 입국·운영 보장, 확인되지 않은 비용·승인시간·혜택·예약 가능 표현을 금지한다.
- 실제 확인한 항목만 `2026-08-12`로 갱신한다.

---

### Task 1: 공식 정보와 공통 계약 검증

**Files:**
- Create: `tests/test_gsc_opportunity_batch_02.py`
- Modify: `kor/report/visa/russia.html`
- Modify: `kor/report/visa/ukraine.html`
- Modify: `kor/report/visa/uae.html`
- Modify: `kor/report/visa/saudiarabia.html`
- Modify: `kor/report/camp/gapyeong.html`

**Interfaces:**
- Consumes: HTML 메타데이터, canonical, JSON-LD, 본문 링크, GA4·AdSense 태그
- Produces: 최신 답변·공식 출처·내부 다음 단계가 확인되는 다섯 페이지

- [x] **Step 1: 공식 출처를 현재 시점에 확인한다**

대한민국 외교부의 러시아·우크라이나 여행경보, 러시아 외교부 입국조건, UAE 정부 비자 안내, Visit Saudi eVisa, 고캠핑의 가평 시설 운영 상태를 확인한다. 검색 결과 요약이 아닌 공식 원문을 최종 기준으로 삼는다.

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
        assert all(any(domain in a.get("href", "") for a in page.links) for domain in domains)
        assert any(a.get("href", "").endswith(".html") or a.get("href", "").startswith("/kor/report/") for a in page.links)
```

- [x] **Step 3: 새 계약이 현재 페이지에서 실패하는지 확인한다**

Run: `pytest -q tests/test_gsc_opportunity_batch_02.py`

Expected: 최신 확인일 또는 명시적인 첫 답변 조건에서 FAIL.

- [x] **Step 4: 공식 자료와 검색 의도에 맞게 다섯 페이지를 수정한다**

러시아·우크라이나는 여행경보를 첫 판단으로, UAE·사우디는 공식 조회와 승인서 조건을 첫 판단으로 둔다. 가평 시설은 운영 상태가 확인된 곳만 예약 후보로 표현한다. 제목·description·화면 본문·JSON-LD 날짜가 서로 일치하도록 한다.

- [x] **Step 5: 신규 및 기존 페이지 테스트를 통과시킨다**

Run: `pytest -q tests/test_gsc_opportunity_batch_02.py tests/test_ukraine_visa_page.py tests/test_gapyeong_camping_page.py tests/test_third_batch_visa_pages.py`

Expected: PASS.

- [x] **Step 6: 구현을 커밋한다**

```bash
git add tests/test_gsc_opportunity_batch_02.py tests/test_ukraine_visa_page.py tests/test_gapyeong_camping_page.py kor/report/visa/russia.html kor/report/visa/ukraine.html kor/report/visa/uae.html kor/report/visa/saudiarabia.html kor/report/camp/gapyeong.html
git commit -m "feat: improve second search opportunity batch"
```

### Task 2: 기록, 전체 검증, 배포

**Files:**
- Create: `docs/growth/2026-08-12-search-opportunity-batch-02.md`
- Modify: `docs/superpowers/plans/2026-08-12-gsc-opportunity-batch-02.md`

**Interfaces:**
- Consumes: Search Console 기준선과 Task 1의 변경 결과
- Produces: 28일 후 비교 가능한 기록과 원격 `main` 배포

- [x] **Step 1: 페이지별 기준선·변경·공식 근거를 기록한다**

사이트 전체 기준선과 다섯 페이지의 클릭·노출·CTR·순위를 표로 저장하고 AdSense 안전장치 유지 여부를 기록한다.

- [x] **Step 2: 전체 회귀 검사를 실행한다**

Run: `pytest -q`

Expected: 전체 PASS, failure와 error 0개.

- [x] **Step 3: 변경 품질을 검사하고 기록을 커밋한다**

Run: `git diff --check && git status --short`

```bash
git add docs/growth/2026-08-12-search-opportunity-batch-02.md docs/superpowers/plans/2026-08-12-gsc-opportunity-batch-02.md
git commit -m "docs: record second search opportunity batch"
```

- [ ] **Step 4: 원격 main에 배포하고 동기화를 검증한다**

Run: `git push origin main && git fetch origin main && git rev-parse HEAD && git rev-parse origin/main && git status --short`

Expected: 로컬과 원격 해시가 같고 작업 트리가 깨끗하다.
