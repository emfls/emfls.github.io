# Search Console 성장 후보 8차 개선 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 검색 1페이지 성과가 있는 캠핑·비자 페이지 5개의 정확성과 공식 근거를 강화한다.

**Architecture:** 제목·URL·측정·광고 계약은 유지한다. 경기 광주 캠핑은 등록시설 중심으로 재작성하고 나머지 네 페이지는 최소 수정한다.

**Tech Stack:** 정적 HTML, JSON-LD, Python `unittest`/`pytest`, GitHub Pages

## Global Constraints

- canonical, title, GA4, AdSense와 광고 위치를 유지한다.
- 광고를 추가하지 않는다.
- 공식 확인 항목은 `2026-08-12`로 갱신한다.
- 예약·운영·비자 승인·입국을 보장하지 않는다.

---

### Task 1: 다섯 페이지 콘텐츠 계약 개선

**Files:**
- Create: `tests/test_gsc_opportunity_batch_08.py`
- Modify: `kor/report/camp/gwangju-g.html`
- Modify: `kor/report/camp/goheung.html`
- Modify: `kor/report/visa/northmacedonia.html`
- Modify: `kor/report/visa/senegal.html`
- Modify: `kor/report/visa/sierra-leone.html`

**Interfaces:**
- Consumes: 기존 제목·canonical·GA4·AdSense와 공식 출처 링크
- Produces: 등록·예약 및 승인·입국을 구분하는 다섯 페이지

- [x] **Step 1: 실패하는 전용 계약 테스트를 작성한다**
- [x] **Step 2: 전용 테스트 RED를 확인한다**
- [x] **Step 3: 경기 광주를 등록 야영장 중심으로 재작성한다**
- [x] **Step 4: 나머지 네 페이지를 최소 수정한다**
- [x] **Step 5: 전용 테스트를 통과시키고 구현을 커밋한다**

### Task 2: 기록·전체 검증·배포

**Files:**
- Create: `docs/growth/2026-08-12-search-opportunity-batch-08.md`
- Modify: `docs/superpowers/plans/2026-08-12-gsc-opportunity-batch-08.md`

**Interfaces:**
- Consumes: 전용 테스트를 통과한 다섯 페이지
- Produces: 재측정 가능한 기준선 기록과 원격 `main` 배포

- [x] **Step 1: 기준선·공식 근거·AdSense 안전장치를 기록한다**
- [x] **Step 2: 전체 테스트와 diff 검사를 통과시킨다**
- [x] **Step 3: 커밋·푸시하고 원격 해시를 확인한다**
