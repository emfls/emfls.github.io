# 5차 다음 10개 검색·방문 페이지 개선 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Search Console 잔여 8개와 GA4 실제 방문 2개를 정확하고 유용한 페이지로 개선해 main에 배포한다.

**Architecture:** 기존 정적 HTML과 게임·도구 로직을 보존한다. 페이지 유형별 계약 테스트로 검색 답변, 기능, 공식 출처, 측정·구조화 데이터를 검증한다.

**Tech Stack:** HTML/CSS/JavaScript, Python unittest/HTMLParser, Node.js syntax check, GitHub Pages

## Global Constraints

- 최근 확인일은 `2026-08-09`다.
- GA4 `G-QP5Q67GE5B`, AdSense `ca-pub-8830524482034754`를 유지한다.
- 기존 게임·도구 기능을 삭제하지 않는다.
- 여행 정보는 공식 출처와 변경 가능성을 표시한다.

---

### Task 1: 번더버그 여행
- [ ] ETA·거북이 관찰 안전·공식 관광 정보 실패 테스트를 만든다.
- [ ] 공식 자료 중심 페이지로 재작성하고 통과시킨다.

### Task 2: 일본어 비밀번호 생성기
- [ ] 실제 옵션·로컬 생성·보안 한계·구조화 데이터 실패 테스트를 만든다.
- [ ] 기존 기능을 유지해 설명을 보강하고 통과시킨다.

### Task 3: 바트뵈슬라우 여행
- [ ] 한국 여권·빈 근교 교통·온천/포도밭 공식 정보 실패 테스트를 만든다.
- [ ] 공식 자료 중심으로 재작성하고 통과시킨다.

### Task 4: Card Match
- [ ] 실제 카드 규칙·조작·canonical·개인정보 실패 테스트를 만든다.
- [ ] 게임 로직을 유지해 설명을 보강하고 통과시킨다.

### Task 5: 한국어 비자 목록
- [ ] 국가 검색·공식 재확인·안전·구조화 데이터 실패 테스트를 만든다.
- [ ] 기존 목록을 유지해 안내와 신뢰 요소를 보강하고 통과시킨다.

### Task 6: 아랍어 2048
- [ ] 아랍어 제목·화살표/터치·합치기 규칙·개인정보 실패 테스트를 만든다.
- [ ] 게임 로직을 유지해 검색 설명을 보강하고 통과시킨다.

### Task 7: 영문 Tetris
- [ ] 실제 조작·라인 삭제·점수·개인정보 실패 테스트를 만든다.
- [ ] 게임 로직을 유지해 설명을 보강하고 통과시킨다.

### Task 8: 골드코스트 여행
- [ ] ETA·공항/트램·해변 안전·공식 자료 실패 테스트를 만든다.
- [ ] 공식 자료 중심 페이지로 재작성하고 통과시킨다.

### Task 9: 3D Dice Roller
- [ ] 실제 주사위 개수·합계·랜덤 방식·개인정보 실패 테스트를 만든다.
- [ ] 기능을 유지해 설명을 보강하고 통과시킨다.

### Task 10: 일본어 Tetris
- [ ] 일본어 조작·라인 삭제·점수·개인정보 실패 테스트를 만든다.
- [ ] 게임 로직을 유지해 설명을 보강하고 통과시킨다.

### Task 11: 통합 검증·배포
- [ ] 전체 테스트, JavaScript 구문, 우선 페이지 검사, diff 검사를 실행한다.
- [ ] 성장 로그를 업데이트하고 main에 커밋·푸시한다.
- [ ] GitHub Pages와 공개 HTML을 확인한다.
