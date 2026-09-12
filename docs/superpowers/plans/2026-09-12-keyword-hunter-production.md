# Keyword Hunter Production Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 실제 검색값만으로 신규 키워드를 평가하고 성과 기반 기존 페이지 후보를 분리하며 2시간마다 재실행 가능한 Keyword Hunter를 완성한다.

**Architecture:** 기존 Search Ads→DataLab→웹문서 경쟁도→중복 검사→점수 흐름은 유지한다. 웹 검색 권한은 DataLab 연결과 별도로 진단하고, 기존 페이지 후보는 `page-performance.json`에서 측정값이 있는 URL만 별도 JSON으로 출력한다. GitHub Actions는 스케줄 실행 후 상태·리포트 파일만 커밋한다.

**Tech Stack:** Python 3.11 표준 라이브러리, pytest, GitHub Actions YAML.

**Spec:** `docs/keyword-hunter/design.md`

## Global Constraints

- 검색량·트렌드·경쟁도 결측값을 추정하지 않는다.
- 19,000개 페이지를 수정하지 않고 측정 데이터가 있는 후보 URL만 출력한다.
- WINNER·COOLDOWN 페이지는 자동 수정하지 않는다.
- 신규 페이지 제작은 추천까지만 하며 자동 발행하지 않는다.

---

### Task 1: API health와 경쟁도 권한 진단

**Files:** `scripts/keyword_hunter_api.py`, `tests/test_keyword_hunter_api.py`, `.env.example`, `docs/keyword-hunter.md`

- [x] API Hub 웹 검색 권한과 DataLab 권한을 독립 상태로 노출하는 실패 테스트를 추가한다.
- [x] 별도 웹 검색 키 우선순위와 401/403 해결 안내 코드를 구현한다.
- [x] 관련 테스트를 실행한다.

### Task 2: 성과 기반 기존 페이지 개선 후보

**Files:** `scripts/keyword_hunter_improvements.py`, `scripts/keyword_hunter.py`, `tests/test_keyword_hunter_improvements.py`, `data/existing-page-improvement-candidates.json`

- [x] Google/Naver/GA4/수익 클러스터의 실측값만 허용하는 선택 테스트를 추가한다.
- [x] URL·근거·측정값만 저장하고 페이지를 수정하지 않는 추출기를 구현한다.
- [x] Keyword Hunter 한 번 실행에 후보 수와 출력 경로를 포함한다.

### Task 3: 반복 실행 자동화

**Files:** `.github/workflows/keyword-hunter.yml`, `tests/test_keyword_hunter_workflow.py`, `TASKS.md`

- [x] 2시간 cron, 수동 실행, 동시 실행 방지, secrets 전달, 제한된 커밋 범위를 검사하는 테스트를 추가한다.
- [x] 전용 GitHub Actions workflow를 구현한다.
- [x] `$100/day` 기준 P1 우선순위를 갱신한다.

### Task 4: 실제 실행·검증·기록

**Files:** `PROJECT_HISTORY.md`, `reports/keyword-hunter/`, Keyword Hunter 상태 파일

- [x] health check와 실제 Keyword Hunter를 한 번 실행한다.
- [x] 관련 테스트와 전체 회귀 테스트를 실행한다.
- [x] 병목·원인·실행 결과·필요 권한·다음 작업을 기록한다.
