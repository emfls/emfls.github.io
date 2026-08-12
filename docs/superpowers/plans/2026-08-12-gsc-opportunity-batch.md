# Search Console 성장 후보 5개 페이지 개선 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 최근 90일에 노출되지만 클릭률 또는 순위 개선 여지가 있는 5개 페이지를 공식 근거와 검색 의도에 맞춰 개선한다.

**Architecture:** URL과 기존 측정·광고 계약은 유지하고 각 HTML 문서의 검색 스니펫, 첫 화면 답변, 공식 근거, 내부 링크만 수정한다. 한 개의 계약 테스트가 다섯 페이지의 공통 요구사항과 페이지별 핵심 의도를 검증하고 기존 개별·전체 테스트가 회귀를 막는다.

**Tech Stack:** 정적 HTML, JSON-LD, Python `unittest`/`pytest`, GitHub Pages

## Global Constraints

- 대상은 `busan.html`, `andong.html`, `norway.html`, `qatar.html`, `sweden.html` 다섯 페이지다.
- 기존 canonical URL, GA4 측정 ID `G-QP5Q67GE5B`, AdSense 게시자 ID `ca-pub-8830524482034754`를 유지한다.
- 비자 정보는 정부·이민국·EU 공식 출처, 캠핑 정보는 지자체·고캠핑 공식 출처로 실제 확인한다.
- 확인되지 않은 입국 요건·수수료·운영 상태를 단정하지 않는다.
- 광고 수나 위치를 변경하거나 광고 클릭 유도 문구를 추가하지 않는다.
- 실제 확인한 내용만 `2026-08-12`로 갱신한다.

---

### Task 1: 다섯 페이지 개선 계약

**Files:**
- Create: `tests/test_gsc_opportunity_batch.py`
- Modify: `kor/report/camp/busan.html`
- Modify: `kor/report/camp/andong.html`
- Modify: `kor/report/visa/norway.html`
- Modify: `kor/report/visa/qatar.html`
- Modify: `kor/report/visa/sweden.html`

**Interfaces:**
- Consumes: 각 HTML 페이지의 `<title>`, description, canonical, 본문 링크, JSON-LD, GA4·AdSense 태그
- Produces: 검색 의도, 공식 출처, 최신 확인일, 관련 내부 링크가 검증되는 다섯 개 정적 페이지

- [x] **Step 1: 공식 출처를 확인하고 변경 근거를 기록한다**

캠핑은 부산시·안동시·고캠핑, 비자는 UDI·카타르 내무부/Visit Qatar·스웨덴 이민국/EU 공식 페이지를 확인한다. 출처가 서로 다르면 한쪽 수치를 임의 선택하지 않고 출발 직전 국적별 공식 조회를 요구하는 문장으로 제한한다.

- [x] **Step 2: 실패하는 공통 계약 테스트를 작성한다**

`tests/test_gsc_opportunity_batch.py`에 다음 동작을 검증한다.

```python
def test_pages_keep_identity_measurement_and_ads():
    for relative_path, canonical in PAGES.items():
        html, page = parse(relative_path)
        assert page.canonical == canonical
        assert "G-QP5Q67GE5B" in html
        assert "ca-pub-8830524482034754" in html

def test_pages_have_current_answer_and_contextual_internal_links():
    for relative_path in PAGES:
        html, page = parse(relative_path)
        assert "2026-08-12" in html
        assert any(label in html for label in ("먼저 답", "빠른 답", "핵심 답변"))
        assert any(link["href"].startswith(("../", "../../", "/kor/report/")) for link in page.links)

def test_pages_link_to_required_official_domains():
    for relative_path, domains in OFFICIAL_DOMAINS.items():
        html, page = parse(relative_path)
        assert all(any(domain in link.get("href", "") for link in page.links) for domain in domains)

def test_volatile_stale_claims_are_removed():
    for phrase in ("2025년부터 도입", "신청 수수료 €7", "여행 8일 전 신청", "무료 대중교통 이용", "도하 메트로 무료 이용", "즉시 발급"):
        assert phrase not in combined_html()
```

- [x] **Step 3: 테스트가 요구사항 부재로 실패하는지 확인한다**

Run: `pytest -q tests/test_gsc_opportunity_batch.py`

Expected: 다섯 페이지 중 최신 확인일·첫 화면 답변·내부 링크 또는 오래된 변동 정보 조건에서 FAIL.

- [x] **Step 4: 다섯 페이지를 최소 범위로 개선한다**

각 페이지에 검색 질문에 대한 2~4문장짜리 즉답을 첫 화면에 배치하고, 확인한 공식 링크 및 관련 내부 링크를 추가한다. 카타르의 월드컵 시기 혜택처럼 현재 근거가 없는 문장과 노르웨이의 오래된 ETIAS 일정·고정 수수료 문장을 제거한다. 제목과 설명은 페이지가 실제로 답하는 내용만 반영하며 JSON-LD의 이름·설명·수정일도 화면 내용과 맞춘다.

- [x] **Step 5: 새 계약 테스트를 통과시킨다**

Run: `pytest -q tests/test_gsc_opportunity_batch.py`

Expected: PASS.

- [x] **Step 6: 기존 페이지 테스트를 함께 실행한다**

Run: `pytest -q tests/test_busan_camping_page.py tests/test_andong_camping_page.py tests/test_sweden_visa_page.py tests/test_seventeenth_ga4_priority_batch.py`

Expected: PASS. 날짜처럼 의도적으로 최신화된 계약만 새 사실과 일치하도록 조정한다.

- [x] **Step 7: 작업 묶음을 커밋한다**

```bash
git add tests/test_gsc_opportunity_batch.py kor/report/camp/busan.html kor/report/camp/andong.html kor/report/visa/norway.html kor/report/visa/qatar.html kor/report/visa/sweden.html
git commit -m "feat: improve five search opportunity pages"
```

### Task 2: 성과 기준 기록과 배포 검증

**Files:**
- Create: `docs/growth/2026-08-12-search-opportunity-batch-01.md`
- Modify: `docs/superpowers/plans/2026-08-12-gsc-opportunity-batch.md`

**Interfaces:**
- Consumes: 설계 문서의 최근 90일 기준선과 Task 1의 변경 결과
- Produces: 28일 후 동일 기준으로 비교 가능한 기록과 배포된 GitHub Pages 변경

- [x] **Step 1: 기준선과 변경 내역을 기록한다**

문서에 사이트 전체 클릭 170, 노출 4,557, CTR 3.7%, 평균 순위 17.4와 대상별 수치를 기록한다. 각 페이지에서 바꾼 검색 스니펫·즉답·공식 출처·내부 링크와 AdSense 안전장치 유지 여부를 표로 남긴다.

- [x] **Step 2: 전체 회귀 검사를 실행한다**

Run: `pytest -q`

Expected: 전체 PASS, error와 failure 0개.

- [x] **Step 3: 변경 품질과 저장소 상태를 확인한다**

Run: `git diff --check && git status --short`

Expected: 공백 오류 없음. 계획·성과 문서 외 의도하지 않은 파일 없음.

- [x] **Step 4: 기록 문서를 커밋한다**

```bash
git add docs/growth/2026-08-12-search-opportunity-batch-01.md docs/superpowers/plans/2026-08-12-gsc-opportunity-batch.md
git commit -m "docs: record search opportunity baseline"
```

- [x] **Step 5: 메인 브랜치에 배포한다**

Run: `git push origin main`

Expected: 원격 `main`이 로컬 최종 커밋으로 갱신된다.

- [x] **Step 6: 원격 동기화를 검증한다**

Run: `git fetch origin main && git rev-parse HEAD && git rev-parse origin/main && git status --short`

Expected: 두 커밋 해시가 같고 작업 트리가 깨끗하다.
