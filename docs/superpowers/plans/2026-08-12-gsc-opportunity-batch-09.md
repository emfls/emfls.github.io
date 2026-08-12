# Search Console 성장 후보 9차 개선 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 잔여 검색 신호 5개 페이지의 공식 판단 정보와 주소 일관성을 강화한다.

**Architecture:** 기존 제목·URL·측정 계약을 유지하고 본문 결정 정보만 최소 수정한다. 게임은 canonical과 Open Graph URL을 통일하면서 광고 비활성 상태를 보존한다.

**Tech Stack:** 정적 HTML, JSON-LD, Python `unittest`/`pytest`, GitHub Pages

## Global Constraints

- title, canonical, GA4와 기존 AdSense 설정을 유지한다.
- 게임 페이지에는 광고를 추가하지 않는다.
- 공식 확인 항목은 `2026-08-12`로 갱신한다.
- 운영·예약·입국·교통 연결을 보장하지 않는다.

---

### Task 1: 다섯 페이지 콘텐츠 계약 개선

**Files:**
- Create: `tests/test_gsc_opportunity_batch_09.py`
- Modify: `kor/report/camp/asan.html`
- Modify: `kor/report/visa/san-marino.html`
- Modify: `kor/report/travel/australia-cairns.html`
- Modify: `kor/report/travel/australia-portmacquarie.html`
- Modify: `game/FlappyDot/index.html`

**Interfaces:**
- Consumes: 기존 title·canonical·GA4·광고 상태와 공식 링크
- Produces: 최신 결정 정보와 일관된 공유 URL을 가진 다섯 페이지

- [ ] **Step 1: 실패하는 전용 계약 테스트를 작성한다**
- [ ] **Step 2: 전용 테스트 RED를 확인한다**
- [ ] **Step 3: 다섯 페이지를 최소 수정한다**
- [ ] **Step 4: 전용 테스트를 통과시키고 구현을 커밋한다**

### Task 2: 기록·전체 검증·배포

**Files:**
- Create: `docs/growth/2026-08-12-search-opportunity-batch-09.md`
- Modify: `docs/superpowers/plans/2026-08-12-gsc-opportunity-batch-09.md`

**Interfaces:**
- Consumes: 전용 테스트를 통과한 다섯 페이지
- Produces: 재측정 기준선 기록과 원격 `main` 배포

- [ ] **Step 1: 기준선·공식 근거·AdSense 안전장치를 기록한다**
- [ ] **Step 2: 전체 테스트와 diff 검사를 통과시킨다**
- [ ] **Step 3: 커밋·푸시하고 원격 해시를 확인한다**
