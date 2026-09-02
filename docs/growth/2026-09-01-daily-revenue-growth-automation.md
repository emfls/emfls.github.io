# 2026-09-01 Revenue Growth Automation

## 적용 상태

- 직접 query 증거 검증, 5단계 overlap, 100점 신규 Opportunity 점수 구현
- 점수 70 이상 기본 3개, 85 이상·NO_OVERLAP 추가 슬롯 최대 2개 구현
- 최근 24시간 누적 발행 최대 5개와 활성 발행 실험 최대 20개 구현
- 분석과 콘텐츠 수정을 분리하고 근거 부족 시 `NO_PUBLICATION` 구현
- WINNER, 활성 CTR 실험, 광고·GA4·canonical 보호 launch guard 구현
- 신규 페이지 28일 cohort, win rate와 pattern 상태를 Revenue 대시보드에 연결
- GitHub Actions는 검증 전용이며 예약·쓰기·push를 수행하지 않음

## 현재 실행 결과

- Run: 2026-09-01 14:00 Asia/Seoul
- Direct query research: `INSUFFICIENT_DATA`
- Selected: 0
- Published: 0
- Content launch experiments: 0 / 20
- Rolling 24h publication slots: 5
- Google index candidates: 0, review only

직접 query 조사 스냅샷이 없으므로 0페이지 발행이 정상이다. 수익, 검색량, 순위는 생성하지 않았다.

## 보호 상태

- `EXP-CAMP-NONSAN-CTR-20260901`
- `EXP-CAMP-CHEORWON-CTR-20260901`
- `EXP-CAMP-ULJIN-CTR-20260901`

세 실험은 2026-09-29까지 COOLDOWN이며 신규 콘텐츠 슬롯을 차감하지 않는다. 기존 Revenue WINNER도 변경하지 않는다.

## 기록 위치

프로젝트 루트에 `PROJECT_HISTORY.md`가 없으므로 이 파일을 동일 목적의 권위 있는 구현 기록으로 사용한다. 예약 ID와 최종 테스트 수는 활성화·검증 후 추가한다.

## GitHub Actions 회귀 수정

- 실패 run: `33475375136`
- 원인: checkout이 shallow 상태라 push 직전 SHA가 로컬 object database에 없었지만 launch guard가 해당 SHA와 diff를 시도함
- 수정: push 경로에서 `EVENT_BEFORE` SHA를 depth 1로 fetch한 뒤 guard 실행
- 검증: workflow 테스트 6개, 전체 pytest 660개 통과

## 15:20 KST 직접 query 분석

- Source: Naver Search Advisor, 최근 30일, 업데이트 2026-08-30
- Evidence: `data/naver/search-query-2026-08-30.json`
- TOP 30 상태: `VERIFIED`, 평균순위는 `NOT_AVAILABLE`
- 분석 후보: 10개
- 결과: `IMPROVE_EXISTING` 10개, `NEW_PAGE` 0개, 발행 0개
- 보호: WINNER 및 논산·철원·울진 실험 수정 없음

주요 CTR 기회는 `냐짱 여행준비` 608노출·3클릭·0.5%, `미크로네시아 여행` 124노출·5클릭·4.0%, `경기도 노지캠핑` 67노출·4클릭·6.0%다. 이번 실행에서는 신규 페이지가 아니라 기존 intent 강화 또는 추가 검토 대상으로 유지한다.

## 19:07 KST 예약 회차 수동 실행

- 놓친 19시 예약 회차를 사용자 요청에 따라 2026-09-01 19:07 KST에 수동 실행
- Direct query evidence: `VERIFIED` (Naver Search Advisor 업데이트 2026-08-30)
- Researched: 10
- Selected: 0
- Published: 0
- 판정: 10개 후보 모두 기존 페이지와 동일한 검색 의도이므로 `IMPROVE_EXISTING` 유지
- 보호: WINNER, COOLDOWN, 활성 CTR 실험 및 콘텐츠 본문 수정 없음
- 검증: content launch guard 통과, 전체 pytest 661개 통과

새 외부 데이터나 독립적인 신규 intent가 확인되지 않았으므로 이번 회차의 올바른 결과는 `NO_PUBLICATION`이다.

## 23:02 KST 자동 실행

- Revenue Growth heartbeat `revenue-growth-5` 실행
- 사용 데이터: Naver Search Advisor 2026-08-30 업데이트분, `VERIFIED`
- 새 GA4·AdSense·Google URL 데이터: `NOT_CONNECTED`
- Researched: 10
- Selected: 0
- Published: 0
- 판정: 전 후보 `IMPROVE_EXISTING`, 새 독립 intent 없음
- 보호: WINNER, COOLDOWN, 논산·철원·울진 CTR 실험 및 콘텐츠 본문 수정 없음
- 검증: content launch guard 통과, 전체 pytest 661개 통과

직전 19:07 회차 이후 새 성과 데이터가 없으므로 분석 산출물의 실행시각만 갱신하고 `NO_PUBLICATION`을 유지한다.

## 2026-09-02 External Web Opportunity 전환

- 기존 `revenue-growth-5` heartbeat는 사용자 요청으로 삭제 완료
- 신규 외부 탐색 설계: `docs/superpowers/specs/2026-09-02-external-web-opportunity-automation-design.md`
- 구현 계획: `docs/superpowers/plans/2026-09-02-external-web-opportunity-automation.md`
- 운영 runbook: `docs/growth/external-web-opportunity-runbook.md`
- 외부 후보 검증, 후보 DB, 하루 3페이지 제한, launch manifest 연결을 별도 worktree에서 테스트 우선으로 구현
- 신규 cron은 검증된 구현이 main에 반영된 뒤 2시간 주기로 활성화한다.

## 2026-09-02 대화형 진행상황 보고 전환

- 자동화 ID: `external-web-opportunity-discovery`
- 실행 주기: 2시간
- 상태: `ACTIVE`
- 사용자가 실행 진행상황을 현재 대화에서 확인할 수 있도록 독립 cron에서 현재 스레드에 연결된 heartbeat 방식으로 전환
- 매 실행 시 시작 단계와 완료 요약을 한국어로 보고
- 완료 보고 항목: 외부 후보 수, 소스별 발견 수, 중복 거절 수, 조사·Brief·READY 상태, 오늘 발행 수(`X / 3`), TOP 기회, 테스트·push·GitHub Actions 상태
- 데이터나 외부 출처가 부족해 fail-closed로 종료하는 경우에도 이유를 현재 대화에 보고
