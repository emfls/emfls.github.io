# Overseas Stock Tax Cluster Pilot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기존 해외주식 세금 글을 공식 근거가 있는 pillar로 교정하고, 기존 관련 글 3개와 브라우저 계산기를 연결한다.

**Architecture:** 새 글을 대량 생성하지 않는다. 기존 `/kor/column/overseas-stock-tax-2026.html`을 대표 URL로 유지하고 `/kor/column/dividend-etf-tax-guide-2026.html`, `/kor/column/financial-income-tax-2000-2026.html`, `/kor/column/isa-account-tax-free-2026.html` 및 신규 정적 계산기 한 개를 양방향으로 연결한다. 계산은 브라우저 안에서만 수행하며 결과에 가정과 제외 항목을 함께 표시한다.

**Tech Stack:** 정적 HTML/CSS/JavaScript, Python unittest/pytest, GitHub Pages.

**Spec:** `docs/analysis/2026-08-20-seo-automation-redesign-review.md`

## Global Constraints

- 기존 URL, canonical, GA4, AdSense를 보존한다.
- 광고를 추가하거나 광고 클릭을 추적하지 않는다.
- 세율·공제·신고 안내에는 공식 출처와 `2026-08-21` 확인일을 표시한다.
- 계산 결과는 참고용 추정치이며 실제 신고액을 보장하지 않는다.

---

### Task 1: Pillar 사실 교정과 탐색 구조

**Files:**
- Modify: `kor/column/overseas-stock-tax-2026.html`
- Test: `tests/test_overseas_stock_tax_cluster.py`

**Interfaces:**
- Consumes: 기존 canonical URL과 GA4/AdSense 코드
- Produces: 클러스터 대표 페이지와 계산기·관련 글 링크

- [x] **Step 1: 검증되지 않은 제목·단정과 필수 출처·확인일을 검사하는 실패 테스트 작성**
- [x] **Step 2: `python3 -m unittest tests.test_overseas_stock_tax_cluster -v`로 의도한 실패 확인**
- [x] **Step 3: 제목, 본문, 참고자료, 면책, cluster navigation을 최소 변경**
- [x] **Step 4: 단일 테스트 통과 확인**

### Task 2: 해외주식 양도소득세 계산기

**Files:**
- Create: `kor/util/overseas-stock-tax-calculator/index.html`
- Modify: `sitemap.xml`
- Test: `tests/test_overseas_stock_tax_cluster.py`

**Interfaces:**
- Consumes: 총 양도가액, 총 취득가액, 필요경비, 같은 해 실현손익(원화)
- Produces: `max(0, 순양도차익 - 2,500,000)`, 국세 20%, 지방소득세 포함 합계 추정액

- [x] **Step 1: 1,000만원 순이익의 기본공제 후 총 추정세액 165만원과 250만원 이하 0원을 검증하는 실패 테스트 작성**
- [x] **Step 2: 테스트가 계산기 부재로 실패하는지 확인**
- [x] **Step 3: 접근 가능한 입력·결과·가정·관련 링크가 있는 정적 계산기 구현**
- [x] **Step 4: 계산기 테스트 통과 확인**

### Task 3: 양방향 링크, metadata, QA 및 기록

**Files:**
- Modify: `kor/column/dividend-etf-tax-guide-2026.html`
- Modify: `kor/column/financial-income-tax-2000-2026.html`
- Modify: `kor/column/isa-account-tax-free-2026.html`
- Modify: `data/content-metadata.json` (검증 완료한 pillar와 계산기만 등록)
- Create: `docs/growth/2026-08-21-overseas-stock-tax-cluster-pilot.md`
- Test: `tests/test_overseas_stock_tax_cluster.py`

**Interfaces:**
- Consumes: pillar 및 계산기 canonical URL
- Produces: pillar↔관련 글↔계산기의 끊김 없는 내부 탐색과 YMYL metadata

- [x] **Step 1: 네 기존 페이지의 pillar/계산기 역링크와 metadata 계약 실패 테스트 작성**
- [x] **Step 2: 의도한 링크·metadata 누락으로 실패하는지 확인**
- [x] **Step 3: 관련 섹션을 추가하고, sources·last_verified·review_interval metadata는 검증 완료한 pillar와 계산기에만 추가**
- [x] **Step 4: 단일 테스트, 전체 unittest/pytest, SEO QA 실행**
- [x] **Step 5: 결과를 성장 로그에 기록하고 변경 파일만 커밋·배포**
