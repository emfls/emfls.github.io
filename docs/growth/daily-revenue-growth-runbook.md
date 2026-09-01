# Revenue Growth Heartbeat Runbook

## 실행 주기

- 시작: 2026-09-01 14:00 Asia/Seoul
- 간격: 연속 5시간
- 최근 24시간 신규 발행: 기본 3개, 절대 최대 5개
- 활성 콘텐츠 발행 실험: 최대 20개

## 실행 순서

1. `PROJECT_HISTORY.md`가 있으면 먼저 읽고, 없으면 최신 `docs/growth/` 기록을 읽는다.
2. Revenue Opportunity, Naver, GSC, GA4, AdSense 파일의 측정 기간과 갱신일을 확인한다.
3. 직접 query 근거가 있는 신규 후보 10~20개를 조사하고 근거 원본 파일 또는 URL을 저장한다.
4. 기존 URL의 title, H1, H2, 목적과 비교해 overlap을 판정한다.
5. 분석기를 실행한다. 적격 후보가 없으면 0페이지로 정상 종료한다.
6. 선택된 URL만 작성하고 manifest에 지정된 hub와 sitemap만 갱신한다.
7. 콘텐츠 발행 실험과 Google 색인 검토 후보를 기록한다. Indexing API는 호출하지 않는다.
8. launch guard, SEO 감사, 품질 감사, unittest, pytest를 모두 실행한다.
9. diff가 manifest 범위와 일치하는지 확인한다.
10. 원격 main을 fast-forward로 확인하고 검증 성공 시에만 commit과 push를 수행한다.

## 즉시 중단 조건

- 직접 query 근거 없음 또는 근거 원본을 보존하지 못함
- 로그인, 로컬 데이터, 네트워크 접근 실패
- 후보 10개 미만 또는 20개 초과
- WINNER, COOLDOWN, 논산·철원·울진 CTR 실험 변경
- 최근 24시간 한도 5개 또는 활성 실험 20개 초과
- URL, canonical, 광고, GA4 변경
- guard, 감사 또는 테스트 실패
- pull 충돌 또는 push 거절

기준을 낮추거나 허위 값을 만들지 않는다. 부분 발행과 force push를 하지 않는다. 실패 원인과 데이터 상태만 기록한다.
