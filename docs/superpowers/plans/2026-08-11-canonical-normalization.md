# Canonical URL Normalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 모든 색인 대상 HTML의 canonical을 현재 GitHub Pages 자기 URL로 정규화한다.

**Architecture:** 저장소 전체 HTML을 대상으로 공개 URL을 파일 경로에서 결정하는 계약 테스트를 둔다. 일회성 정규화 스크립트로 기존 canonical을 수정하고 필요한 StockWiki 페이지에 추가한 뒤, 테스트가 향후 회귀를 차단한다.

**Tech Stack:** Python 3 표준 라이브러리, pytest, 정적 HTML, GitHub Pages

## Global Constraints

- canonical 호스트는 `https://emfls.github.io`이다.
- `index.html`은 슬래시 종료 URL로 정규화한다.
- 검증 파일, 404, StockWiki 테스트 페이지는 검사에서 제외한다.
- 사용자가 승인한 현재 `main`에서 작업한다.

---

### Task 1: Canonical inventory contract

**Files:**
- Create: `tests/test_canonical_inventory.py`

**Interfaces:**
- Consumes: 저장소의 모든 `*.html` 파일
- Produces: 누락·중복·잘못된 자기 URL을 검출하는 pytest 계약

- [x] **Step 1: Write the failing test**
- [x] **Step 2: Run it and confirm failures match the audited inventory**
- [x] **Step 3: Keep the test as the permanent regression guard**

### Task 2: Normalize canonical declarations

**Files:**
- Create: `scripts/normalize_canonical_urls.py`
- Modify: canonical이 불일치·중복·누락된 색인 대상 HTML

**Interfaces:**
- Consumes: HTML 파일 경로와 기존 canonical 태그
- Produces: 정확히 하나의 self-canonical을 가진 HTML

- [x] **Step 1: Implement the minimal deterministic normalizer**
- [x] **Step 2: Run it once and record changed-file counts**
- [x] **Step 3: Run it again and confirm idempotency**
- [x] **Step 4: Run the canonical contract and full test suite**

### Task 3: Record, publish, and verify

**Files:**
- Modify: `docs/growth/2026-08-01-priority-rollout-log.md`

**Interfaces:**
- Consumes: test results and changed-file inventory
- Produces: durable work log and deployed GitHub Pages revision

- [x] **Step 1: Record the audit and outcome in the growth log**
- [ ] **Step 2: Review the diff and commit intentionally**
- [ ] **Step 3: Push `main`, trigger Pages, and verify the exact deployed SHA**
- [ ] **Step 4: Verify representative live canonical tags**
