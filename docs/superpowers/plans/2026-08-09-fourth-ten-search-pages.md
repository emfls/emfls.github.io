# 4차 다음 10개 검색 페이지 개선 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 2026-08-01 Search Console 내 아직 개선하지 않은 노출 상위 10개 콘텐츠를 정확하고 검색 의도에 맞는 페이지로 개선해 main에 배포한다.

**Architecture:** 기존 정적 HTML URL과 핵심 기능을 유지하고 페이지 유형별 계약 테스트로 메타데이터·공식 출처·최근 확인일·측정 코드를 검증한다. 사실이 변하는 콘텐츠는 정부 원문으로 재검증하고 적용 내용을 성장 로그에 남긴다.

**Tech Stack:** 정적 HTML/CSS/JavaScript, Python unittest/HTMLParser, GitHub Pages

## Global Constraints

- 최근 확인일은 `2026-08-09`다.
- canonical은 공개 HTTPS URL 하나로 통일한다.
- GA4 `G-QP5Q67GE5B`, AdSense `ca-pub-8830524482034754`, 모바일 광고 폭 보호를 유지한다.
- 공식 출처 없는 가격·시간·효과·처리기간 보장을 제거한다.
- 기존 게임·도구의 핵심 기능은 유지한다.

---

### Task 1: 홈페이지
- [ ] 제목·설명·탐색·구조화 데이터 계약 테스트를 실패시킨다.
- [ ] 실제 카테고리와 대표 콘텐츠 중심으로 수정하고 집중 테스트를 통과시킨다.

### Task 2: 산마리노 비자
- [ ] 한국 여권·이탈리아/쉥겐 경유·90/180·장기 체류·공식 출처 테스트를 실패시킨다.
- [ ] EU·산마리노 공식 정보로 재작성하고 집중 테스트를 통과시킨다.

### Task 3: AeroJump
- [ ] 실제 조작·게임 규칙·canonical·개인정보 설명과 JavaScript 실행 테스트를 실패시킨다.
- [ ] 기능을 유지하며 검색 설명과 접근성을 개선하고 집중 테스트를 통과시킨다.

### Task 4: FlagQuest
- [ ] 실제 국기 퀴즈 규칙·조작·canonical·개인정보 설명과 JavaScript 실행 테스트를 실패시킨다.
- [ ] 기능을 유지하며 검색 설명과 접근성을 개선하고 집중 테스트를 통과시킨다.

### Task 5: 케언스 여행
- [ ] ETA·공항 이동·그레이트배리어리프 안전·공식 출처 계약 테스트를 실패시킨다.
- [ ] 호주 정부·퀸즐랜드 관광·교통 공식 정보로 재작성하고 통과시킨다.

### Task 6: 포트맥쿼리 여행
- [ ] ETA·시드니 연결·해안 코스·공식 출처 계약 테스트를 실패시킨다.
- [ ] 호주 정부·뉴사우스웨일스 관광·교통 공식 정보로 재작성하고 통과시킨다.

### Task 7: 니제르 비자
- [ ] 한국 여권 비자·황열·여행경보·공식 출처 계약 테스트를 실패시킨다.
- [ ] 정부·WHO·외교부 자료로 안전 우선 재작성하고 통과시킨다.

### Task 8: 안스펠덴 여행
- [ ] 90/180·린츠 연결·공식 관광/교통 출처 계약 테스트를 실패시킨다.
- [ ] 오스트리아 정부·지역 관광·ÖBB 자료로 재작성하고 통과시킨다.

### Task 9: OBBB 분석
- [ ] 법안 정식 명칭·현 상태·시행 시점·미 의회/정부 출처 계약 테스트를 실패시킨다.
- [ ] 법률 원문과 공공기관 분석을 기준으로 사실·의견을 구분해 재작성하고 통과시킨다.

### Task 10: 일본어 색상 추출기
- [ ] 실제 입력·출력 형식·로컬 처리 범위·canonical·JavaScript 실행 테스트를 실패시킨다.
- [ ] 기능을 유지하며 일본어 검색 설명·사용법·제한을 개선하고 통과시킨다.

### Task 11: 통합 검증·기록·배포
- [ ] 전체 테스트와 우선 페이지 검증기, JavaScript 구문 검사, `git diff --check`를 통과시킨다.
- [ ] `docs/growth/2026-08-01-priority-rollout-log.md`에 기준선·변경·재평가일을 기록한다.
- [ ] main에 커밋·푸시하고 GitHub Pages 성공과 공개 HTML 반영을 확인한다.
