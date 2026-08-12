# Search Demand Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 검색 수요와 SERP 진입 가능성이 확인된 캠핑 체크리스트, 일본 eSIM 계산기, 일본 여행 체크리스트를 발행한다.

**Architecture:** 각 도구는 독립적인 모바일 우선 HTML과 CommonJS/브라우저 겸용 순수 JavaScript 로직으로 구성한다. Python 계약 테스트는 HTML 메타·정책·내부 링크를 검증하고 Node 테스트는 계산과 조건별 목록 생성을 검증한다.

**Tech Stack:** HTML5, CSS, vanilla JavaScript, Node `node:test`, Python `unittest`.

## Global Constraints

- 외부 프레임워크와 신규 의존성을 추가하지 않는다.
- GA4 `G-QP5Q67GE5B`, AdSense 게시자 `ca-pub-8830524482034754`, 실제 URL canonical을 적용한다.
- 광고와 조작 버튼을 분리하고 광고 클릭 유도 문구를 사용하지 않는다.
- 체크 상태 저장 실패가 핵심 기능을 막지 않아야 한다.
- 숫자 입력을 유효 범위로 정규화한다.

---

### Task 1: 계약·로직 실패 테스트

**Files:**
- Create: `tests/test_search_demand_tools.py`
- Create: `tests/search_demand_tools.test.js`

**Interfaces:**
- Consumes: 승인된 세 URL과 설계서 요구사항
- Produces: `buildCampingList(options)`, `estimateEsimUsage(options)`, `buildJapanPackingList(options)`의 기대 동작

- [ ] 세 페이지의 canonical, 제목, 설명, GA4, AdSense, JSON-LD, 관련 링크 계약을 작성한다.
- [ ] 계절·유형별 캠핑 목록, eSIM 합산·20% 여유·구간 추천, 일본 여행 조건별 목록 테스트를 작성한다.
- [ ] `python3 -m unittest tests.test_search_demand_tools`와 `node --test tests/search_demand_tools.test.js`를 실행해 파일 또는 함수 부재로 실패하는지 확인한다.

### Task 2: 순수 로직 구현

**Files:**
- Create: `kor/util/camping-packing-checklist/app.js`
- Create: `kor/util/japan-esim-data-calculator/app.js`
- Create: `kor/util/japan-travel-packing-checklist/app.js`

**Interfaces:**
- `buildCampingList({people,nights,season,type}) -> Array<{category,item}>`
- `estimateEsimUsage({days,maps,messaging,social,music,video,tethering}) -> {baseGb,totalGb,recommendation}`
- `buildJapanPackingList({season,days,checkedBag,children}) -> Array<{phase,category,item}>`

- [ ] 테스트를 만족하는 최소 순수 함수를 구현한다.
- [ ] CommonJS export와 브라우저 전역 export를 함께 제공한다.
- [ ] Node 테스트가 통과하는지 확인한다.

### Task 3: 세 사용자 페이지 구현

**Files:**
- Create: `kor/util/camping-packing-checklist/index.html`
- Create: `kor/util/japan-esim-data-calculator/index.html`
- Create: `kor/util/japan-travel-packing-checklist/index.html`

**Interfaces:**
- Consumes: Task 2의 세 순수 함수
- Produces: 입력, 결과, 저장·초기화·인쇄가 가능한 세 독립 페이지

- [ ] 모바일 우선 입력·결과 UI와 JavaScript 비활성화 기본 내용을 구현한다.
- [ ] 체크 상태를 안전하게 저장하고 초기화·인쇄 기능을 연결한다.
- [ ] SEO 메타, JSON-LD, GA4, AdSense, 정책 안전 문구와 관련 링크를 추가한다.
- [ ] Python 계약 테스트를 통과시킨다.

### Task 4: 내부 링크·성과 기록

**Files:**
- Modify: `kor/report/camp/index.html`
- Modify: `kor/report/travel/japan-tokyo.html`
- Modify: `docs/growth/2026-08-12-search-demand-candidates.md`

**Interfaces:**
- Consumes: 세 신규 URL
- Produces: 허브 발견 경로와 14·28일 측정 기준

- [ ] 캠핑 허브에 캠핑 체크리스트 카드를 연결한다.
- [ ] 일본 도쿄 페이지와 두 일본 도구를 상호 연결한다.
- [ ] 후보 문서에 발행 URL과 측정 날짜를 기록한다.
- [ ] 전체 신규 테스트, `git diff --check`, 로컬 링크·canonical 검사를 실행한다.
- [ ] 검증된 변경을 커밋하고 `main`에 푸시한다.
