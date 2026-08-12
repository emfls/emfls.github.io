# Search Console 성장 후보 6차 개선 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 노출 대비 성과가 낮은 MBTI, 싱가포르·세르비아·필리핀 비자와 마비노기 모바일 직업 페이지의 검색 의도 충족도를 높인다.

**Architecture:** 다섯 정적 HTML의 주소·측정 계약을 유지하고 답변 우선 콘텐츠만 보강한다. 게임은 광고 비활성을, 콘텐츠는 기존 광고 상태를 보존하며 전용 계약 테스트와 전체 회귀 검사로 보호한다.

**Tech Stack:** 정적 HTML, JSON-LD, Python `unittest`/`pytest`, GitHub Pages

## Global Constraints

- canonical과 GA4를 유지한다.
- 광고를 추가하거나 게임 광고를 활성화하지 않는다.
- 공식 확인 항목만 `2026-08-12`로 갱신한다.
- 의료적 MBTI 판정, 영구 직업 티어, 비자·입국·체류 보장을 하지 않는다.

---

### Task 1: 다섯 페이지 계약 개선

**Files:**
- Create: `tests/test_gsc_opportunity_batch_06.py`
- Modify: `game/MBTI/index.html`
- Modify: `kor/report/visa/singapore.html`
- Modify: `kor/report/visa/serbia.html`
- Modify: `kor/report/mabinogi-mobile-jobs.html`
- Modify: `kor/report/visa/philippines.html`

**Interfaces:**
- Consumes: HTML 메타데이터, canonical, JSON-LD, 공식 링크, 광고·측정 태그
- Produces: 검색 질문에 첫 화면에서 답하고 위험한 보장을 피하는 다섯 페이지

- [x] **Step 1: 실패하는 전용 계약 테스트를 작성한다**
- [x] **Step 2: `pytest -q tests/test_gsc_opportunity_batch_06.py`에서 RED를 확인한다**
- [x] **Step 3: 다섯 페이지를 공식 근거와 실제 기능에 맞게 수정한다**
- [x] **Step 4: 전용 및 관련 기존 테스트를 통과시킨다**
- [x] **Step 5: 구현을 커밋한다**

### Task 2: 기록, 전체 검증과 배포

**Files:**
- Create: `docs/growth/2026-08-12-search-opportunity-batch-06.md`
- Modify: `docs/superpowers/plans/2026-08-12-gsc-opportunity-batch-06.md`

**Interfaces:**
- Consumes: 기준선, 공식 근거, Task 1 결과
- Produces: 재측정 기록과 원격 `main` 배포

- [x] **Step 1: 기준선·변경·AdSense 안전장치를 기록한다**
- [x] **Step 2: 전체 `pytest -q`와 `git diff --check`를 통과시킨다**
- [x] **Step 3: 기록을 커밋하고 `main`에 푸시한다**
- [x] **Step 4: 로컬·원격 해시 일치와 깨끗한 작업 트리를 확인한다**
