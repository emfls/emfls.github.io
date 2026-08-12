# Search Console 성장 후보 7차 개선 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 상위 캠핑·비자 페이지 5개의 검색 순위를 보호하면서 첫 화면 판단과 공식 근거를 강화한다.

**Architecture:** URL·제목·광고 계약은 유지하고 본문 답변 블록과 공식 링크만 보강한다. 전용 테스트와 전체 회귀검사로 기존 성과 신호를 보호한다.

**Tech Stack:** 정적 HTML, JSON-LD, Python `unittest`/`pytest`, GitHub Pages

## Global Constraints

- canonical, title, GA4, AdSense와 광고 위치를 유지한다.
- 광고를 추가하지 않는다.
- 공식 확인 항목만 `2026-08-12`로 갱신한다.
- 예약·운영·입국·체류를 보장하지 않는다.

---

### Task 1: 상위 5개 페이지 본문 계약 개선

**Files:**
- Create: `tests/test_gsc_opportunity_batch_07.py`
- Modify: `kor/report/camp/cheongju.html`
- Modify: `kor/report/camp/gimpo.html`
- Modify: `kor/report/camp/damyang.html`
- Modify: `kor/report/visa/romania.html`
- Modify: `kor/report/visa/slovakia.html`

**Interfaces:**
- Consumes: 기존 메타데이터·답변 블록·공식 링크·광고/측정 태그
- Produces: 제목을 유지한 채 의사결정이 선명한 다섯 페이지

- [x] **Step 1: 실패하는 계약 테스트를 작성한다**
- [x] **Step 2: 전용 테스트 RED를 확인한다**
- [x] **Step 3: 다섯 페이지를 최소 수정한다**
- [x] **Step 4: 전용·관련 테스트를 통과시킨다**
- [x] **Step 5: 구현을 커밋한다**

### Task 2: 기록·전체 검증·배포

**Files:**
- Create: `docs/growth/2026-08-12-search-opportunity-batch-07.md`
- Modify: `docs/superpowers/plans/2026-08-12-gsc-opportunity-batch-07.md`

- [x] **Step 1: 기준선과 안전장치를 기록한다**
- [x] **Step 2: 전체 테스트와 diff 검사를 통과시킨다**
- [x] **Step 3: 커밋·푸시하고 원격 해시를 확인한다**
