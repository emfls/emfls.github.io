# Search Console 성장 후보 5차 개선 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 나이지리아 비자, 뉴캐슬·퍼스 여행과 두 브라우저 게임의 검색 의도 충족도를 높이되 게임 광고 비활성 상태를 유지한다.

**Architecture:** 다섯 정적 HTML의 URL과 canonical을 유지한다. 콘텐츠 페이지는 공식 근거와 답변 우선 구조를, 게임 페이지는 실제 플레이와 일치하는 검색·조작 설명을 강화하며 전용 계약 테스트와 전체 회귀 검사로 보호한다.

**Tech Stack:** 정적 HTML, JSON-LD, Python `unittest`/`pytest`, GitHub Pages

## Global Constraints

- 대상은 `nigeria.html`, `australia-newcastle.html`, `australia-perth.html`, `game/MarbleFlick/index.html`, `game/AeroJump/index.html`이다.
- canonical과 GA4 `G-QP5Q67GE5B`를 유지한다.
- 비자·여행 페이지의 AdSense 설정은 유지하고 광고를 추가하지 않는다.
- 두 게임에는 AdSense 로더나 광고 단위를 추가하지 않는다.
- 공식 확인 항목만 `2026-08-12`로 갱신하고 승인·입국·운행·예약을 보장하지 않는다.

---

### Task 1: 다섯 페이지 검색·사용성 계약 개선

**Files:**
- Create: `tests/test_gsc_opportunity_batch_05.py`
- Modify: `kor/report/visa/nigeria.html`
- Modify: `kor/report/travel/australia-newcastle.html`
- Modify: `kor/report/travel/australia-perth.html`
- Modify: `game/MarbleFlick/index.html`
- Modify: `game/AeroJump/index.html`

**Interfaces:**
- Consumes: 각 HTML의 메타데이터, canonical, JSON-LD, 본문 링크와 광고·측정 태그
- Produces: 공식 근거를 갖춘 세 콘텐츠 페이지와 실제 조작법이 검색 설명과 일치하는 두 게임 페이지

- [x] **Step 1: 실패하는 계약 테스트를 작성한다**

테스트는 다섯 canonical과 GA4, 콘텐츠 페이지의 공식 출처·최근 확인일·AdSense, 게임 페이지의 광고 비활성·조작법·설명형 제목을 검증한다.

- [x] **Step 2: 신규 계약의 RED를 확인한다**

Run: `pytest -q tests/test_gsc_opportunity_batch_05.py`

Expected: 새 날짜, 구체적 여행 판단 또는 게임 설명 계약에서 FAIL.

- [x] **Step 3: 다섯 페이지를 최소 범위로 수정한다**

나이지리아의 단기 e-Visa 조건, 뉴캐슬 Bathers Way, 퍼스 터미널별 공항 이동을 공식 출처와 첫 답변에 반영한다. 두 게임은 실제 조작·목표·재시작 설명과 검색 메타데이터를 일치시키며 광고 비활성을 유지한다.

- [x] **Step 4: 신규 및 관련 테스트를 통과시킨다**

Run: `pytest -q tests/test_gsc_opportunity_batch_05.py tests/test_nigeria_visa_page.py tests/test_marbleflick_page.py`

Expected: PASS.

- [x] **Step 5: 구현을 커밋한다**

```bash
git add tests/test_gsc_opportunity_batch_05.py kor/report/visa/nigeria.html kor/report/travel/australia-newcastle.html kor/report/travel/australia-perth.html game/MarbleFlick/index.html game/AeroJump/index.html
git commit -m "feat: improve fifth search opportunity batch"
```

### Task 2: 성장 기록, 전체 검증과 배포

**Files:**
- Create: `docs/growth/2026-08-12-search-opportunity-batch-05.md`
- Modify: `docs/superpowers/plans/2026-08-12-gsc-opportunity-batch-05.md`

**Interfaces:**
- Consumes: 기준선, 공식 출처, Task 1 결과
- Produces: 재측정 가능한 기록과 원격 `main` 배포

- [x] **Step 1: 기준선·변경·정책 안전장치를 기록한다**
- [x] **Step 2: `pytest -q`와 `git diff --check`를 통과시킨다**
- [x] **Step 3: 기록을 커밋하고 `main`에 푸시한다**
- [x] **Step 4: 로컬과 `origin/main` 해시 일치 및 깨끗한 작업 트리를 확인한다**
