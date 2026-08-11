# Recent Content RSS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 최근 수정 콘텐츠 최대 500개를 제공하는 검증 가능한 RSS 2.0 피드를 생성하고 공개·제출한다.

**Architecture:** Python 표준 라이브러리 생성기가 HTML 메타데이터를 읽어 결정론적 `feed.xml`을 만든다. 단위 테스트는 작은 임시 사이트로 선택·정렬·이스케이프를 검증하고, 배포 계약 테스트는 실제 피드의 XML 구조와 링크 무결성을 검증한다.

**Tech Stack:** Python 3 표준 라이브러리, pytest, RSS 2.0, 정적 HTML, GitHub Pages

## Global Constraints

- 기존 `sitemap.xml`과 robots의 기존 Sitemap 선언을 유지한다.
- 피드는 최대 500개이며 `https://emfls.github.io`의 self-canonical만 포함한다.
- 404, 소유권 검증, 운영 페이지, StockWiki 테스트 페이지는 제외한다.
- 현재 `main` 직접 반영과 배포는 사용자가 승인했다.

---

### Task 1: RSS generator contract

**Files:**
- Create: `tests/test_generate_recent_rss.py`
- Create: `scripts/generate_recent_rss.py`

**Interfaces:**
- Produces: `collect_entries(root: Path, limit: int = 500) -> list[FeedEntry]`
- Produces: `build_feed(entries: list[FeedEntry]) -> bytes`
- Produces: `write_feed(root: Path, output: Path, limit: int = 500) -> int`

- [x] **Step 1: Write fixtures and failing tests for metadata extraction, exclusions, descending date order, URL tie-break, limit, and XML escaping**
- [x] **Step 2: Run `pytest -q tests/test_generate_recent_rss.py` and confirm import failure**
- [x] **Step 3: Implement the minimal parser, selector, and RSS serializer**
- [x] **Step 4: Run the focused tests and confirm they pass**

### Task 2: Published feed and discovery

**Files:**
- Create: `feed.xml`
- Create: `tests/test_recent_rss_feed.py`
- Modify: `robots.txt`
- Modify: `index.html`

**Interfaces:**
- Consumes: `scripts/generate_recent_rss.py`
- Produces: valid public RSS, robots discovery, homepage alternate link

- [x] **Step 1: Write a failing deployment-contract test that parses `feed.xml` and validates 1–500 unique HTTPS items with required fields**
- [x] **Step 2: Run the test and confirm the existing column-only feed fails the root-feed contract**
- [x] **Step 3: Generate `feed.xml`, add the robots Sitemap line, and add the homepage RSS alternate link**
- [x] **Step 4: Run focused tests and rerun the generator to confirm deterministic output**

### Task 3: Record, verify, deploy, and submit

**Files:**
- Modify: `docs/growth/2026-08-01-priority-rollout-log.md`

**Interfaces:**
- Consumes: generated feed and test evidence
- Produces: durable log, deployed Pages SHA, Search Console submission result

- [x] **Step 1: Record entry count, date range, discovery paths, and limitations in the growth log**
- [x] **Step 2: Run `git diff --check` and full `pytest -q`**
- [x] **Step 3: Commit, push `main`, trigger Pages, and verify exact deployed SHA**
- [x] **Step 4: Verify public `feed.xml` HTTP 200 and XML contents**
- [x] **Step 5: Submit `feed.xml` in Search Console and record the visible result**
